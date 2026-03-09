"""Utilitários puros — sem dependência de Streamlit.

Extraído do monolito app_homolog.py — Seções 4 e 5 (Utilitários + Validação).
Fonte de verdade: app_homolog.py (as funções aqui devem ser idênticas).
"""
from __future__ import annotations

import html as html_lib
import uuid
import calendar
from datetime import datetime, timedelta, date

from core.config import CFG, MESES_PT, MESES_FULL


# ==============================================================================
# FORMATAÇÃO
# ==============================================================================

def sanitize(text: str) -> str:
    """Escapa HTML para prevenir injeção."""
    return html_lib.escape(str(text))


def _sanitize_for_sheet(value: str) -> str:
    """Remove prefixos perigosos que o Google Sheets interpreta como fórmulas.

    Previne ataques de CSV/Sheet Injection (CWE-1236).
    """
    s = str(value).strip()
    if s and s[0] in ('=', '+', '-', '@', '|', '\t', '\r', '\n'):
        s = "'" + s  # Prefixo de aspas simples neutraliza fórmulas no Sheets
    return s


def generate_id() -> str:
    """Gera ID único de 12 caracteres hex."""
    return uuid.uuid4().hex[:12]


def fmt_brl(val: float) -> str:
    """Formata valor float para padrão BRL: R$ 1.234,56 / -R$ 1.234,56"""
    if val < 0:
        return f"-R$ {abs(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_date(dt: datetime) -> str:
    """Formata datetime para '01 Jan 2025'."""
    return f"{dt.day:02d} {MESES_PT[dt.month]} {dt.year}"


def fmt_month_year(mo: int, yr: int) -> str:
    """Retorna 'Janeiro 2025'."""
    return f"{MESES_FULL[mo]} {yr}"


def end_of_month(year: int, month: int) -> datetime:
    """Retorna datetime do último segundo do mês."""
    last_day = calendar.monthrange(year, month)[1]
    return datetime(year, month, last_day, 23, 59, 59)


def default_form_date(sel_mo: int, sel_yr: int) -> date:
    """Data default para formulários baseada no mês selecionado."""
    now = datetime.now()
    if sel_mo == now.month and sel_yr == now.year:
        return now.date()
    elif (sel_yr < now.year) or (sel_yr == now.year and sel_mo < now.month):
        last_day = calendar.monthrange(sel_yr, sel_mo)[1]
        return date(sel_yr, sel_mo, last_day)
    else:
        return now.date()


def calc_delta(current: float, previous: float) -> float | None:
    """Calcula variação percentual entre dois valores."""
    if previous == 0:
        if current > 0:
            return float("inf")
        if current == 0:
            return None
        return float("-inf")
    return ((current - previous) / abs(previous)) * 100


def _is_future_month(month: int, year: int) -> bool:
    """Verifica se mês/ano é futuro em relação a agora."""
    now = datetime.now()
    return (year > now.year) or (year == now.year and month > now.month)


# ==============================================================================
# VALIDAÇÃO — Idêntico ao monolito app_homolog.py
# ==============================================================================

def validate_transaction(entry: dict) -> tuple[bool, str]:
    """Valida dados de uma transação antes de salvar."""
    desc = entry.get("Descricao", "")
    if not desc or not str(desc).strip():
        return False, "Descrição obrigatória"
    if len(str(desc)) > CFG.MAX_DESC_LENGTH:
        return False, f"Descrição muito longa (máx {CFG.MAX_DESC_LENGTH})"
    entry["Descricao"] = _sanitize_for_sheet(str(desc).strip())

    val = entry.get("Valor")
    if not isinstance(val, (int, float)) or val <= 0:
        return False, "Valor deve ser maior que zero"

    tipo = entry.get("Tipo")
    if tipo not in CFG.TIPOS:
        return False, "Tipo inválido"

    cat = entry.get("Categoria", "")
    if tipo == CFG.TIPO_SAIDA:
        cats_validas = set(CFG.CATEGORIAS_SAIDA) | {CFG.CAT_INVESTIMENTO}
    else:
        cats_validas = set(CFG.CATEGORIAS_ENTRADA)
    if cat not in cats_validas:
        return False, f"Categoria '{cat}' inválida para tipo '{tipo}'"

    if entry.get("Responsavel") not in CFG.RESPONSAVEIS:
        return False, "Responsável inválido"

    dt = entry.get("Data")
    if dt is not None:
        import pandas as pd
        if isinstance(dt, pd.Timestamp) and pd.isna(dt):
            return False, "Data obrigatória"
        if isinstance(dt, pd.Timestamp):
            dt_check = dt.to_pydatetime()
        elif isinstance(dt, date) and not isinstance(dt, datetime):
            dt_check = datetime.combine(dt, datetime.min.time())
        elif isinstance(dt, datetime):
            dt_check = dt
        else:
            return False, "Data inválida"
        now = datetime.now()
        if dt_check > now + timedelta(days=30):
            return False, "Data muito distante no futuro"
        if dt_check.year < 2020:
            return False, "Data muito antiga (anterior a 2020)"

    return True, ""


