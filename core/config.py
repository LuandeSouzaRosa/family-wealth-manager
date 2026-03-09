"""Configuração centralizada do Family Wealth Manager.

Extraído do monolito app_homolog.py — Seção 1 (Config + UserConfig).
"""
from __future__ import annotations

from dataclasses import dataclass, field
import pandas as pd


@dataclass(frozen=True)
class Config:
    VERSION: str = "8.0"
    NECESSIDADES: tuple = ("Moradia", "Alimentação", "Saúde", "Transporte")
    DESEJOS: tuple = ("Lazer", "Assinaturas", "Educação", "Outros")
    CATEGORIAS_SAIDA: tuple = (
        "Moradia", "Alimentação", "Lazer", "Saúde",
        "Transporte", "Assinaturas", "Educação", "Outros"
    )
    CATEGORIAS_ENTRADA: tuple = ("Salário", "Dividendos", "Bônus", "Extra", "Reembolso")
    CATEGORIAS_TODAS: tuple = (
        "Moradia", "Alimentação", "Lazer", "Saúde", "Transporte",
        "Investimento", "Salário", "Outros", "Assinaturas", "Educação",
        "Dividendos", "Bônus", "Extra", "Reembolso"
    )
    RESPONSAVEIS: tuple = ("Casal", "Luan", "Luana")
    TIPOS: tuple = ("Entrada", "Saída")
    COLS_TRANSACAO: tuple = ("Id", "Data", "Descricao", "Valor", "Categoria", "Tipo", "Responsavel", "Origem", "Tag")
    COLS_PATRIMONIO: tuple = ("Item", "Valor", "Responsavel")
    COLS_RECORRENTE: tuple = ("Descricao", "Valor", "Categoria", "Tipo", "Responsavel", "DiaVencimento", "Ativo")
    COLS_ORCAMENTO: tuple = ("Categoria", "Limite", "Responsavel")
    COLS_CONFIG: tuple = ("Chave", "Valor", "Responsavel")
    COLS_AUDIT: tuple = ("Timestamp", "Usuario", "Acao", "Planilha", "Detalhes")
    COLS_METAS: tuple = ("Id", "Nome", "ValorAlvo", "ValorAtual", "Prazo", "Responsavel", "Ativo")
    COLS_PASSIVOS: tuple = ("Item", "Valor", "Responsavel")
    COLS_LIXEIRA: tuple = ("Id", "Data", "Descricao", "Valor", "Categoria", "Tipo", "Responsavel", "Origem", "Tag", "DeletadoEm")
    COLS_FAVORITOS: tuple = ("Id", "Nome", "Descricao", "Valor", "Categoria", "Tipo", "Responsavel", "Tag", "Ordem")
    META_NECESSIDADES: int = 50
    META_DESEJOS: int = 30
    META_INVESTIMENTO: int = 20
    AUTONOMIA_OK: int = 12
    AUTONOMIA_WARN: int = 6
    CACHE_TTL: int = 120
    MAX_DESC_LENGTH: int = 200
    SAVE_RETRIES: int = 3
    MESES_EVOLUCAO: int = 6
    TIPO_ENTRADA: str = "Entrada"
    TIPO_SAIDA: str = "Saída"
    CAT_INVESTIMENTO: str = "Investimento"
    ORIGEM_MANUAL: str = "Manual"
    ORIGEM_RECORRENTE: str = "Recorrente"
    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_COOLDOWN_BASE: float = 2.0
    SESSION_TTL_HOURS: int = 24


CFG = Config()


# Abreviações (usadas em labels de gráficos)
MESES_PT: dict[int, str] = {
    1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun",
    7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez"
}

# Nomes completos
MESES_FULL: dict[int, str] = {
    1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
    5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
    9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
}


@dataclass
class UserConfig:
    """Configurações personalizáveis do usuário."""
    meta_necessidades: int = CFG.META_NECESSIDADES
    meta_desejos: int = CFG.META_DESEJOS
    meta_investimento: int = CFG.META_INVESTIMENTO
    autonomia_alvo: int = CFG.AUTONOMIA_OK
    autonomia_warn: int = CFG.AUTONOMIA_WARN
    auto_gerar_recorrentes: bool = False

    @classmethod
    def from_df(cls, df: pd.DataFrame, responsavel: str = "Casal") -> "UserConfig":
        """Carrega config do DataFrame. Fallback: defaults do CFG."""
        cfg = cls()
        if df.empty:
            return cfg

        df_user = df[df["Responsavel"].str.strip() == responsavel]
        if df_user.empty:
            df_user = df[df["Responsavel"].str.strip() == "Casal"]
        if df_user.empty:
            return cfg

        kv: dict[str, str] = {}
        for _, row in df_user.iterrows():
            key = str(row.get("Chave", "")).strip().lower()
            val = str(row.get("Valor", "")).strip()
            if key:
                kv[key] = val

        def _int(k: str, default: int) -> int:
            try:
                return int(float(kv[k]))
            except (KeyError, ValueError, TypeError):
                return default

        def _bool(k: str, default: bool) -> bool:
            try:
                return kv[k].lower() in ("true", "1", "sim", "yes")
            except (KeyError, ValueError):
                return default

        cfg.meta_necessidades = _int("meta_necessidades", cfg.meta_necessidades)
        cfg.meta_desejos = _int("meta_desejos", cfg.meta_desejos)
        cfg.meta_investimento = _int("meta_investimento", cfg.meta_investimento)
        cfg.autonomia_alvo = _int("autonomia_alvo", cfg.autonomia_alvo)
        cfg.auto_gerar_recorrentes = _bool("auto_gerar_recorrentes", cfg.auto_gerar_recorrentes)

        total = cfg.meta_necessidades + cfg.meta_desejos + cfg.meta_investimento
        if total != 100:
            cfg.meta_necessidades = CFG.META_NECESSIDADES
            cfg.meta_desejos = CFG.META_DESEJOS
            cfg.meta_investimento = CFG.META_INVESTIMENTO

        cfg.autonomia_warn = max(1, cfg.autonomia_alvo // 2)

        return cfg
