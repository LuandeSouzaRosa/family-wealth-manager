"""Supabase implementation of BaseRepository.

Translates between DataFrame (PascalCase) and PostgreSQL (snake_case).
Uses supabase-py client for all operations.
"""
from __future__ import annotations

import logging
from datetime import datetime

import pandas as pd

from core.config import CFG, UserConfig
from core.repository import BaseRepository
from core.supabase_client import get_supabase_client
from core.utils import generate_id

logger = logging.getLogger("ll_finance")

# ---------------------------------------------------------------------------
# Column mapping: PascalCase (DataFrame) <-> snake_case (PostgreSQL)
# ---------------------------------------------------------------------------
_COL_MAP = {
    "Id": "id",
    "Data": "data",
    "Descricao": "descricao",
    "Valor": "valor",
    "Categoria": "categoria",
    "Tipo": "tipo",
    "Responsavel": "responsavel",
    "Origem": "origem",
    "Tag": "tag",
    "Item": "item",
    "DiaVencimento": "dia_vencimento",
    "Ativo": "ativo",
    "Limite": "limite",
    "Chave": "chave",
    "Timestamp": "timestamp",
    "Usuario": "usuario",
    "Acao": "acao",
    "Planilha": "planilha",
    "Detalhes": "detalhes",
    "Nome": "nome",
    "ValorAlvo": "valor_alvo",
    "ValorAtual": "valor_atual",
    "Prazo": "prazo",
    "DeletadoEm": "deletado_em",
    "Ordem": "ordem",
}

_COL_MAP_REVERSE = {v: k for k, v in _COL_MAP.items()}


def _to_snake(df: pd.DataFrame) -> pd.DataFrame:
    """Rename DataFrame columns from PascalCase to snake_case."""
    return df.rename(columns={k: v for k, v in _COL_MAP.items() if k in df.columns})


def _to_pascal(df: pd.DataFrame) -> pd.DataFrame:
    """Rename DataFrame columns from snake_case to PascalCase."""
    return df.rename(columns={k: v for k, v in _COL_MAP_REVERSE.items() if k in df.columns})


def _rows_to_pascal(rows: list[dict]) -> pd.DataFrame:
    """Convert list of dicts (snake_case) to DataFrame (PascalCase)."""
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    return _to_pascal(df)


def _dict_to_snake(data: dict) -> dict:
    """Convert dict keys from PascalCase to snake_case."""
    return {_COL_MAP.get(k, k.lower()): v for k, v in data.items()}