def validate_asset(entry: dict) -> tuple[bool, str]:
    """Valida dados de um ativo patrimonial antes de salvar."""
    item = entry.get("Item", "")
    if not item or not str(item).strip():
        return False, "Nome do ativo obrigatório"
    if len(str(item)) > CFG.MAX_DESC_LENGTH:
        return False, f"Nome muito longo (máx {CFG.MAX_DESC_LENGTH})"
    val = entry.get("Valor")
    if not isinstance(val, (int, float)) or val <= 0:
        return False, "Valor deve ser maior que zero"
    if entry.get("Responsavel") not in CFG.RESPONSAVEIS:
        return False, "Responsável inválido"
    return True, ""


def validate_recorrente(entry: dict) -> tuple[bool, str]:
    """Valida dados de uma transação recorrente."""
    desc = entry.get("Descricao", "")
    if not desc or not str(desc).strip():
        return False, "Descrição obrigatória"
    if len(str(desc)) > CFG.MAX_DESC_LENGTH:
        return False, f"Descrição muito longa (máx {CFG.MAX_DESC_LENGTH})"

    val = entry.get("Valor")
    if not isinstance(val, (int, float)) or val <= 0:
        return False, "Valor deve ser maior que zero"

    tipo = entry.get("Tipo")
    if tipo not in CFG.TIPOS:
        return False, "Tipo inválido"

    cat = entry.get("Categoria", "")
    if tipo == CFG.TIPO_SAIDA:
        cats_validas = set(CFG.CATEGORIAS_SAIDA) | {CFG.CAT_INVESTIMENTO}
    else:
        cats_validas = set(CFG.CATEGORIAS_ENTRADA)
    if cat not in cats_validas:
        return False, f"Categoria '{cat}' inválida para tipo '{tipo}'"

    if entry.get("Responsavel") not in CFG.RESPONSAVEIS:
        return False, "Responsável inválido"

    dia = entry.get("DiaVencimento")
    if not isinstance(dia, int) or dia < 1 or dia > 28:
        return False, "Dia deve ser entre 1 e 28"

    return True, ""


def validate_orcamento(entry: dict) -> tuple[bool, str]:
    """Valida dados de um orçamento por categoria."""
    cat = entry.get("Categoria", "")
    if not cat or cat not in CFG.CATEGORIAS_SAIDA:
        return False, f"Categoria inválida: '{cat}'"
    limite = entry.get("Limite")
    if not isinstance(limite, (int, float)) or limite <= 0:
        return False, "Limite deve ser maior que zero"
    if entry.get("Responsavel") not in CFG.RESPONSAVEIS:
        return False, "Responsável inválido"
    return True, ""


def validate_passivo(entry: dict) -> tuple[bool, str]:
    """Valida dados de um passivo (I5)."""
    item = entry.get("Item", "")
    if not item or not str(item).strip():
        return False, "Nome do passivo obrigatório"
    if len(str(item)) > CFG.MAX_DESC_LENGTH:
        return False, f"Nome muito longo (máx {CFG.MAX_DESC_LENGTH})"
    val = entry.get("Valor")
    if not isinstance(val, (int, float)) or val <= 0:
        return False, "Valor deve ser maior que zero"
    if entry.get("Responsavel") not in CFG.RESPONSAVEIS:
        return False, "Responsável inválido"
    return True, ""


def check_duplicate(df_month, desc: str, valor: float, data_ref) -> bool:
    """Verifica se existe transação com mesma descrição, valor e data no mês."""
    if df_month.empty:
        return False
    try:
        if isinstance(data_ref, datetime):
            data_check = data_ref.date()
        elif isinstance(data_ref, date):
            data_check = data_ref
        else:
            return False
        mask = (
            (df_month["Descricao"].str.strip().str.lower() == desc.strip().lower()) &
            (df_month["Valor"].round(2) == round(float(valor), 2)) &
            (df_month["Data"].dt.date == data_check)
        )
        return bool(mask.any())
    except Exception:
        return False
