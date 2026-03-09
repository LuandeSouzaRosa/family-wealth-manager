"""Family Wealth Manager — Pacote principal.

Re-exporta todos os módulos para acesso simplificado.
"""
from core.config import Config, CFG, UserConfig, MESES_PT, MESES_FULL
from core.models import MonthMetrics
from core.utils import (
    sanitize, _sanitize_for_sheet, generate_id,
    fmt_brl, fmt_date, fmt_month_year,
    end_of_month, default_form_date, calc_delta, _is_future_month,
    validate_transaction, validate_asset, validate_recorrente,
    validate_orcamento, validate_passivo, check_duplicate,
)
from core.auth import verify_password
from core.repository import BaseRepository


def get_repository(backend: str = "sheets", conn=None) -> BaseRepository:
    """Factory — retorna repositório baseado no backend configurado.

    Args:
        backend: "sheets" ou "supabase"
        conn: conexão GSheetsConnection (obrigatório se backend="sheets")

    Returns:
        Instância de BaseRepository
    """
    if backend == "supabase":
        from core.supabase_repository import SupabaseRepository
        return SupabaseRepository()
    else:
        from core.sheets_repository import SheetsRepository
        if conn is None:
            raise ValueError("conn é obrigatório para backend 'sheets'")
        return SheetsRepository(conn)


__all__ = [
    "Config", "CFG", "UserConfig", "MESES_PT", "MESES_FULL",
    "MonthMetrics",
    "sanitize", "_sanitize_for_sheet", "generate_id",
    "fmt_brl", "fmt_date", "fmt_month_year",
    "end_of_month", "default_form_date", "calc_delta", "_is_future_month",
    "validate_transaction", "validate_asset", "validate_recorrente",
    "validate_orcamento", "validate_passivo", "check_duplicate",
    "verify_password",
    "BaseRepository", "get_repository",
]