class SupabaseRepository(BaseRepository):
    """Implementação Supabase do repositório de dados."""

    def __init__(self, client=None):
        self._client = client or get_supabase_client()

    def _select_all(self, table: str) -> list[dict]:
        """Fetch all rows from a Supabase table."""
        result = self._client.table(table).select("*").execute()
        return result.data or []

    # ------------------------------------------------------------------
    # Leitura
    # ------------------------------------------------------------------

    def load_transacoes(self) -> pd.DataFrame:
        expected = list(CFG.COLS_TRANSACAO)
        try:
            rows = self._select_all("transacoes")
            if not rows:
                return pd.DataFrame(columns=expected)
            df = _rows_to_pascal(rows)
            # Drop supabase-only columns
            for col in ["created_at"]:
                if col in df.columns:
                    df = df.drop(columns=[col])
            # Ensure expected columns
            for col in expected:
                if col not in df.columns:
                    df[col] = None
            df["Data"] = pd.to_datetime(df["Data"], errors="coerce")
            df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
            df = df.dropna(subset=["Data"])
            if "Origem" not in df.columns or df["Origem"].isna().all():
                df["Origem"] = CFG.ORIGEM_MANUAL
            df["Origem"] = df["Origem"].fillna(CFG.ORIGEM_MANUAL)
            df["Tag"] = df["Tag"].fillna("").astype(str).str.strip()
            df["Id"] = df["Id"].fillna("").astype(str)
            return df
        except Exception as e:
            logger.error(f"load_transacoes [supabase]: {e}")
            return pd.DataFrame(columns=expected)

    def load_patrimonio(self) -> pd.DataFrame:
        expected = list(CFG.COLS_PATRIMONIO)
        try:
            rows = self._select_all("patrimonio")
            if not rows:
                return pd.DataFrame(columns=expected)
            df = _rows_to_pascal(rows)
            for col in ["created_at", "id"]:
                if col in df.columns:
                    df = df.drop(columns=[col])
            for col in expected:
                if col not in df.columns:
                    df[col] = None
            df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
            return df
        except Exception as e:
            logger.error(f"load_patrimonio [supabase]: {e}")
            return pd.DataFrame(columns=expected)

    def load_recorrentes(self) -> pd.DataFrame:
        expected = list(CFG.COLS_RECORRENTE)
        try:
            rows = self._select_all("recorrentes")
            if not rows:
                return pd.DataFrame(columns=expected)
            df = _rows_to_pascal(rows)
            for col in ["created_at", "id"]:
                if col in df.columns:
                    df = df.drop(columns=[col])
            for col in expected:
                if col not in df.columns:
                    df[col] = None
            df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
            df["DiaVencimento"] = pd.to_numeric(
                df["DiaVencimento"], errors="coerce"
            ).fillna(1).astype(int)
            df["Ativo"] = df["Ativo"].astype(bool)
            return df
        except Exception as e:
            logger.error(f"load_recorrentes [supabase]: {e}")
            return pd.DataFrame(columns=expected)

    def load_orcamentos(self) -> pd.DataFrame:
        expected = list(CFG.COLS_ORCAMENTO)
        try:
            rows = self._select_all("orcamentos")
            if not rows:
                return pd.DataFrame(columns=expected)
            df = _rows_to_pascal(rows)
            for col in ["created_at", "id"]:
                if col in df.columns:
                    df = df.drop(columns=[col])
            for col in expected:
                if col not in df.columns:
                    df[col] = None
            df["Limite"] = pd.to_numeric(df["Limite"], errors="coerce").fillna(0.0)
            return df
        except Exception as e:
            logger.error(f"load_orcamentos [supabase]: {e}")
            return pd.DataFrame(columns=expected)

    def load_config(self) -> pd.DataFrame:
        expected = list(CFG.COLS_CONFIG)
        try:
            rows = self._select_all("configuracoes")
            if not rows:
                return pd.DataFrame(columns=expected)
            df = _rows_to_pascal(rows)
            for col in ["id"]:
                if col in df.columns:
                    df = df.drop(columns=[col])
            for col in expected:
                if col not in df.columns:
                    df[col] = None
            return df
        except Exception as e:
            logger.warning(f"load_config [supabase]: {e}")
            return pd.DataFrame(columns=expected)

    def load_metas(self) -> pd.DataFrame:
        expected = list(CFG.COLS_METAS)
        try:
            rows = self._select_all("metas")
            if not rows:
                return pd.DataFrame(columns=expected)
            df = _rows_to_pascal(rows)
            for col in ["created_at"]:
                if col in df.columns:
                    df = df.drop(columns=[col])
            for col in expected:
                if col not in df.columns:
                    df[col] = None
            df["ValorAlvo"] = pd.to_numeric(df["ValorAlvo"], errors="coerce").fillna(0.0)
            df["ValorAtual"] = pd.to_numeric(df["ValorAtual"], errors="coerce").fillna(0.0)
            df["Ativo"] = df["Ativo"].astype(bool)
            df["Id"] = df["Id"].fillna("").astype(str)
            return df
        except Exception as e:
            logger.warning(f"load_metas [supabase]: {e}")
            return pd.DataFrame(columns=expected)

    def load_passivos(self) -> pd.DataFrame:
        expected = list(CFG.COLS_PASSIVOS)
        try:
            rows = self._select_all("passivos")
            if not rows:
                return pd.DataFrame(columns=expected)
            df = _rows_to_pascal(rows)
            for col in ["created_at", "id"]:
                if col in df.columns:
                    df = df.drop(columns=[col])
            for col in expected:
                if col not in df.columns:
                    df[col] = None
            df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
            return df
        except Exception as e:
            logger.warning(f"load_passivos [supabase]: {e}")
            return pd.DataFrame(columns=expected)

    def load_lixeira(self) -> pd.DataFrame:
        expected = list(CFG.COLS_LIXEIRA)
        try:
            rows = self._select_all("lixeira")
            if not rows:
                return pd.DataFrame(columns=expected)
            df = _rows_to_pascal(rows)
            for col in expected:
                if col not in df.columns:
                    df[col] = None
            df["Data"] = pd.to_datetime(df["Data"], errors="coerce")
            df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
            return df
        except Exception as e:
            logger.warning(f"load_lixeira [supabase]: {e}")
            return pd.DataFrame(columns=expected)

    def load_favoritos(self) -> pd.DataFrame:
        expected = list(CFG.COLS_FAVORITOS)
        try:
            rows = self._select_all("favoritos")
            if not rows:
                return pd.DataFrame(columns=expected)
            df = _rows_to_pascal(rows)
            for col in ["created_at"]:
                if col in df.columns:
                    df = df.drop(columns=[col])
            for col in expected:
                if col not in df.columns:
                    df[col] = None
            df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
            df["Id"] = df["Id"].fillna("").astype(str)
            return df
        except Exception as e:
            logger.warning(f"load_favoritos [supabase]: {e}")
            return pd.DataFrame(columns=expected)

    # ------------------------------------------------------------------
    # Escrita
    # ------------------------------------------------------------------

    def _table_for_worksheet(self, worksheet: str) -> str:
        """Map worksheet name to Supabase table name."""
        mapping = {
            "Transacoes": "transacoes",
            "Patrimonio": "patrimonio",
            "Recorrentes": "recorrentes",
            "Orcamentos": "orcamentos",
            "Configuracoes": "configuracoes",
            "AuditLog": "audit_log",
            "Metas": "metas",
            "Passivos": "passivos",
            "Lixeira": "lixeira",
            "Favoritos": "favoritos",
        }
        return mapping.get(worksheet, worksheet.lower())

    def save_entry(self, data: dict, table: str) -> bool:
        sb_table = self._table_for_worksheet(table)
        if table == "Transacoes" and "Id" not in data:
            data["Id"] = generate_id()
        row = _dict_to_snake(data)
        # Convert date objects to string for JSON
        for k, v in row.items():
            if hasattr(v, "strftime"):
                row[k] = v.strftime("%Y-%m-%d") if k == "data" else str(v)
        try:
            self._client.table(sb_table).insert(row).execute()
            logger.info(f"save_entry OK [{sb_table}]")
            return True
        except Exception as e:
            logger.error(f"save_entry failed [{sb_table}]: {e}")
            return False

    def update_table(self, df: pd.DataFrame, table: str) -> bool:
        sb_table = self._table_for_worksheet(table)
        try:
            # Delete all existing rows
            self._client.table(sb_table).delete().neq("id", "___impossible___").execute()
            # Insert new rows
            if not df.empty:
                df_snake = _to_snake(df.copy())
                records = df_snake.to_dict("records")
                # Convert dates
                for rec in records:
                    for k, v in rec.items():
                        if hasattr(v, "strftime"):
                            rec[k] = v.strftime("%Y-%m-%d") if k == "data" else str(v)
                        if pd.isna(v):
                            rec[k] = None
                # Batch insert (1000 at a time)
                batch_size = 1000
                for i in range(0, len(records), batch_size):
                    batch = records[i:i + batch_size]
                    self._client.table(sb_table).insert(batch).execute()
            logger.info(f"update_table OK [{sb_table}]: {len(df)} rows")
            return True
        except Exception as e:
            logger.error(f"update_table failed [{sb_table}]: {e}")
            return False

    def save_config(self, user_config: UserConfig, responsavel: str) -> bool:
        entries = [
            {"chave": "meta_necessidades", "valor": str(user_config.meta_necessidades), "responsavel": responsavel},
            {"chave": "meta_desejos", "valor": str(user_config.meta_desejos), "responsavel": responsavel},
            {"chave": "meta_investimento", "valor": str(user_config.meta_investimento), "responsavel": responsavel},
            {"chave": "autonomia_alvo", "valor": str(user_config.autonomia_alvo), "responsavel": responsavel},
            {"chave": "auto_gerar_recorrentes", "valor": str(user_config.auto_gerar_recorrentes).lower(), "responsavel": responsavel},
        ]
        try:
            # Delete existing config for this responsavel
            self._client.table("configuracoes").delete().eq(
                "responsavel", responsavel
            ).execute()
            # Insert new config
            self._client.table("configuracoes").insert(entries).execute()
            logger.info(f"save_config OK [{responsavel}]")
            return True
        except Exception as e:
            logger.error(f"save_config failed [supabase]: {e}")
            return False

    def move_to_lixeira(self, rows: pd.DataFrame) -> bool:
        if rows.empty:
            return True
        try:
            df_trash = rows.copy()
            df_trash["DeletadoEm"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for col in CFG.COLS_LIXEIRA:
                if col not in df_trash.columns:
                    df_trash[col] = ""
            df_snake = _to_snake(df_trash[list(CFG.COLS_LIXEIRA)])
            records = df_snake.to_dict("records")
            for rec in records:
                for k, v in rec.items():
                    if hasattr(v, "strftime"):
                        rec[k] = v.strftime("%Y-%m-%d") if k == "data" else str(v)
                    if pd.isna(v):
                        rec[k] = None
            self._client.table("lixeira").upsert(records).execute()
            # Trim to 200 most recent
            all_trash = self._client.table("lixeira").select("id, deletado_em").order(
                "deletado_em", desc=True
            ).execute()
            if all_trash.data and len(all_trash.data) > 200:
                ids_to_delete = [r["id"] for r in all_trash.data[200:]]
                for tid in ids_to_delete:
                    self._client.table("lixeira").delete().eq("id", tid).execute()
            logger.info(f"move_to_lixeira [supabase]: {len(rows)} registros")
            self.log_audit("SOFT_DELETE", "lixeira", f"{len(rows)} transações")
            return True
        except Exception as e:
            logger.warning(f"move_to_lixeira failed [supabase]: {e}")
            return False

    def restore_from_lixeira(self, rows: pd.DataFrame) -> bool:
        if rows.empty:
            return True
        try:
            df_restore = rows.copy()
            if "DeletadoEm" in df_restore.columns:
                df_restore = df_restore.drop(columns=["DeletadoEm"])
            for col in CFG.COLS_TRANSACAO:
                if col not in df_restore.columns:
                    df_restore[col] = ""
            df_snake = _to_snake(df_restore[list(CFG.COLS_TRANSACAO)])
            records = df_snake.to_dict("records")
            for rec in records:
                for k, v in rec.items():
                    if hasattr(v, "strftime"):
                        rec[k] = v.strftime("%Y-%m-%d") if k == "data" else str(v)
                    if pd.isna(v):
                        rec[k] = None
            self._client.table("transacoes").insert(records).execute()
            # Remove from lixeira
            restored_ids = rows["Id"].astype(str).str.strip().tolist()
            for rid in restored_ids:
                self._client.table("lixeira").delete().eq("id", rid).execute()
            logger.info(f"restore_from_lixeira [supabase]: {len(rows)} restauradas")
            self.log_audit("RESTORE", "transacoes", f"{len(rows)} da lixeira")
            return True
        except Exception as e:
            logger.error(f"restore_from_lixeira failed [supabase]: {e}")
            return False

    def log_audit(self, action: str, table: str, details: str = "") -> None:
        try:
            try:
                import streamlit as st
                usuario = st.session_state.get("auth_user", "anônimo")
            except Exception:
                usuario = "anônimo"
            row = {
                "usuario": usuario,
                "acao": action,
                "planilha": table,
                "detalhes": str(details)[:200],
            }
            self._client.table("audit_log").insert(row).execute()
            # Trim to 500
            count_result = self._client.table("audit_log").select(
                "id", count="exact"
            ).execute()
            if count_result.count and count_result.count > 500:
                old = self._client.table("audit_log").select("id").order(
                    "timestamp", desc=False
                ).limit(count_result.count - 500).execute()
                if old.data:
                    for r in old.data:
                        self._client.table("audit_log").delete().eq("id", r["id"]).execute()
        except Exception as e:
            logger.warning(f"Audit log failed [supabase] (non-blocking): {e}")

    def validate_tables(self) -> list[str]:
        tables = [
            "transacoes", "patrimonio", "recorrentes", "orcamentos",
            "configuracoes", "audit_log", "metas", "passivos",
            "lixeira", "favoritos",
        ]
        issues: list[str] = []
        for table in tables:
            try:
                self._client.table(table).select("*").limit(1).execute()
            except Exception as e:
                issues.append(f"{table}: não encontrada ou inacessível — {e}")
                logger.warning(f"[Integridade] {table}: {e}")
        return issues
