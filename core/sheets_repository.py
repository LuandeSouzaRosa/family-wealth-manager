"""Google Sheets implementation of BaseRepository.

Extracted from app_homolog.py section 6 (Data Layer).
Preserves identical behavior — only reorganized into a class.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime

import pandas as pd

from core.config import CFG, UserConfig
from core.repository import BaseRepository
from core.utils import generate_id

logger = logging.getLogger("ll_finance")


def _parse_ativo(val) -> bool:
    """Converte valor para booleano (coluna Ativo)."""
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    return str(val).strip().lower() in ("true", "1", "1.0", "sim", "s", "yes")


def _normalize_strings(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """Normaliza strings de colunas categóricas."""
    for col in columns:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()
    return df


def _serialize_for_sheet(df: pd.DataFrame) -> pd.DataFrame:
    """Serializa DataFrame para gravação na planilha."""
    df_out = df.copy()
    if "Data" in df_out.columns:
        df_out["Data"] = pd.to_datetime(
            df_out["Data"], errors="coerce"
        ).dt.strftime("%Y-%m-%d")
    if "Ativo" in df_out.columns:
        df_out["Ativo"] = df_out["Ativo"].apply(
            lambda x: "TRUE" if _parse_ativo(x) else "FALSE"
        )
    return df_out


class SheetsRepository(BaseRepository):
    """Implementação Google Sheets do repositório de dados."""

    def __init__(self, conn):
        """Inicializa com conexão GSheetsConnection."""
        self._conn = conn

    # ------------------------------------------------------------------
    # Leitura
    # ------------------------------------------------------------------

    def load_transacoes(self) -> pd.DataFrame:
        expected = list(CFG.COLS_TRANSACAO)
        try:
            df = self._conn.read(worksheet="Transacoes")
            df = df.dropna(how="all")
            missing = set(expected) - set(df.columns)
            for col in missing:
                df[col] = None
            if not df.empty:
                df["Data"] = pd.to_datetime(df["Data"], errors="coerce")
                df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
                df = df.dropna(subset=["Data"])
                df = _normalize_strings(df, ["Tipo", "Categoria", "Responsavel", "Descricao"])
                if "Origem" not in df.columns:
                    df["Origem"] = CFG.ORIGEM_MANUAL
                df["Origem"] = df["Origem"].fillna(CFG.ORIGEM_MANUAL)
                if "Tag" not in df.columns:
                    df["Tag"] = ""
                df["Tag"] = df["Tag"].fillna("").astype(str).str.strip()
                if "Id" not in df.columns:
                    df["Id"] = ""
                df["Id"] = df["Id"].fillna("").astype(str)
                empty_ids = df["Id"].str.strip() == ""
                if empty_ids.any():
                    df.loc[empty_ids, "Id"] = [generate_id() for _ in range(empty_ids.sum())]
        except Exception as e:
            logger.error(f"load_transacoes: {e}")
            df = pd.DataFrame(columns=expected)
        return df

    def load_patrimonio(self) -> pd.DataFrame:
        expected = list(CFG.COLS_PATRIMONIO)
        try:
            df = self._conn.read(worksheet="Patrimonio")
            df = df.dropna(how="all")
            missing = set(expected) - set(df.columns)
            for col in missing:
                df[col] = None
            if not df.empty:
                df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
                df = _normalize_strings(df, ["Item", "Responsavel"])
        except Exception as e:
            logger.error(f"load_patrimonio: {e}")
            df = pd.DataFrame(columns=expected)
        return df

    def load_recorrentes(self) -> pd.DataFrame:
        expected = list(CFG.COLS_RECORRENTE)
        try:
            df = self._conn.read(worksheet="Recorrentes")
            df = df.dropna(how="all")
            missing = set(expected) - set(df.columns)
            for col in missing:
                df[col] = None
            if not df.empty:
                df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
                df["DiaVencimento"] = pd.to_numeric(
                    df["DiaVencimento"], errors="coerce"
                ).fillna(1).astype(int)
                df["Ativo"] = df["Ativo"].apply(_parse_ativo)
                df = _normalize_strings(df, ["Descricao", "Tipo", "Categoria", "Responsavel"])
        except Exception as e:
            logger.error(f"load_recorrentes: {e}")
            df = pd.DataFrame(columns=expected)
        return df

    def load_orcamentos(self) -> pd.DataFrame:
        expected = list(CFG.COLS_ORCAMENTO)
        try:
            df = self._conn.read(worksheet="Orcamentos")
            df = df.dropna(how="all")
            missing = set(expected) - set(df.columns)
            for col in missing:
                df[col] = None
            if not df.empty:
                df["Limite"] = pd.to_numeric(df["Limite"], errors="coerce").fillna(0.0)
                df = _normalize_strings(df, ["Categoria", "Responsavel"])
        except Exception as e:
            logger.error(f"load_orcamentos: {e}")
            df = pd.DataFrame(columns=expected)
        return df

    def load_config(self) -> pd.DataFrame:
        expected = list(CFG.COLS_CONFIG)
        try:
            df = self._conn.read(worksheet="Configuracoes")
            df = df.dropna(how="all")
            missing = set(expected) - set(df.columns)
            for col in missing:
                df[col] = None
            if not df.empty:
                df = _normalize_strings(df, ["Chave", "Responsavel"])
        except Exception as e:
            logger.warning(f"load_config: {e}")
            df = pd.DataFrame(columns=expected)
        return df

    def load_metas(self) -> pd.DataFrame:
        expected = list(CFG.COLS_METAS)
        try:
            df = self._conn.read(worksheet="Metas")
            df = df.dropna(how="all")
            missing = set(expected) - set(df.columns)
            for col in missing:
                df[col] = None
            if not df.empty:
                df["ValorAlvo"] = pd.to_numeric(df["ValorAlvo"], errors="coerce").fillna(0.0)
                df["ValorAtual"] = pd.to_numeric(df["ValorAtual"], errors="coerce").fillna(0.0)
                df["Ativo"] = df["Ativo"].apply(_parse_ativo)
                df = _normalize_strings(df, ["Id", "Nome", "Prazo", "Responsavel"])
                if "Id" not in df.columns:
                    df["Id"] = ""
                df["Id"] = df["Id"].fillna("").astype(str)
                empty_ids = df["Id"].str.strip() == ""
                if empty_ids.any():
                    df.loc[empty_ids, "Id"] = [generate_id() for _ in range(empty_ids.sum())]
        except Exception as e:
            logger.warning(f"load_metas: {e}")
            df = pd.DataFrame(columns=expected)
        return df

    def load_passivos(self) -> pd.DataFrame:
        expected = list(CFG.COLS_PASSIVOS)
        try:
            df = self._conn.read(worksheet="Passivos")
            df = df.dropna(how="all")
            missing = set(expected) - set(df.columns)
            for col in missing:
                df[col] = None
            if not df.empty:
                df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
                df = _normalize_strings(df, ["Item", "Responsavel"])
        except Exception as e:
            logger.warning(f"load_passivos: {e}")
            df = pd.DataFrame(columns=expected)
        return df

    def load_lixeira(self) -> pd.DataFrame:
        expected = list(CFG.COLS_LIXEIRA)
        try:
            df = self._conn.read(worksheet="Lixeira")
            df = df.dropna(how="all")
            missing = set(expected) - set(df.columns)
            for col in missing:
                df[col] = None
            if not df.empty:
                df["Data"] = pd.to_datetime(df["Data"], errors="coerce")
                df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
                df = _normalize_strings(df, ["Tipo", "Categoria", "Responsavel", "Descricao"])
        except Exception as e:
            logger.warning(f"load_lixeira: {e}")
            df = pd.DataFrame(columns=expected)
        return df

    def load_favoritos(self) -> pd.DataFrame:
        expected = list(CFG.COLS_FAVORITOS)
        try:
            df = self._conn.read(worksheet="Favoritos")
            df = df.dropna(how="all")
            missing = set(expected) - set(df.columns)
            for col in missing:
                df[col] = None
            if not df.empty:
                df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
                df = _normalize_strings(df, ["Id", "Nome", "Descricao", "Categoria", "Tipo", "Responsavel", "Tag"])
                if "Id" not in df.columns:
                    df["Id"] = ""
                df["Id"] = df["Id"].fillna("").astype(str)
                empty_ids = df["Id"].str.strip() == ""
                if empty_ids.any():
                    df.loc[empty_ids, "Id"] = [generate_id() for _ in range(empty_ids.sum())]
        except Exception as e:
            logger.warning(f"load_favoritos: {e}")
            df = pd.DataFrame(columns=expected)
        return df

    # ------------------------------------------------------------------
    # Escrita
    # ------------------------------------------------------------------

    def save_entry(self, data: dict, table: str) -> bool:
        if table == "Transacoes" and "Id" not in data:
            data["Id"] = generate_id()
        for attempt in range(CFG.SAVE_RETRIES):
            try:
                try:
                    df_curr = self._conn.read(worksheet=table)
                    df_curr = df_curr.dropna(how="all")
                except Exception:
                    df_curr = pd.DataFrame()
                df_new = pd.DataFrame([data])
                df_updated = pd.concat([df_curr, df_new], ignore_index=True)
                df_updated = _serialize_for_sheet(df_updated)
                self._conn.update(worksheet=table, data=df_updated)
                logger.info(f"save_entry OK [{table}]")
                return True
            except Exception as e:
                if attempt == CFG.SAVE_RETRIES - 1:
                    logger.error(f"save_entry failed [{table}]: {e}")
                    return False
                time.sleep(0.5 * (attempt + 1))
        return False

    def update_table(self, df: pd.DataFrame, table: str) -> bool:
        for attempt in range(CFG.SAVE_RETRIES):
            try:
                df_to_save = _serialize_for_sheet(df)
                self._conn.update(worksheet=table, data=df_to_save)
                logger.info(f"update_table OK [{table}]: {len(df)} rows")
                return True
            except Exception as e:
                if attempt == CFG.SAVE_RETRIES - 1:
                    logger.error(f"update_table failed [{table}]: {e}")
                    return False
                time.sleep(0.5 * (attempt + 1))
        return False

    def save_config(self, user_config: UserConfig, responsavel: str) -> bool:
        entries = [
            {"Chave": "meta_necessidades", "Valor": str(user_config.meta_necessidades), "Responsavel": responsavel},
            {"Chave": "meta_desejos", "Valor": str(user_config.meta_desejos), "Responsavel": responsavel},
            {"Chave": "meta_investimento", "Valor": str(user_config.meta_investimento), "Responsavel": responsavel},
            {"Chave": "autonomia_alvo", "Valor": str(user_config.autonomia_alvo), "Responsavel": responsavel},
            {"Chave": "auto_gerar_recorrentes", "Valor": str(user_config.auto_gerar_recorrentes).lower(), "Responsavel": responsavel},
        ]
        try:
            try:
                df_curr = self._conn.read(worksheet="Configuracoes")
                df_curr = df_curr.dropna(how="all")
            except Exception:
                df_curr = pd.DataFrame(columns=list(CFG.COLS_CONFIG))
            if not df_curr.empty and "Responsavel" in df_curr.columns:
                df_curr = df_curr[df_curr["Responsavel"].str.strip() != responsavel].copy()
            df_new = pd.DataFrame(entries)
            df_updated = pd.concat([df_curr, df_new], ignore_index=True)
            self._conn.update(worksheet="Configuracoes", data=df_updated)
            logger.info(f"save_config OK [{responsavel}]")
            return True
        except Exception as e:
            logger.error(f"save_config failed: {e}")
            return False

    def move_to_lixeira(self, rows: pd.DataFrame) -> bool:
        if rows.empty:
            return True
        try:
            try:
                df_lixeira = self._conn.read(worksheet="Lixeira")
                df_lixeira = df_lixeira.dropna(how="all")
            except Exception:
                df_lixeira = pd.DataFrame(columns=list(CFG.COLS_LIXEIRA))
            df_to_trash = rows.copy()
            df_to_trash["DeletadoEm"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for col in CFG.COLS_LIXEIRA:
                if col not in df_to_trash.columns:
                    df_to_trash[col] = ""
            df_updated = pd.concat(
                [df_lixeira, df_to_trash[list(CFG.COLS_LIXEIRA)]], ignore_index=True
            )
            if len(df_updated) > 200:
                df_updated = df_updated.sort_values(
                    "DeletadoEm", ascending=False
                ).head(200).reset_index(drop=True)
            df_updated = _serialize_for_sheet(df_updated)
            self._conn.update(worksheet="Lixeira", data=df_updated)
            logger.info(f"move_to_lixeira: {len(rows)} registros movidos")
            self.log_audit("SOFT_DELETE", "Lixeira", f"{len(rows)} transações")
            return True
        except Exception as e:
            logger.warning(f"move_to_lixeira failed: {e}")
            return False

    def restore_from_lixeira(self, rows: pd.DataFrame) -> bool:
        if rows.empty:
            return True
        try:
            try:
                df_trans = self._conn.read(worksheet="Transacoes")
                df_trans = df_trans.dropna(how="all")
            except Exception:
                df_trans = pd.DataFrame(columns=list(CFG.COLS_TRANSACAO))
            df_restore = rows.copy()
            if "DeletadoEm" in df_restore.columns:
                df_restore = df_restore.drop(columns=["DeletadoEm"])
            for col in CFG.COLS_TRANSACAO:
                if col not in df_restore.columns:
                    df_restore[col] = ""
            df_updated = pd.concat(
                [df_trans, df_restore[list(CFG.COLS_TRANSACAO)]], ignore_index=True
            )
            df_updated = _serialize_for_sheet(df_updated)
            self._conn.update(worksheet="Transacoes", data=df_updated)
            try:
                df_lixeira = self._conn.read(worksheet="Lixeira")
                df_lixeira = df_lixeira.dropna(how="all")
                restored_ids = set(rows["Id"].astype(str).str.strip())
                df_lixeira = df_lixeira[
                    ~df_lixeira["Id"].astype(str).str.strip().isin(restored_ids)
                ]
                df_lixeira = _serialize_for_sheet(df_lixeira)
                self._conn.update(worksheet="Lixeira", data=df_lixeira)
            except Exception:
                pass
            logger.info(f"restore_from_lixeira: {len(rows)} restauradas")
            self.log_audit("RESTORE", "Transacoes", f"{len(rows)} da lixeira")
            return True
        except Exception as e:
            logger.error(f"restore_from_lixeira failed: {e}")
            return False

    def log_audit(self, action: str, table: str, details: str = "") -> None:
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            try:
                import streamlit as st
                usuario = st.session_state.get("auth_user", "anônimo")
            except Exception:
                usuario = "anônimo"
            try:
                df_log = self._conn.read(worksheet="AuditLog")
                df_log = df_log.dropna(how="all")
            except Exception:
                df_log = pd.DataFrame(columns=list(CFG.COLS_AUDIT))
            new_row = pd.DataFrame([{
                "Timestamp": timestamp,
                "Usuario": usuario,
                "Acao": action,
                "Planilha": table,
                "Detalhes": str(details)[:200],
            }])
            df_updated = pd.concat([df_log, new_row], ignore_index=True)
            if len(df_updated) > 500:
                df_updated = df_updated.tail(500).reset_index(drop=True)
            self._conn.update(worksheet="AuditLog", data=df_updated)
        except Exception as e:
            logger.warning(f"Audit log failed (non-blocking): {e}")

    def validate_tables(self) -> list[str]:
        worksheets = {
            "Transacoes": list(CFG.COLS_TRANSACAO),
            "Patrimonio": list(CFG.COLS_PATRIMONIO),
            "Recorrentes": list(CFG.COLS_RECORRENTE),
            "Orcamentos": list(CFG.COLS_ORCAMENTO),
            "Configuracoes": list(CFG.COLS_CONFIG),
            "AuditLog": list(CFG.COLS_AUDIT),
            "Metas": list(CFG.COLS_METAS),
            "Passivos": list(CFG.COLS_PASSIVOS),
            "Lixeira": list(CFG.COLS_LIXEIRA),
            "Favoritos": list(CFG.COLS_FAVORITOS),
        }
        issues: list[str] = []
        for ws_name, expected_cols in worksheets.items():
            try:
                df = self._conn.read(worksheet=ws_name)
                if df is not None and not df.empty:
                    missing = set(expected_cols) - set(df.columns)
                    if missing:
                        issues.append(
                            f"{ws_name}: colunas faltando — {', '.join(sorted(missing))}"
                        )
            except Exception as e:
                issues.append(f"{ws_name}: não encontrada ou inacessível")
                logger.warning(f"[Integridade] {ws_name}: {e}")
        return issues
