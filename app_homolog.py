from __future__ import annotations
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from streamlit_gsheets import GSheetsConnection
from datetime import datetime, timedelta, date
import calendar
import html as html_lib
from dataclasses import dataclass, field
from io import BytesIO
import time
import logging
import uuid
import hashlib
import secrets
import re
from pathlib import Path
import streamlit.components.v1 as stc

# --- Core Modules (Fase 2) ---
from core.config import Config, CFG, UserConfig, MESES_PT, MESES_FULL
from core.models import MonthMetrics
from core.auth import verify_password as _verify_password_core
from core.utils import (
    sanitize, _sanitize_for_sheet, generate_id,
    fmt_brl, fmt_date, fmt_month_year,
    end_of_month, default_form_date, calc_delta, _is_future_month,
    validate_transaction, validate_asset, validate_recorrente,
    validate_orcamento, validate_passivo, check_duplicate,
)


# ==============================================================================
# 1. CONFIGURAÇÃO — Importado de core/ (Fase 2)
# ==============================================================================
# Config, CFG, UserConfig → core/config.py
# MonthMetrics → core/models.py
# MESES_PT, MESES_FULL → core/config.py

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ll_finance")


# ==============================================================================
# 2. SYSTEM BOOT
# ==============================================================================

st.set_page_config(
    page_title="L&L — Finanças",
    page_icon="▮",
    layout="wide",
    initial_sidebar_state="collapsed"
)


# ==============================================================================
# 3. CSS
# ==============================================================================

def inject_css() -> None:
    """Injeta fontes Google, meta tags mobile e CSS externo (T3, M1, M4)."""
    st.markdown(
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, '
        'maximum-scale=1.0, viewport-fit=cover">'
        '<meta name="apple-mobile-web-app-capable" content="yes">'
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
        '<meta name="theme-color" content="#000000">'
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800'
        '&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">',
        unsafe_allow_html=True,
    )
    css_path = Path(__file__).parent / "style.css"
    try:
        css_text = css_path.read_text(encoding="utf-8")
        st.markdown(f"<style>{css_text}</style>", unsafe_allow_html=True)
    except FileNotFoundError:
        logger.error(f"style.css não encontrado em {css_path}")
        st.error("⚠ style.css não encontrado — crie o arquivo no diretório do app")

def _apply_theme() -> None:
    """Aplica tema light/dark via classe CSS no body (V4)."""
    theme = st.session_state.get("theme", "dark")
    if theme == "light":
        stc.html(
            '<script>window.parent.document.body.classList.add("light-theme");</script>',
            height=0,
        )
        st.markdown(_LIGHT_MODE_CSS, unsafe_allow_html=True)
    else:
        stc.html(
            '<script>window.parent.document.body.classList.remove("light-theme");</script>',
            height=0,
        )


_LIGHT_MODE_CSS = """<style>
body.light-theme .stApp,
body.light-theme .stMainBlockContainer,
body.light-theme [data-testid="stAppViewContainer"] {
    background-color: #FAFAFA !important;
}
body.light-theme .stApp { color: #1a1a1a !important; }
body.light-theme .intel-box {
    background: #FFFFFF !important; border-color: #E0E0E0 !important;
}
body.light-theme .intel-title { color: #1a1a1a !important; }
body.light-theme .intel-body { color: #555 !important; }
body.light-theme .kpi-mono {
    background: #FFFFFF !important; border-color: #E0E0E0 !important;
}
body.light-theme .kpi-mono-label { color: #888 !important; }
body.light-theme .kpi-mono-value { color: #1a1a1a !important; }
body.light-theme .kpi-mono-sub { color: #888 !important; }
body.light-theme .autonomia-hero {
    background: #FFFFFF !important; border-color: #E0E0E0 !important;
}
body.light-theme .autonomia-unit { color: #888 !important; }
body.light-theme .autonomia-sub { color: #888 !important; }
body.light-theme .health-badge {
    background: #F5F5F5 !important; border-color: #E0E0E0 !important;
}
body.light-theme .alert-item {
    background: #F5F5F5 !important; border-color: #E0E0E0 !important;
}
body.light-theme .alert-msg { color: #333 !important; }
body.light-theme .projection-box {
    background: #FFFFFF !important; border-color: #E0E0E0 !important;
}
body.light-theme .projection-header { color: #1a1a1a !important; }
body.light-theme .projection-sub { color: #888 !important; }
body.light-theme .projection-track { background: #E8E8E8 !important; }
body.light-theme .score-panel {
    background: #FFFFFF !important; border-color: #E0E0E0 !important;
}
body.light-theme .score-label { color: #888 !important; }
body.light-theme .score-detail-label { color: #555 !important; }
body.light-theme .score-detail-track { background: #E8E8E8 !important; }
body.light-theme .annual-strip {
    background: #FFFFFF !important; border-color: #E0E0E0 !important;
}
body.light-theme .annual-item { color: #555 !important; }
body.light-theme .annual-meta { color: #888 !important; }
body.light-theme .budget-panel {
    background: #FFFFFF !important; border-color: #E0E0E0 !important;
}
body.light-theme .budget-label { color: #555 !important; }
body.light-theme .budget-track { background: #E8E8E8 !important; }
body.light-theme .cat-bar-label { color: #555 !important; }
body.light-theme .cat-bar-track { background: #E8E8E8 !important; }
body.light-theme .cat-bar-value { color: #888 !important; }
body.light-theme .rec-pending-box {
    background: #FFFFFF !important; border-color: #E0E0E0 !important;
}
body.light-theme .rec-card {
    background: #FFFFFF !important; border-color: #E0E0E0 !important;
}
body.light-theme .rec-card-desc { color: #1a1a1a !important; }
body.light-theme .rec-card-meta { color: #888 !important; }
body.light-theme .t-panel {
    background: #FFFFFF !important; border-color: #E0E0E0 !important;
}
body.light-theme .deviation { border-color: #DDD !important; }
body.light-theme .month-nav { color: #1a1a1a !important; }
body.light-theme .status-line { color: #888 !important; }
body.light-theme .tx-card {
    background: #FFFFFF !important; border-color: #E0E0E0 !important;
}
body.light-theme .tx-card-desc { color: #1a1a1a !important; }
body.light-theme .tx-card-meta { color: #888 !important; }
body.light-theme .hist-summary {
    background: #F5F5F5 !important; border-color: #E0E0E0 !important;
}
body.light-theme [style*="background:#0a0a0a"] { background: #F5F5F5 !important; }
body.light-theme [style*="background: #0a0a0a"] { background: #F5F5F5 !important; }
body.light-theme [style*="background:#000000"] { background: #FAFAFA !important; }
body.light-theme [style*="color:#F0F0F0"] { color: #1a1a1a !important; }
body.light-theme [style*="color: #F0F0F0"] { color: #1a1a1a !important; }
body.light-theme [style*="color:#888"] { color: #666 !important; }
body.light-theme [style*="color:#555"] { color: #888 !important; }
body.light-theme [style*="color:#444"] { color: #999 !important; }
body.light-theme [style*="color:#333"] { color: #AAA !important; }
body.light-theme [style*="border-top:1px solid #111"] { border-top-color: #E0E0E0 !important; }
body.light-theme [style*="border:1px solid #1a1a1a"] { border-color: #E0E0E0 !important; }
body.light-theme [style*="background:#111"] { background: #E8E8E8 !important; }
body.light-theme .stTabs [data-baseweb="tab-list"] { border-bottom-color: #E0E0E0 !important; }
body.light-theme .stTabs [data-baseweb="tab"] { color: #555 !important; }
body.light-theme .stTabs [aria-selected="true"] { color: #1a1a1a !important; }
body.light-theme [data-testid="stExpander"] {
    border-color: #E0E0E0 !important; background: #FFFFFF !important;
}
body.light-theme .stButton > button {
    background: #F0F0F0 !important; color: #1a1a1a !important; border-color: #DDD !important;
}
body.light-theme .stButton > button:hover {
    background: #E0E0E0 !important; border-color: #BBB !important;
}
body.light-theme .stDownloadButton > button {
    background: #F0F0F0 !important; color: #1a1a1a !important; border-color: #DDD !important;
}
body.light-theme .stTextInput > div > div > input,
body.light-theme .stNumberInput > div > div > input,
body.light-theme .stSelectbox > div > div,
body.light-theme .stDateInput > div > div > input {
    background: #FFFFFF !important; color: #1a1a1a !important; border-color: #DDD !important;
}
body.light-theme .stMarkdown p,
body.light-theme .stCaption { color: #555 !important; }
/* V5: Heatmap — lighter green palette in light mode */
body.light-theme [style*="background:#0a2a1a"] { background: #c8f7e0 !important; }
body.light-theme [style*="background:#0d3d26"] { background: #8be8b8 !important; }
body.light-theme [style*="background:#115533"] { background: #4dd695 !important; }
/* G3: Challenge borders */
body.light-theme [style*="border-bottom:1px solid #0f0f0f"] { border-bottom-color: #E8E8E8 !important; }
/* Form submit buttons */
body.light-theme .stFormSubmitButton > button {
    background: #FFFFFF !important; color: #00AA88 !important; border-color: #00AA88 !important;
}
body.light-theme .stFormSubmitButton > button:hover {
    background: #00AA88 !important; color: #FFFFFF !important;
}
/* Data editor */
body.light-theme .stDataFrame { border-color: #E0E0E0 !important; }
/* Radio/pills */
body.light-theme [data-baseweb="radio"] label { color: #333 !important; }
/* File uploader */
body.light-theme [data-testid="stFileUploader"] { border-color: #E0E0E0 !important; }
body.light-theme [data-testid="stFileUploader"] section { background: #FFFFFF !important; }
/* Plotly chart backgrounds */
body.light-theme .js-plotly-plot .plot-container { background: transparent !important; }
/* Phase 9: Inline-style overrides for renders with hardcoded colors */
body.light-theme [style*="border-bottom:1px solid #111"] { border-bottom-color: #E0E0E0 !important; }
body.light-theme [style*="border-top:1px solid #0f0f0f"] { border-top-color: #E8E8E8 !important; }
body.light-theme [style*="border-top:1px solid #1a1a1a"] { border-top-color: #E8E8E8 !important; }
body.light-theme [style*="border:1px solid #111"] { border-color: #E0E0E0 !important; }
body.light-theme [style*="border-left:3px solid #1a1a1a"] { border-left-color: #E0E0E0 !important; }
body.light-theme [style*="color:#222"] { color: #BBB !important; }
body.light-theme [style*="background:#0f0f0f"] { background: #F0F0F0 !important; }
</style>"""


# ==============================================================================
# 4. UTILITÁRIOS — Importado de core/utils.py (Fase 2)
# ==============================================================================
# sanitize, _sanitize_for_sheet, generate_id, fmt_brl, fmt_date,
# fmt_month_year, end_of_month, default_form_date, calc_delta,
# _is_future_month → core/utils.py
#
# validate_transaction, validate_asset, validate_recorrente,
# validate_orcamento, validate_passivo, check_duplicate → core/utils.py


def _chart_colors() -> dict:
    """Retorna cores de background/grid para gráficos Plotly baseado no tema ativo."""
    is_light = st.session_state.get("theme") == "light"
    return {
        "paper_bg": "#FAFAFA" if is_light else "#000000",
        "plot_bg": "#FAFAFA" if is_light else "#000000",
        "grid": "#E0E0E0" if is_light else "#111",
        "font_color": "#555" if is_light else "#888",
    }


# ==============================================================================
# 6. CAMADA DE DADOS — Repository Pattern (Fase 4)
# ==============================================================================
# A lógica completa do data layer agora vive em:
#   core/repository.py       — Interface abstrata (ABC)
#   core/sheets_repository.py — Implementação Google Sheets
#   core/supabase_repository.py — Implementação Supabase
# As funções abaixo são wrappers finos para manter compatibilidade
# com o restante do app (motor analítico, UI, etc.).
# ==============================================================================

from core import get_repository, BaseRepository
from core.sheets_repository import _parse_ativo, _serialize_for_sheet


def _get_data_backend() -> str:
    """Retorna backend configurado: 'sheets' ou 'supabase'."""
    try:
        # Top-level key (correto)
        val = st.secrets.get("data_backend")
        if val:
            return val
        # Fallback: dentro de [supabase] (caso TOML esteja com escopo errado)
        sb = st.secrets.get("supabase", {})
        if hasattr(sb, "get"):
            val = sb.get("data_backend")
            if val:
                return val
        return "sheets"
    except Exception:
        return "sheets"


def get_conn() -> GSheetsConnection:
    """Retorna conexão com Google Sheets."""
    return st.connection("gsheets", type=GSheetsConnection)


def _get_repo() -> BaseRepository:
    """Retorna instância do repositório configurado (cached em session_state)."""
    if "_repo" not in st.session_state:
        backend = _get_data_backend()
        if backend == "supabase":
            st.session_state["_repo"] = get_repository(backend="supabase")
        else:
            conn = get_conn()
            st.session_state["_repo"] = get_repository(backend="sheets", conn=conn)
        logger.info(f"Repository inicializado: {backend}")
    return st.session_state["_repo"]


def _normalize_strings(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """Normaliza strings de colunas categóricas."""
    for col in columns:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()
    return df


@st.cache_data(ttl=CFG.CACHE_TTL)
def load_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Carrega transações e patrimônio."""
    repo = _get_repo()
    return repo.load_transacoes(), repo.load_patrimonio()


@st.cache_data(ttl=CFG.CACHE_TTL)
def load_recorrentes() -> pd.DataFrame:
    """Carrega transações recorrentes."""
    return _get_repo().load_recorrentes()


@st.cache_data(ttl=CFG.CACHE_TTL)
def load_orcamentos() -> pd.DataFrame:
    """Carrega orçamentos por categoria."""
    return _get_repo().load_orcamentos()


@st.cache_data(ttl=CFG.CACHE_TTL)
def load_config() -> pd.DataFrame:
    """Carrega configurações do usuário."""
    return _get_repo().load_config()


@st.cache_data(ttl=CFG.CACHE_TTL)
def load_metas() -> pd.DataFrame:
    """Carrega metas financeiras."""
    return _get_repo().load_metas()


@st.cache_data(ttl=CFG.CACHE_TTL)
def load_passivos() -> pd.DataFrame:
    """Carrega passivos (dívidas/financiamentos)."""
    return _get_repo().load_passivos()


@st.cache_data(ttl=CFG.CACHE_TTL)
def load_lixeira() -> pd.DataFrame:
    """Carrega transações da lixeira."""
    return _get_repo().load_lixeira()


@st.cache_data(ttl=CFG.CACHE_TTL)
def load_favoritos() -> pd.DataFrame:
    """Carrega favoritos de lançamento."""
    return _get_repo().load_favoritos()


def _move_to_lixeira(rows: pd.DataFrame) -> bool:
    """Move transações para a lixeira (soft delete)."""
    result = _get_repo().move_to_lixeira(rows)
    if result:
        st.cache_data.clear()
    return result


def _restore_from_lixeira(rows: pd.DataFrame) -> bool:
    """Restaura transações da lixeira."""
    result = _get_repo().restore_from_lixeira(rows)
    if result:
        st.cache_data.clear()
    return result


def save_config(user_config: UserConfig, responsavel: str) -> bool:
    """Salva configurações do usuário."""
    result = _get_repo().save_config(user_config, responsavel)
    if result:
        st.cache_data.clear()
        _log_audit("CONFIG", "Configuracoes", f"Perfil: {responsavel}")
    else:
        st.error("Erro ao salvar configurações")
    return result


def _log_audit(action: str, worksheet: str, details: str = "") -> None:
    """Registra ação no audit log (fire-and-forget)."""
    try:
        _get_repo().log_audit(action, worksheet, details)
    except Exception as e:
        logger.warning(f"Audit log failed (non-blocking): {e}")


def _check_rate_limit(action: str = "save", cooldown: float = 2.0) -> bool:
    """Verifica rate limit por ação. Retorna True se permitido."""
    key = f"_rl_{action}"
    now = time.time()
    last = st.session_state.get(key, 0.0)
    if now - last < cooldown:
        return False
    st.session_state[key] = now
    return True


def save_entry(data: dict, worksheet: str, *, skip_audit: bool = False, skip_rate_limit: bool = False) -> bool:
    """Salva uma nova entrada com retry e rate limit."""
    if not skip_rate_limit and not _check_rate_limit(f"save_{worksheet}"):
        st.toast("⚠ Aguarde antes de salvar novamente")
        return False
    if worksheet == "Transacoes" and "Id" not in data:
        data["Id"] = generate_id()
    result = _get_repo().save_entry(data, worksheet)
    if result:
        st.cache_data.clear()
        if not skip_audit:
            _log_audit("CREATE", worksheet, f"{data.get('Descricao', data.get('Item', data.get('Chave', '')))}")
    else:
        st.error(f"Falha ao salvar em {worksheet}")
    return result


def update_sheet(df_edited: pd.DataFrame, worksheet: str) -> bool:
    """Atualiza planilha/tabela inteira com DataFrame editado."""
    if not _check_rate_limit(f"update_{worksheet}"):
        st.toast("⚠ Aguarde antes de salvar novamente")
        return False
    result = _get_repo().update_table(df_edited, worksheet)
    if result:
        st.cache_data.clear()
        _log_audit("UPDATE", worksheet, f"{len(df_edited)} registros")
    else:
        st.error(f"Erro ao atualizar {worksheet}")
    return result


def validate_worksheets() -> None:
    """Valida integridade das tabelas no boot (S4 + T5)."""
    if st.session_state.get("_ws_validated", False):
        return
    issues = _get_repo().validate_tables()
    if issues:
        for issue in issues:
            logger.warning(f"[Integridade] {issue}")
    else:
        logger.info("Integridade OK — todas as tabelas validadas")
    st.session_state["_ws_validated"] = True


# ==============================================================================
# 7. MOTOR ANALÍTICO  Importado de core/engine.py (Fase 5)
# ==============================================================================
from core.engine import (
    filter_by_user, filter_by_month,
    detect_pending_recorrentes, compute_budget,
    compute_projection, compute_alerts,
    compute_metrics, _compute_health, compute_score,
    compute_annual_summary, compute_evolution,
    compute_renda_evolution, compute_yoy,
    compute_patrimonio_evolution, compute_cashflow_forecast,
    compute_divisao_casal, compute_weekday_pattern,
    compute_tag_summary, compute_category_sparklines,
    _sparkline_html, compute_savings_rate, compute_consistency,
    compute_anomalies, compute_calendar_heatmap,
    compute_frequent_transactions, compute_meta_progress,
    compute_challenges,
    _BANK_FORMATS, _AUTO_CAT_RULES,
    _auto_categorize, _find_csv_col, parse_bank_csv,
)

def generate_recorrentes(
    pendentes: pd.DataFrame,
    target_month: int,
    target_year: int,
) -> dict | None:
    """Gera transações a partir das recorrentes pendentes.

    Cria uma transação para cada recorrente pendente com
    Origem='Recorrente' e data baseada no DiaVencimento.
    Retorna dict com resumo ou None se falhar.
    """
    if pendentes.empty:
        return None

    last_day = calendar.monthrange(target_year, target_month)[1]
    entries_ok = 0
    n_entradas = 0
    n_saidas = 0
    total_valor = 0.0

    for _, rec in pendentes.iterrows():
        dia = int(rec.get("DiaVencimento", 1))
        dia_real = min(dia, last_day)
        data_lancamento = date(target_year, target_month, dia_real)

        entry = {
            "Id": generate_id(),
            "Data": data_lancamento,
            "Descricao": str(rec["Descricao"]).strip(),
            "Valor": float(rec["Valor"]),
            "Categoria": str(rec["Categoria"]).strip(),
            "Tipo": str(rec["Tipo"]).strip(),
            "Responsavel": str(rec["Responsavel"]).strip(),
            "Origem": CFG.ORIGEM_RECORRENTE,
        }

        ok, err = validate_transaction(entry)
        if ok:
            if save_entry(entry, "Transacoes", skip_audit=True, skip_rate_limit=True):
                entries_ok += 1
                total_valor += float(rec["Valor"])
                if str(rec["Tipo"]).strip() == CFG.TIPO_ENTRADA:
                    n_entradas += 1
                else:
                    n_saidas += 1

    if entries_ok > 0:
        logger.info(f"generate_recorrentes: {entries_ok} geradas para {target_month}/{target_year}")
        _log_audit("BATCH_CREATE", "Transacoes", f"{entries_ok} recorrentes em {target_month}/{target_year}")
        return {
            "count": entries_ok,
            "entradas": n_entradas,
            "saidas": n_saidas,
            "total": total_valor,
        }
    return None

# ==============================================================================
# 8. COMPONENTES VISUAIS
# ==============================================================================

def render_autonomia(val: float, sobrevivencia: float, user_config: UserConfig | None = None) -> None:
    """Renderiza hero de autonomia financeira."""
    ucfg = user_config or UserConfig()
    if val >= 999:
        display_text = "∞"
        color = "#00FFCC"
    else:
        display_text = f"{min(val, 999):.1f}"
        if val >= ucfg.autonomia_alvo:
            color = "#00FFCC"
        elif val >= ucfg.autonomia_warn:
            color = "#FFAA00"
        else:
            color = "#FF4444"

    if val >= 999:
        unit_text = "sem gastos recorrentes"
    else:
        unit_text = "meses de tranquilidade"

    st.markdown(f"""
    <div class="autonomia-hero">
        <div class="autonomia-tag">▮ Autonomia Financeira</div>
        <div class="autonomia-number" style="color: {color};">{display_text}</div>
        <div class="autonomia-unit">{unit_text}</div>
        <div class="autonomia-sub">Patrimônio acumulado: {fmt_brl(sobrevivencia)}</div>
    </div>
    """, unsafe_allow_html=True)


def render_health_badge(health: str, month_label: str, tx_count: int = 0) -> None:
    """Renderiza badge de saúde do mês."""
    config = {
        "excellent": ("● Mês excelente", "health-excellent"),
        "good":      ("● Mês saudável", "health-good"),
        "warning":   ("● Atenção necessária", "health-warning"),
        "danger":    ("● Mês crítico", "health-danger"),
        "neutral":   ("○ Sem dados suficientes", "health-good"),
    }
    label, cls = config.get(health, config["neutral"])
    count_text = f" · {tx_count} lançamentos" if tx_count > 0 else ""
    st.markdown(
        f'<div class="health-badge {cls}">{label} — {sanitize(month_label)}{count_text}</div>',
        unsafe_allow_html=True
    )


def render_alerts(alerts: list[dict]) -> None:
    """Renderiza lista de alertas inteligentes."""
    if not alerts:
        return
    html = '<div class="alerts-container">'
    for a in alerts:
        cls = f"alert-{a['level']}"
        html += f"""
        <div class="alert-item {cls}">
            <span class="alert-icon">{a['icon']}</span>
            <span class="alert-msg">{a['msg']}</span>
        </div>"""
    html += "</div>"
    st.markdown(html, unsafe_allow_html=True)


def render_projection(proj: dict | None, mx: MonthMetrics) -> None:
    """Renderiza barra de projeção de fim de mês."""
    if proj is None:
        return

    if proj["projected_deficit"]:
        fill_color = "#FF4444"
        proj_color = "#FF4444"
    elif proj["renda_projected_pct"] > 90:
        fill_color = "#FFAA00"
        proj_color = "#FFAA00"
    else:
        fill_color = "#00FFCC"
        proj_color = "#00FFCC"

    actual_pct = min(100, proj["renda_consumed_pct"])
    projected_pct = min(100, proj["renda_projected_pct"])
    time_pct = proj["progress_pct"]

    main_text = f"Projeção: {fmt_brl(proj['projected_lifestyle'])}"
    if mx.renda > 0:
        remaining = mx.renda - proj["projected_lifestyle"]
        if remaining >= 0:
            sub_text = f"Sobra projetada: {fmt_brl(remaining)} | Ritmo: {fmt_brl(proj['daily_rate'])}/dia"
        else:
            sub_text = f"Déficit projetado: {fmt_brl(abs(remaining))} | Ritmo: {fmt_brl(proj['daily_rate'])}/dia"
    else:
        sub_text = f"Ritmo: {fmt_brl(proj['daily_rate'])}/dia | Sem renda registrada"

    st.markdown(f"""
    <div class="projection-box">
        <div class="projection-header">
            ◆ Projeção de Gastos — Dia {proj['day']}/{proj['days_total']}
        </div>
        <div class="projection-track">
            <div class="projection-fill-actual"
                 style="width:{actual_pct:.0f}%; background:{fill_color}; opacity:0.7;">
            </div>
            <div class="projection-fill-actual"
                 style="width:{projected_pct:.0f}%; background:{fill_color}; opacity:0.15;">
            </div>
            <div class="projection-marker" style="left:{time_pct:.0f}%;"></div>
        </div>
        <div class="projection-labels">
            <span>Gasto: {fmt_brl(mx.lifestyle)}</span>
            <span style="color:{proj_color};">→ {fmt_brl(proj['projected_lifestyle'])}</span>
            <span>Renda: {fmt_brl(mx.renda)}</span>
        </div>
        <div class="projection-main" style="color:{proj_color};">{main_text}</div>
        <div class="projection-sub">{sub_text}</div>
    </div>
    """, unsafe_allow_html=True)


def _format_delta_html(delta: float | None, delta_invert: bool = False) -> str:
    """Formata delta para HTML, tratando inf (novo) e zero."""
    if delta is None:
        return ""
    if delta == float("inf"):
        return '<div class="kpi-delta kpi-delta-up">vs anterior: novo</div>'
    if delta == float("-inf"):
        return '<div class="kpi-delta kpi-delta-down">vs anterior: zerou</div>'
    if delta_invert:
        cls = "kpi-delta-up" if delta <= 0 else "kpi-delta-down"
    else:
        cls = "kpi-delta-up" if delta >= 0 else "kpi-delta-down"
    if delta == 0:
        cls = "kpi-delta-neutral"
    sinal = "+" if delta > 0 else ""
    return f'<div class="kpi-delta {cls}">vs anterior: {sinal}{delta:.0f}%</div>'


def render_kpi(
    label: str, value: str, sub: str = "",
    delta: float | None = None, delta_invert: bool = False,
) -> None:
    """Renderiza card KPI."""
    delta_html = _format_delta_html(delta, delta_invert)
    st.markdown(f"""
    <div class="kpi-mono">
        <div class="kpi-mono-label">{sanitize(label)}</div>
        <div class="kpi-mono-value">{sanitize(value)}</div>
        <div class="kpi-mono-sub">{sanitize(sub)}</div>
        {delta_html}
    </div>
    """, unsafe_allow_html=True)


def render_intel(title: str, body: str) -> None:
    """Renderiza box de inteligência/insight."""
    st.markdown(f"""
    <div class="intel-box">
        <div class="intel-title">{sanitize(title)}</div>
        <div class="intel-body">{body}</div>
    </div>
    """, unsafe_allow_html=True)


def render_regra_503020(mx: MonthMetrics) -> None:
    """Renderiza barra e badges da regra 50/30/20."""
    total = mx.nec_pct + mx.des_pct + mx.inv_pct
    if total == 0:
        n_w, d_w, i_w = 33, 33, 34
    else:
        n_w = max(1, int(mx.nec_pct / total * 100))
        d_w = max(1, int(mx.des_pct / total * 100))
        i_w = max(1, 100 - n_w - d_w)

    def _badge(label: str, pct: float, delta: float, meta: int) -> str:
        if abs(delta) <= 5:
            cls = "dev-ok"
        elif abs(delta) <= 15:
            cls = "dev-warn"
        else:
            cls = "dev-danger"
        sinal = "+" if delta > 0 else ""
        return (
            f'<span class="deviation {cls}">'
            f'{label} {pct:.0f}% (meta {meta}% | {sinal}{delta:.0f}pp)'
            f'</span>'
        )

    ucfg: UserConfig = mx.user_config
    b_nec = _badge("Necessidades", mx.nec_pct, mx.nec_delta, ucfg.meta_necessidades)
    b_des = _badge("Desejos", mx.des_pct, mx.des_delta, ucfg.meta_desejos)
    b_inv = _badge("Investimento", mx.inv_pct, mx.inv_delta, ucfg.meta_investimento)

    st.markdown(f"""
    <div class="t-panel" style="padding: 12px 16px;">
        <div class="rule-bar-container">
            <div class="rule-bar-seg" style="width:{n_w}%; background:#F0F0F0;"></div>
            <div class="rule-bar-seg" style="width:{d_w}%; background:#FFAA00;"></div>
            <div class="rule-bar-seg" style="width:{i_w}%; background:#00FFCC;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; margin-top:8px; gap:4px;">
            {b_nec}{b_des}{b_inv}
        </div>
    </div>
    """, unsafe_allow_html=True)


def render_cat_breakdown(cat_dict: dict, sparklines: dict | None = None) -> None:
    """Renderiza barras de breakdown por categoria com sparklines opcionais (I4)."""
    if not cat_dict:
        return
    total = sum(cat_dict.values())
    if total == 0:
        return
    html = ""
    for cat, val in cat_dict.items():
        pct = (val / total) * 100
        spark_col = ""
        if sparklines and cat in sparklines:
            _spark = _sparkline_html(sparklines[cat])
            if _spark:
                spark_col = (
                    f'<span class="cat-spark" style="width:52px;flex-shrink:0;'
                    f'text-align:center;line-height:1;">{_spark}</span>'
                )
        html += (
            f'<div class="cat-bar-row">'
            f'<span class="cat-bar-label">{sanitize(str(cat))}</span>'
            f'{spark_col}'
            f'<div class="cat-bar-track">'
            f'<div class="cat-bar-fill" style="width:{pct:.0f}%;"></div>'
            f'</div>'
            f'<span class="cat-bar-value">{pct:.0f}%  {fmt_brl(val)}</span>'
            f'</div>'
        )
    st.markdown(html, unsafe_allow_html=True)


def render_hist_summary(mx: MonthMetrics) -> None:
    """Renderiza resumo do histórico mensal."""
    entradas = mx.renda
    saidas = mx.lifestyle
    investido = mx.investido_mes
    saldo = mx.disponivel
    saldo_color = "#00FFCC" if saldo >= 0 else "#FF4444"
    st.markdown(f"""
    <div class="hist-summary">
        <div class="hist-summary-item">
            <div class="hist-dot" style="background:#00FFCC;"></div>
            <span style="color:#888;">Entradas</span>
            <span style="color:#F0F0F0;">{fmt_brl(entradas)}</span>
            <span style="color:#555;">({mx.month_entradas})</span>
        </div>
        <div class="hist-summary-item">
            <div class="hist-dot" style="background:#FF4444;"></div>
            <span style="color:#888;">Saídas</span>
            <span style="color:#F0F0F0;">{fmt_brl(saidas)}</span>
            <span style="color:#555;">({mx.month_saidas})</span>
        </div>
        <div class="hist-summary-item">
            <div class="hist-dot" style="background:#FFAA00;"></div>
            <span style="color:#888;">Investido</span>
            <span style="color:#F0F0F0;">{fmt_brl(investido)}</span>
            <span style="color:#555;">({mx.month_investimentos})</span>
        </div>
        <div class="hist-summary-item">
            <div class="hist-dot" style="background:{saldo_color};"></div>
            <span style="color:#888;">Saldo</span>
            <span style="color:{saldo_color};">{fmt_brl(saldo)}</span>
        </div>
    </div>
    """, unsafe_allow_html=True)


def render_evolution_chart(evo_data: list[dict]) -> None:
    """Gráfico de evolução: barras empilhadas + linha renda + média móvel + tendência."""
    if not evo_data:
        render_intel("Evolução", "Dados insuficientes para gráfico.")
        return

    labels = [d["label"] for d in evo_data]
    nec = [d["necessidades"] for d in evo_data]
    des = [d["desejos"] for d in evo_data]
    inv = [d["investido"] for d in evo_data]
    renda = [d["renda"] for d in evo_data]
    media_movel = [d.get("media_movel", 0) for d in evo_data]

    fig = go.Figure()

    fig.add_trace(go.Bar(
        name="Necessidades", x=labels, y=nec, marker_color="#F0F0F0"
    ))
    fig.add_trace(go.Bar(
        name="Desejos", x=labels, y=des, marker_color="#FFAA00"
    ))
    fig.add_trace(go.Bar(
        name="Investido", x=labels, y=inv, marker_color="#00FFCC"
    ))

    fig.add_trace(go.Scatter(
        name="Renda",
        x=labels, y=renda,
        mode="lines+markers",
        line=dict(color="#00FFCC", width=2, dash="dot"),
        marker=dict(size=5, color="#00FFCC"),
    ))

    fig.add_trace(go.Scatter(
        name="Média 3m",
        x=labels, y=media_movel,
        mode="lines",
        line=dict(color="#FF4444", width=1.5, dash="dash"),
    ))

    _cc = _chart_colors()
    fig.update_layout(
        barmode="stack",
        paper_bgcolor=_cc["paper_bg"],
        plot_bgcolor=_cc["plot_bg"],
        font=dict(family="JetBrains Mono, monospace", color=_cc["font_color"], size=11),
        legend=dict(
            orientation="h", yanchor="bottom", y=1.02,
            xanchor="center", x=0.5, font=dict(size=9)
        ),
        margin=dict(l=0, r=0, t=30, b=0),
        height=300,
        xaxis=dict(gridcolor=_cc["grid"], showline=False),
        yaxis=dict(gridcolor=_cc["grid"], showline=False, tickformat=",.0f"),
        hovermode="x unified",
        hoverlabel=dict(
            bgcolor="#0a0a0a", bordercolor="#1a1a1a",
            font=dict(family="JetBrains Mono, monospace", size=10, color="#F0F0F0"),
        ),
    )
    st.plotly_chart(fig, use_container_width=True, config={
        "displayModeBar": False,
        "scrollZoom": False,
        "doubleClick": False,
    })

    # --- Indicador de tendência ---
    last = evo_data[-1]
    trend_pct = last.get("trend_pct", 0)
    trend_dir = last.get("trend_direction", "stable")

    if trend_dir == "up":
        trend_icon = "▲"
        trend_color = "#FF4444"
        trend_text = f"Tendência: gastos subindo {abs(trend_pct):.0f}% (média 3m)"
    elif trend_dir == "down":
        trend_icon = "▼"
        trend_color = "#00FFCC"
        trend_text = f"Tendência: gastos caindo {abs(trend_pct):.0f}% (média 3m)"
    else:
        trend_icon = "●"
        trend_color = "#555"
        trend_text = "Tendência: gastos estáveis (média 3m)"

    st.markdown(
        f'<div style="font-family:JetBrains Mono,monospace; font-size:0.65rem; '
        f'color:{trend_color}; padding:4px 0; letter-spacing:0.05em;">'
        f'{trend_icon} {trend_text}</div>',
        unsafe_allow_html=True
    )


def render_budget_bars(budget_data: list[dict]) -> None:
    """Renderiza painel de orçamento por categoria com barras de progresso."""
    if not budget_data:
        return

    total_limite = sum(b["limite"] for b in budget_data)
    total_gasto = sum(b["gasto"] for b in budget_data)
    total_pct = (total_gasto / total_limite * 100) if total_limite > 0 else 0

    rows_html = ""
    for b in budget_data:
        fill_pct = min(100, b["pct"])

        if b["status"] == "over":
            fill_color = "#FF4444"
            pct_cls = "budget-pct-over"
        elif b["status"] == "warn":
            fill_color = "#FFAA00"
            pct_cls = "budget-pct-warn"
        else:
            fill_color = "#00FFCC"
            pct_cls = "budget-pct-ok"

        rows_html += (
            f'<div class="budget-row">'
            f'<span class="budget-label">{sanitize(b["categoria"])}</span>'
            f'<div class="budget-track">'
            f'<div class="budget-fill" style="width:{fill_pct:.0f}%;background:{fill_color};"></div>'
            f'<div class="budget-limit-marker" style="left:100%;"></div>'
            f'</div>'
            f'<div class="budget-info">'
            f'<span>{fmt_brl(b["gasto"])} / {fmt_brl(b["limite"])}</span>'
            f'<span class="budget-pct {pct_cls}">{b["pct"]:.0f}%</span>'
            f'</div>'
            f'</div>'
        )

    if total_pct >= 100:
        total_color = "#FF4444"
    elif total_pct >= 80:
        total_color = "#FFAA00"
    else:
        total_color = "#00FFCC"

    html = (
        f'<div class="budget-panel">'
        f'<div class="budget-header">'
        f'<span>◆ Orçamento Mensal</span>'
        f'<span style="color:{total_color};">{total_pct:.0f}% consumido</span>'
        f'</div>'
        f'{rows_html}'
        f'<div class="budget-total">'
        f'<span>Total orçado: {fmt_brl(total_limite)}</span>'
        f'<span style="color:{total_color};">Gasto: {fmt_brl(total_gasto)}</span>'
        f'</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_pending_box(n_pendentes: int, total_pendente: float) -> None:
    """Renderiza box de recorrentes pendentes."""
    if n_pendentes == 0:
        return
    plural = "s" if n_pendentes > 1 else ""
    html = (
        f'<div class="rec-pending-box">'
        f'<div class="rec-pending-count">{n_pendentes}</div>'
        f'<div class="rec-pending-label">'
        f'recorrente{plural} pendente{plural} — {fmt_brl(total_pendente)}'
        f'</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_recent_context(df_month: pd.DataFrame, tipo: str, n: int = 3) -> None:
    """Mostra últimas N transações do tipo para contexto."""
    if df_month.empty:
        return
    df_tipo = df_month[df_month["Tipo"] == tipo].copy()
    if df_tipo.empty:
        return
    df_tipo["Data"] = pd.to_datetime(df_tipo["Data"], errors="coerce")
    df_tipo = df_tipo.sort_values("Data", ascending=False).head(n)
    html = '<div style="margin-top:8px; padding:8px 0; border-top:1px solid #111;">'
    html += '<div class="intel-title" style="font-size:0.55rem; margin-bottom:6px;">Últimos registros</div>'
    for _, row in df_tipo.iterrows():
        desc = sanitize(str(row.get("Descricao", "")))[:35]
        val = fmt_brl(float(row.get("Valor", 0)))
        cat = sanitize(str(row.get("Categoria", "")))
        html += (
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.6rem;'
            f'color:#555;padding:2px 0;display:flex;justify-content:space-between;">'
            f'<span>{desc}</span>'
            f'<span>{cat} · {val}</span>'
            f'</div>'
        )
    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)

def render_empty_month(month_label: str) -> None:
    """Renderiza onboarding visual para mês sem dados (X4)."""
    steps = [
        ("01", "💰", "Registre sua Renda", "Aba RENDA — salário, freelance, dividendos"),
        ("02", "🔄", "Cadastre Fixos", "Aba FIXOS — aluguel, assinaturas, contas recorrentes"),
        ("03", "⚡", "Lance Gastos", "Lançamento Rápido acima — mercado, uber, restaurante"),
        ("04", "📊", "Acompanhe", "HISTÓRICO — edite, exporte e analise seus dados"),
    ]
    steps_html = ""
    for num, icon, title, desc in steps:
        steps_html += (
            f'<div style="display:flex;align-items:flex-start;gap:12px;'
            f'padding:12px 0;border-bottom:1px solid #0f0f0f;">'
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
            f'color:#00FFCC;min-width:24px;opacity:0.5;">{num}</div>'
            f'<div style="font-size:1.1rem;min-width:24px;">{icon}</div>'
            f'<div>'
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.72rem;'
            f'color:#F0F0F0;font-weight:600;">{title}</div>'
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.6rem;'
            f'color:#555;margin-top:2px;">{desc}</div>'
            f'</div>'
            f'</div>'
        )
    st.markdown(f"""
    <div style="background:#0a0a0a;border:1px solid #1a1a1a;padding:24px;
         margin:16px 0;max-width:500px;margin-left:auto;margin-right:auto;">
        <div style="font-family:JetBrains Mono,monospace;font-size:0.6rem;
             color:#00FFCC;text-transform:uppercase;letter-spacing:0.4em;
             margin-bottom:4px;opacity:0.5;">▮ Primeiros Passos</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:0.85rem;
             color:#F0F0F0;margin-bottom:16px;">
            Nenhuma transação em <strong>{sanitize(month_label)}</strong>
        </div>
        {steps_html}
        <div style="font-family:JetBrains Mono,monospace;font-size:0.5rem;
             color:#333;margin-top:12px;text-align:center;">
            Dica: comece pelo ⚡ Lançamento Rápido acima</div>
    </div>
    """, unsafe_allow_html=True)


def render_score(score_data: dict) -> None:
    """Renderiza painel de score financeiro."""
    s = score_data
    details_html = ""
    for label, pts, max_pts in s["details"]:
        pct = (pts / max_pts * 100) if max_pts > 0 else 0
        if pct >= 80:
            fill_color = "#00FFCC"
        elif pct >= 50:
            fill_color = "#FFAA00"
        else:
            fill_color = "#FF4444"
        details_html += (
            f'<div class="score-detail-row">'
            f'<span class="score-detail-label">{sanitize(label)}</span>'
            f'<div class="score-detail-track">'
            f'<div class="score-detail-fill" style="width:{pct:.0f}%;background:{fill_color};"></div>'
            f'</div>'
            f'<span class="score-detail-pts">{pts:.0f}/{max_pts}</span>'
            f'</div>'
        )

    html = (
        f'<div class="score-panel">'
        f'<div class="score-left">'
        f'<div class="score-label">Score</div>'
        f'<div class="score-value" style="color:{s["color"]};">{s["score"]:.0f}</div>'
        f'<div class="score-grade" style="color:{s["color"]};">{s["grade"]}</div>'
        f'</div>'
        f'<div class="score-right">{details_html}</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_annual_strip(annual: dict | None) -> None:
    """Renderiza strip compacto de resumo anual."""
    if annual is None:
        return

    saldo_color = "#00FFCC" if annual["saldo"] >= 0 else "#FF4444"

    st.markdown(f"""
    <div class="annual-strip">
        <span class="annual-year">▮ {annual['year']}</span>
        <div class="annual-divider"></div>
        <span class="annual-item">Renda <strong>{fmt_brl(annual['renda'])}</strong></span>
        <div class="annual-divider"></div>
        <span class="annual-item">Gastos <strong>{fmt_brl(annual['gastos'])}</strong></span>
        <div class="annual-divider"></div>
        <span class="annual-item">Investido <strong>{fmt_brl(annual['investido'])}</strong></span>
        <div class="annual-divider"></div>
        <span class="annual-item">Saldo <strong style="color:{saldo_color};">{fmt_brl(annual['saldo'])}</strong></span>
        <span class="annual-meta">
            {annual['meses_ativos']} meses · média {fmt_brl(annual['media_gastos'])}/mês · aporte {annual['taxa_aporte']:.0f}%
        </span>
    </div>
    """, unsafe_allow_html=True)

def render_prev_comparison(mx: MonthMetrics, sel_mo: int, sel_yr: int) -> None:
    """Renderiza comparativo compacto com mês anterior."""
    has_prev = mx.prev_renda > 0 or mx.prev_lifestyle > 0 or mx.prev_investido > 0
    if not has_prev:
        return

    prev_mo = sel_mo - 1 if sel_mo > 1 else 12
    prev_yr = sel_yr if sel_mo > 1 else sel_yr - 1
    prev_label = f"{MESES_PT[prev_mo]}/{prev_yr}"
    curr_label = f"{MESES_PT[sel_mo]}/{sel_yr}"

    def _row(label: str, prev_val: float, curr_val: float, delta, invert: bool = False) -> str:
        if delta is None or delta in (float("inf"), float("-inf")):
            delta_html = '<span style="color:#555;">—</span>'
        else:
            if invert:
                color = "#00FFCC" if delta <= 0 else "#FF4444"
            else:
                color = "#00FFCC" if delta >= 0 else "#FF4444"
            sinal = "+" if delta > 0 else ""
            delta_html = f'<span style="color:{color};">{sinal}{delta:.0f}%</span>'
        return (
            f'<div style="display:flex;justify-content:space-between;padding:4px 0;'
            f'font-family:JetBrains Mono,monospace;font-size:0.65rem;">'
            f'<span style="color:#888;width:80px;">{label}</span>'
            f'<span style="color:#555;width:100px;text-align:right;">{fmt_brl(prev_val)}</span>'
            f'<span style="color:#F0F0F0;width:100px;text-align:right;">{fmt_brl(curr_val)}</span>'
            f'<span style="width:50px;text-align:right;">{delta_html}</span>'
            f'</div>'
        )

    header = (
        f'<div style="display:flex;justify-content:space-between;padding:4px 0;'
        f'font-family:JetBrains Mono,monospace;font-size:0.55rem;color:#444;'
        f'border-bottom:1px solid #111;margin-bottom:4px;">'
        f'<span style="width:80px;">Métrica</span>'
        f'<span style="width:100px;text-align:right;">{prev_label}</span>'
        f'<span style="width:100px;text-align:right;">{curr_label}</span>'
        f'<span style="width:50px;text-align:right;">Δ</span>'
        f'</div>'
    )

    rows = (
        _row("Renda", mx.prev_renda, mx.renda, mx.d_renda)
        + _row("Gastos", mx.prev_lifestyle, mx.lifestyle, mx.d_lifestyle, invert=True)
        + _row("Investido", mx.prev_investido, mx.investido_mes, mx.d_investido)
        + _row("Saldo", mx.prev_disponivel, mx.disponivel, mx.d_disponivel)
    )

    html = (
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ vs Mês Anterior</div>'
        f'{header}{rows}'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_aporte_meta(mx: MonthMetrics) -> None:
    """Renderiza barra de progresso da meta de investimento."""
    if mx.renda <= 0:
        return
    ucfg: UserConfig = mx.user_config
    meta_valor = mx.renda * (ucfg.meta_investimento / 100)
    investido = mx.investido_mes
    pct = (investido / meta_valor * 100) if meta_valor > 0 else 0
    fill_pct = min(100, pct)

    if pct >= 100:
        color = "#00FFCC"
        status = "Meta atingida ✓"
    elif pct >= 70:
        color = "#FFAA00"
        status = f"Faltam {fmt_brl(meta_valor - investido)}"
    else:
        color = "#FF4444"
        status = f"Faltam {fmt_brl(meta_valor - investido)}"

    html = (
        f'<div style="font-family:JetBrains Mono,monospace;padding:6px 0 10px 0;">'
        f'<div style="display:flex;justify-content:space-between;font-size:0.6rem;'
        f'color:#555;margin-bottom:4px;">'
        f'<span>Meta Aporte ({ucfg.meta_investimento}%): {fmt_brl(meta_valor)}</span>'
        f'<span style="color:{color};">{pct:.0f}% — {status}</span>'
        f'</div>'
        f'<div style="width:100%;height:4px;background:#111;">'
        f'<div style="width:{fill_pct}%;height:100%;background:{color};'
        f'transition:width 0.4s ease;"></div>'
        f'</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_top_gastos(
    top5: list[dict], ticket_medio: float, split: dict,
    dia_mais_caro: int = 0, dia_mais_caro_val: float = 0.0,
    dia_mais_caro_count: int = 0,
) -> None:
    """Renderiza top 5 gastos + ticket médio + split casal + dia mais caro."""
    if not top5 and ticket_medio <= 0 and not split and dia_mais_caro <= 0:
        return

    html = '<div class="intel-box">'
    html += '<div class="intel-title">◆ Radiografia dos Gastos</div>'

    if top5:
        html += '<div style="margin-bottom:8px;">'
        for i, g in enumerate(top5, 1):
            desc = sanitize(g["desc"])[:30]
            val = fmt_brl(g["valor"])
            cat = sanitize(g["cat"])
            html += (
                f'<div style="font-family:JetBrains Mono,monospace;font-size:0.62rem;'
                f'color:#888;padding:2px 0;display:flex;align-items:center;gap:6px;">'
                f'<span style="color:#555;width:14px;">{i}.</span>'
                f'<span style="flex:1;">{desc}</span>'
                f'<span style="color:#666;">{cat}</span>'
                f'<span style="color:#F0F0F0;min-width:90px;text-align:right;">{val}</span>'
                f'</div>'
            )
        html += '</div>'

    meta_parts = []
    if ticket_medio > 0:
        meta_parts.append(f"Ticket médio: {fmt_brl(ticket_medio)}")
    if dia_mais_caro > 0:
        meta_parts.append(
            f"Dia mais caro: {dia_mais_caro} ({fmt_brl(dia_mais_caro_val)} · {dia_mais_caro_count}tx)"
        )
    if split:
        split_text = " · ".join([f"{sanitize(k)}: {fmt_brl(v)}" for k, v in split.items()])
        meta_parts.append(f"Split: {split_text}")

    if meta_parts:
        html += (
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.6rem;'
            f'color:#555;padding-top:6px;border-top:1px solid #111;">'
            f'{" | ".join(meta_parts)}'
            f'</div>'
        )

    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)


def render_pending_banner(
    pendentes: pd.DataFrame, user: str, sel_mo: int, sel_yr: int,
) -> None:
    """Banner compacto no topo para recorrentes pendentes com ação direta."""
    if pendentes.empty:
        return

    n = len(pendentes)
    total = pendentes["Valor"].sum()
    plural = "s" if n > 1 else ""

    st.markdown(f"""
    <div style="background:#0a0a0a; border:1px solid #FFAA00; border-left:3px solid #FFAA00;
         padding:10px 16px; margin-bottom:8px; font-family:'JetBrains Mono',monospace;">
        <span style="color:#FFAA00; font-size:0.72rem; font-weight:600;">
            ⟳ {n} recorrente{plural} pendente{plural}
        </span>
        <span style="color:#666; font-size:0.62rem; margin-left:8px;">
            {fmt_brl(total)} · {sanitize(fmt_month_year(sel_mo, sel_yr))}
        </span>
    </div>
    """, unsafe_allow_html=True)

    if st.button(
        f"⟳ GERAR {n} RECORRENTE{'S' if n > 1 else ''} AGORA",
        key=f"banner_gen_{user}_{sel_mo}_{sel_yr}",
        use_container_width=True,
    ):
        result = generate_recorrentes(pendentes, sel_mo, sel_yr)
        if result:
            parts = []
            if result["entradas"] > 0:
                parts.append(f"{result['entradas']} entrada{'s' if result['entradas'] > 1 else ''}")
            if result["saidas"] > 0:
                parts.append(f"{result['saidas']} saída{'s' if result['saidas'] > 1 else ''}")
            detail = " + ".join(parts) if parts else ""
            st.toast(f"✓ {result['count']} geradas ({detail}) — {fmt_brl(result['total'])}")
            st.rerun()
        else:
            st.error("Falha ao gerar recorrentes")


def render_split_casal(split_gastos: dict, split_renda: dict) -> None:
    """Renderiza breakdown por responsável no modo Casal."""
    if not split_gastos and not split_renda:
        return

    html = '<div class="intel-box">'
    html += '<div class="intel-title">◆ Divisão por Responsável</div>'
    html += '<div style="display:flex; gap:24px; flex-wrap:wrap;">'

    if split_renda:
        html += '<div style="flex:1; min-width:120px;">'
        html += (
            '<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
            'color:#555;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">'
            'Renda</div>'
        )
        total_renda = sum(split_renda.values())
        for name, val in split_renda.items():
            pct = (val / total_renda * 100) if total_renda > 0 else 0
            html += (
                f'<div style="font-family:JetBrains Mono,monospace;font-size:0.65rem;'
                f'color:#888;padding:3px 0;display:flex;justify-content:space-between;gap:8px;">'
                f'<span>{sanitize(name)}</span>'
                f'<span style="color:#00FFCC;">{fmt_brl(val)} <span style="color:#555;">({pct:.0f}%)</span></span>'
                f'</div>'
            )
        html += '</div>'

    if split_gastos:
        html += '<div style="flex:1; min-width:120px;">'
        html += (
            '<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
            'color:#555;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">'
            'Gastos</div>'
        )
        total_gastos = sum(split_gastos.values())
        for name, val in split_gastos.items():
            pct = (val / total_gastos * 100) if total_gastos > 0 else 0
            html += (
                f'<div style="font-family:JetBrains Mono,monospace;font-size:0.65rem;'
                f'color:#888;padding:3px 0;display:flex;justify-content:space-between;gap:8px;">'
                f'<span>{sanitize(name)}</span>'
                f'<span style="color:#FF4444;">{fmt_brl(val)} <span style="color:#555;">({pct:.0f}%)</span></span>'
                f'</div>'
            )
        html += '</div>'

    html += '</div></div>'
    st.markdown(html, unsafe_allow_html=True)

def render_divisao_casal(divisao: dict | None) -> None:
    """Renderiza card de divisão de despesas do casal com acerto."""
    if divisao is None:
        return

    pessoa_a, pessoa_b = divisao["pessoas"]

    # --- Acerto ---
    if divisao["equilibrado"]:
        acerto_html = (
            '<div style="color:#00FFCC; font-family:JetBrains Mono,monospace; '
            'font-size:0.75rem; font-weight:700; margin-top:12px; padding:10px; '
            'border:1px solid #00FFCC33; text-align:center;">'
            '✓ Despesas equilibradas</div>'
        )
    else:
        acerto_html = (
            f'<div style="color:#FFAA00; font-family:JetBrains Mono,monospace; '
            f'font-size:0.75rem; font-weight:700; margin-top:12px; padding:10px; '
            f'border:1px solid #FFAA0033; text-align:center;">'
            f'⟶ {sanitize(divisao["quem_deve"])} deve '
            f'{fmt_brl(divisao["diferenca"])} '
            f'a {sanitize(divisao["quem_recebe"])}'
            f'</div>'
        )

    # --- Cards por pessoa ---
    persons_html = ""
    for pessoa in [pessoa_a, pessoa_b]:
        ind = divisao["individual"][pessoa]
        justo = divisao["cota_justa"][pessoa]
        persons_html += (
            f'<div style="flex:1; min-width:130px;">'
            f'<div style="font-family:JetBrains Mono,monospace; font-size:0.55rem; '
            f'color:#555; text-transform:uppercase; letter-spacing:0.1em; '
            f'margin-bottom:6px;">{sanitize(pessoa)}</div>'

            f'<div style="font-family:JetBrains Mono,monospace; font-size:0.62rem; '
            f'color:#888; padding:3px 0;">'
            f'Individual: <span style="color:#F0F0F0;">{fmt_brl(ind)}</span></div>'

            f'<div style="font-family:JetBrains Mono,monospace; font-size:0.62rem; '
            f'color:#888; padding:3px 0;">'
            f'+ ½ casal: <span style="color:#F0F0F0;">'
            f'{fmt_brl(divisao["metade_compartilhado"])}</span></div>'

            f'<div style="font-family:JetBrains Mono,monospace; font-size:0.72rem; '
            f'color:#F0F0F0; font-weight:700; padding:6px 0 0 0; '
            f'border-top:1px solid #1a1a1a; margin-top:4px;">'
            f'Cota justa: {fmt_brl(justo)}</div>'
            f'</div>'
        )

    # --- Composição final ---
    html = (
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ Divisão de Despesas — Acerto Mensal</div>'

        f'<div style="display:flex; gap:24px; flex-wrap:wrap; margin-bottom:8px;">'
        f'{persons_html}'
        f'</div>'

        f'<div style="font-family:JetBrains Mono,monospace; font-size:0.58rem; '
        f'color:#444; padding:6px 0; border-top:1px solid #0f0f0f;">'
        f'Compartilhado (Casal): {fmt_brl(divisao["casal_compartilhado"])} '
        f'· Total geral: {fmt_brl(divisao["total_geral"])}'
        f'</div>'

        f'{acerto_html}'

        f'<div style="font-family:JetBrains Mono,monospace; font-size:0.48rem; '
        f'color:#222; margin-top:8px;">'
        f'Nota: gastos com responsável "Casal" são divididos 50/50. '
        f'Para rastreio preciso de quem pagou, use o responsável individual.</div>'

        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_renda_chart(renda_data: list[dict]) -> None:
    """Gráfico de evolução de renda com breakdown por fonte."""
    if not renda_data:
        render_intel("Evolução de Renda", "Dados insuficientes para gráfico.")
        return

    labels = [d["label"] for d in renda_data]

    all_cats: set[str] = set()
    for d in renda_data:
        all_cats.update(d["breakdown"].keys())

    _palette = ["#00FFCC", "#FFAA00", "#F0F0F0", "#888888", "#555555", "#FF4444", "#4488FF", "#AA44FF"]
    cat_colors = {
        "Salário": "#00FFCC",
        "Dividendos": "#FFAA00",
        "Bônus": "#F0F0F0",
        "Extra": "#888888",
        "Reembolso": "#555555",
    }
    for i, cat in enumerate(sorted(all_cats)):
        if cat not in cat_colors:
            cat_colors[cat] = _palette[i % len(_palette)]

    fig = go.Figure()
    for cat in sorted(all_cats):
        vals = [d["breakdown"].get(cat, 0) for d in renda_data]
        color = cat_colors.get(cat, "#666666")
        fig.add_trace(go.Bar(
            name=cat, x=labels, y=vals, marker_color=color,
        ))

    totals = [d["total"] for d in renda_data]
    if len(renda_data) > 1:
        avg = sum(totals) / len(totals)
        fig.add_trace(go.Scatter(
            name="Média",
            x=labels, y=[avg] * len(labels),
            mode="lines",
            line=dict(color="#FF4444", width=1, dash="dash"),
        ))

    _cc = _chart_colors()
    fig.update_layout(
        barmode="stack",
        paper_bgcolor=_cc["paper_bg"],
        plot_bgcolor=_cc["plot_bg"],
        font=dict(family="JetBrains Mono, monospace", color=_cc["font_color"], size=11),
        legend=dict(
            orientation="h", yanchor="bottom", y=1.02,
            xanchor="center", x=0.5, font=dict(size=9),
        ),
        margin=dict(l=0, r=0, t=30, b=0),
        height=280,
        xaxis=dict(gridcolor=_cc["grid"], showline=False),
        yaxis=dict(gridcolor=_cc["grid"], showline=False, tickformat=",.0f"),
        hovermode="x unified",
        hoverlabel=dict(
            bgcolor="#0a0a0a", bordercolor="#1a1a1a",
            font=dict(family="JetBrains Mono, monospace", size=10, color="#F0F0F0"),
        ),
    )
    st.plotly_chart(fig, use_container_width=True, config={
        "displayModeBar": False,
        "scrollZoom": False,
        "doubleClick": False,
    })

    if len(renda_data) >= 2:
        curr = renda_data[-1]["total"]
        prev = renda_data[-2]["total"]
        if prev > 0:
            var = ((curr - prev) / prev) * 100
            if var > 0:
                var_text = f"▲ Renda +{var:.0f}% vs mês anterior"
                var_color = "#00FFCC"
            elif var < 0:
                var_text = f"▼ Renda {var:.0f}% vs mês anterior"
                var_color = "#FF4444"
            else:
                var_text = "● Renda estável vs mês anterior"
                var_color = "#555"
            st.markdown(
                f'<div style="font-family:JetBrains Mono,monospace;font-size:0.65rem;'
                f'color:{var_color};padding:4px 0;letter-spacing:0.05em;">'
                f'{var_text}</div>',
                unsafe_allow_html=True,
            )

def render_patrimonio_chart(pat_data: list[dict]) -> None:
    """Gráfico de evolução patrimonial: área + barras de aportes."""
    if not pat_data:
        render_intel("Evolução Patrimonial", "Dados insuficientes para gráfico.")
        return

    labels = [d["label"] for d in pat_data]
    patrimonio = [d["patrimonio"] for d in pat_data]
    aportes = [d["aporte_mes"] for d in pat_data]

    fig = go.Figure()

    # Área: patrimônio total
    fig.add_trace(go.Scatter(
        name="Patrimônio",
        x=labels, y=patrimonio,
        mode="lines+markers",
        fill="tozeroy",
        line=dict(color="#00FFCC", width=2),
        marker=dict(size=5, color="#00FFCC"),
        fillcolor="rgba(0,255,204,0.08)",
    ))

    # Barras: aportes mensais
    fig.add_trace(go.Bar(
        name="Aporte/mês",
        x=labels, y=aportes,
        marker_color="rgba(255,170,0,0.6)",
    ))

    _cc = _chart_colors()
    fig.update_layout(
        paper_bgcolor=_cc["paper_bg"],
        plot_bgcolor=_cc["plot_bg"],
        font=dict(family="JetBrains Mono, monospace", color=_cc["font_color"], size=11),
        legend=dict(
            orientation="h", yanchor="bottom", y=1.02,
            xanchor="center", x=0.5, font=dict(size=9),
        ),
        margin=dict(l=0, r=0, t=30, b=0),
        height=280,
        xaxis=dict(gridcolor=_cc["grid"], showline=False),
        yaxis=dict(gridcolor=_cc["grid"], showline=False, tickformat=",.0f"),
        barmode="overlay",
        hovermode="x unified",
        hoverlabel=dict(
            bgcolor="#0a0a0a", bordercolor="#1a1a1a",
            font=dict(family="JetBrains Mono, monospace", size=10, color="#F0F0F0"),
        ),
    )
    st.plotly_chart(fig, use_container_width=True, config={
        "displayModeBar": False,
        "scrollZoom": False,
        "doubleClick": False,
    })

    # Variação
    if len(pat_data) >= 2:
        curr = pat_data[-1]["patrimonio"]
        prev = pat_data[-2]["patrimonio"]
        diff = curr - prev
        if diff > 0:
            var_text = f"▲ Patrimônio +{fmt_brl(diff)} vs mês anterior"
            var_color = "#00FFCC"
        elif diff < 0:
            var_text = f"▼ Patrimônio {fmt_brl(diff)} vs mês anterior"
            var_color = "#FF4444"
        else:
            var_text = "● Patrimônio estável vs mês anterior"
            var_color = "#555"
        st.markdown(
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.65rem;'
            f'color:{var_color};padding:4px 0;letter-spacing:0.05em;">'
            f'{var_text}</div>',
            unsafe_allow_html=True,
        )

def render_yoy(yoy: dict | None) -> None:
    """Renderiza comparação year-over-year."""
    if yoy is None:
        return

    month_name = MESES_FULL[yoy["month"]]

    def _row(label: str, prev_val: float, curr_val: float, delta, invert: bool = False) -> str:
        if delta is None or delta in (float("inf"), float("-inf")):
            delta_html = '<span style="color:#555;">—</span>'
        else:
            if invert:
                color = "#00FFCC" if delta <= 0 else "#FF4444"
            else:
                color = "#00FFCC" if delta >= 0 else "#FF4444"
            sinal = "+" if delta > 0 else ""
            delta_html = f'<span style="color:{color};">{sinal}{delta:.0f}%</span>'
        return (
            f'<div style="display:flex;justify-content:space-between;padding:4px 0;'
            f'font-family:JetBrains Mono,monospace;font-size:0.65rem;">'
            f'<span style="color:#888;width:80px;">{label}</span>'
            f'<span style="color:#555;width:100px;text-align:right;">{fmt_brl(prev_val)}</span>'
            f'<span style="color:#F0F0F0;width:100px;text-align:right;">{fmt_brl(curr_val)}</span>'
            f'<span style="width:50px;text-align:right;">{delta_html}</span>'
            f'</div>'
        )

    header = (
        f'<div style="display:flex;justify-content:space-between;padding:4px 0;'
        f'font-family:JetBrains Mono,monospace;font-size:0.55rem;color:#444;'
        f'border-bottom:1px solid #111;margin-bottom:4px;">'
        f'<span style="width:80px;">Métrica</span>'
        f'<span style="width:100px;text-align:right;">{month_name[:3]}/{yoy["prev_year"]}</span>'
        f'<span style="width:100px;text-align:right;">{month_name[:3]}/{yoy["curr_year"]}</span>'
        f'<span style="width:50px;text-align:right;">Δ</span>'
        f'</div>'
    )

    rows = (
        _row("Renda", yoy["prev"]["renda"], yoy["curr"]["renda"], yoy["d_renda"])
        + _row("Gastos", yoy["prev"]["gastos"], yoy["curr"]["gastos"], yoy["d_gastos"], invert=True)
        + _row("Investido", yoy["prev"]["investido"], yoy["curr"]["investido"], yoy["d_investido"])
        + _row("Saldo", yoy["prev"]["saldo"], yoy["curr"]["saldo"], yoy["d_saldo"])
    )

    st.markdown(
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ {sanitize(month_name)} — Ano vs Ano</div>'
        f'{header}{rows}'
        f'</div>',
        unsafe_allow_html=True,
    )

def render_cashflow_forecast(forecast: list[dict] | None) -> None:
    """Renderiza tabela de forecast de cashflow para próximos meses."""
    if not forecast:
        return

    n = len(forecast)

    # Header
    header_cells = ""
    for f in forecast:
        header_cells += (
            f'<span style="flex:1;text-align:right;color:#F0F0F0;'
            f'font-weight:600;">{f["label"]}</span>'
        )

    def make_row(label: str, key: str, color: str) -> str:
        cells = ""
        for fc in forecast:
            cells += (
                f'<span style="flex:1;text-align:right;color:{color};">'
                f'{fmt_brl(fc[key])}</span>'
            )
        return (
            f'<div style="display:flex;gap:8px;padding:4px 0;'
            f'font-family:JetBrains Mono,monospace;font-size:0.62rem;">'
            f'<span style="width:90px;color:#555;">{label}</span>'
            f'{cells}</div>'
        )

    # Saldo row (cor por célula)
    saldo_cells = ""
    for f in forecast:
        s_color = "#00FFCC" if f["saldo"] >= 0 else "#FF4444"
        saldo_cells += (
            f'<span style="flex:1;text-align:right;color:{s_color};'
            f'font-weight:700;">{fmt_brl(f["saldo"])}</span>'
        )
    saldo_row = (
        f'<div style="display:flex;gap:8px;padding:6px 0;'
        f'border-top:1px solid #1a1a1a;'
        f'font-family:JetBrains Mono,monospace;font-size:0.62rem;margin-top:4px;">'
        f'<span style="width:90px;color:#555;font-weight:700;">Saldo</span>'
        f'{saldo_cells}</div>'
    )

    # Acumulado row
    acum_cells = ""
    for f in forecast:
        a_color = "#00FFCC" if f["saldo_acumulado"] >= 0 else "#FF4444"
        acum_cells += (
            f'<span style="flex:1;text-align:right;color:{a_color};">'
            f'{fmt_brl(f["saldo_acumulado"])}</span>'
        )
    acum_row = (
        f'<div style="display:flex;gap:8px;padding:2px 0;'
        f'font-family:JetBrains Mono,monospace;font-size:0.55rem;">'
        f'<span style="width:90px;color:#444;">Acumulado</span>'
        f'{acum_cells}</div>'
    )

    # Insight
    any_deficit = any(f["deficit"] for f in forecast)
    if any_deficit:
        nota_color = "#FF4444"
        nota_text = "⚠ Projeção indica meses com déficit — revise gastos ou aumente renda"
    else:
        avg_saldo = sum(f["saldo"] for f in forecast) / n
        nota_color = "#00FFCC"
        nota_text = f"Saldo médio projetado: {fmt_brl(avg_saldo)}/mês"

    # Composição fixa/variável
    f0 = forecast[0]
    comp_parts: list[str] = []
    if f0["renda_fixa"] > 0:
        comp_parts.append(f"Renda fixa: {fmt_brl(f0['renda_fixa'])}")
    if f0["renda_variavel"] > 0:
        comp_parts.append(f"Renda var: {fmt_brl(f0['renda_variavel'])}")
    if f0["gastos_fixos"] > 0:
        comp_parts.append(f"Fixos: {fmt_brl(f0['gastos_fixos'])}")
    if f0["gastos_variaveis"] > 0:
        comp_parts.append(f"Variáveis: {fmt_brl(f0['gastos_variaveis'])}")
    comp_text = " · ".join(comp_parts) if comp_parts else ""

    html = (
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ Forecast Cashflow — {n} meses</div>'
        f'<div style="display:flex;gap:8px;padding:4px 0 8px 0;'
        f'font-family:JetBrains Mono,monospace;font-size:0.55rem;'
        f'border-bottom:1px solid #111;margin-bottom:4px;">'
        f'<span style="width:90px;color:#444;">Projeção</span>'
        f'{header_cells}</div>'
        f'{make_row("Renda", "renda", "#00FFCC")}'
        f'{make_row("Gastos", "gastos", "#FF4444")}'
        f'{make_row("Investido", "investimento", "#FFAA00")}'
        f'{saldo_row}'
        f'{acum_row}'
        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.58rem;'
        f'color:{nota_color};margin-top:10px;">{nota_text}</div>'
    )

    if comp_text:
        html += (
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.5rem;'
            f'color:#333;margin-top:4px;">{comp_text}</div>'
        )

    html += (
        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.48rem;'
        f'color:#222;margin-top:4px;">Base: recorrentes ativas + média variável (3 meses)</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_weekday_pattern(pattern: dict | None) -> None:
    """Renderiza padrão de gastos por dia da semana."""
    if not pattern or not pattern.get("dias"):
        return
    max_val = pattern["max_val"]
    if max_val == 0:
        return

    html = '<div class="intel-box">'
    html += '<div class="intel-title">◆ Padrão por Dia da Semana</div>'

    for d in pattern["dias"]:
        pct = (d["total"] / max_val * 100) if max_val > 0 else 0
        count_text = f'{d["count"]}tx' if d["count"] > 0 else "—"
        val_text = fmt_brl(d["total"]) if d["total"] > 0 else "—"
        if pct >= 80:
            bar_color = "#FF4444"
        elif pct >= 50:
            bar_color = "#FFAA00"
        elif pct > 0:
            bar_color = "#00FFCC"
        else:
            bar_color = "#111"
        html += (
            f'<div class="cat-bar-row">'
            f'<span class="cat-bar-label" style="width:36px;">{d["dia"]}</span>'
            f'<div class="cat-bar-track">'
            f'<div class="cat-bar-fill" style="width:{pct:.0f}%;background:{bar_color};"></div>'
            f'</div>'
            f'<span class="cat-bar-value" style="width:130px;">{count_text} · {val_text}</span>'
            f'</div>'
        )

    if "mais_caro" in pattern and "mais_leve" in pattern:
        mc = pattern["mais_caro"]
        ml = pattern["mais_leve"]
        html += (
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.58rem;'
            f'color:#555;padding-top:6px;border-top:1px solid #111;">'
            f'Mais pesado: <span style="color:#FF4444;">{mc["dia"]}</span> '
            f'({fmt_brl(mc["total"])}) · '
            f'Mais leve: <span style="color:#00FFCC;">{ml["dia"]}</span> '
            f'({fmt_brl(ml["total"])})'
            f'</div>'
        )

    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)


def render_tag_summary(tag_data: list[dict]) -> None:
    """Renderiza resumo analítico por tags."""
    if not tag_data:
        return

    html = '<div class="intel-box">'
    html += '<div class="intel-title">◆ Análise por Tags (6 meses)</div>'

    for t in tag_data:
        tag = sanitize(t["tag"])
        gastos_text = fmt_brl(t["gastos"]) if t["gastos"] > 0 else ""
        entradas_text = f' +{fmt_brl(t["entradas"])}' if t["entradas"] > 0 else ""
        html += (
            f'<div style="display:flex;justify-content:space-between;align-items:center;'
            f'padding:4px 0;font-family:JetBrains Mono,monospace;font-size:0.62rem;'
            f'border-bottom:1px solid #0f0f0f;">'
            f'<span style="color:#00FFCC;min-width:80px;">#{tag}</span>'
            f'<span style="color:#555;flex:1;text-align:center;">'
            f'{t["n_transacoes"]}tx · {t["n_meses"]}m</span>'
            f'<span style="color:#F0F0F0;min-width:90px;text-align:right;">'
            f'{gastos_text}{entradas_text}</span>'
            f'</div>'
        )

    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)


def render_savings_rate(savings_data: list[dict]) -> None:
    """Renderiza taxa de poupança em barras HTML compactas."""
    if not savings_data:
        return

    max_abs = max((abs(d["rate"]) for d in savings_data if d["has_data"]), default=1)
    if max_abs == 0:
        max_abs = 1

    html = '<div class="intel-box">'
    html += '<div class="intel-title">◆ Taxa de Poupança</div>'

    for d in savings_data:
        if not d["has_data"]:
            html += (
                f'<div class="cat-bar-row">'
                f'<span class="cat-bar-label" style="width:60px;">{d["label"]}</span>'
                f'<div class="cat-bar-track"></div>'
                f'<span class="cat-bar-value" style="width:60px;color:#333;">—</span>'
                f'</div>'
            )
            continue
        rate = d["rate"]
        pct = min(100, abs(rate) / max_abs * 100) if max_abs > 0 else 0
        color = "#00FFCC" if rate >= 20 else ("#FFAA00" if rate >= 0 else "#FF4444")
        sign = "+" if rate > 0 else ""
        html += (
            f'<div class="cat-bar-row">'
            f'<span class="cat-bar-label" style="width:60px;">{d["label"]}</span>'
            f'<div class="cat-bar-track">'
            f'<div class="cat-bar-fill" style="width:{pct:.0f}%;background:{color};"></div>'
            f'</div>'
            f'<span class="cat-bar-value" style="width:60px;color:{color};">'
            f'{sign}{rate:.0f}%</span>'
            f'</div>'
        )

    active = [d for d in savings_data if d["has_data"]]
    if active:
        avg = sum(d["rate"] for d in active) / len(active)
        avg_color = "#00FFCC" if avg >= 20 else ("#FFAA00" if avg >= 0 else "#FF4444")
        html += (
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.58rem;'
            f'color:#555;padding-top:6px;border-top:1px solid #111;">'
            f'Média: <span style="color:{avg_color};">{avg:.0f}%</span> · '
            f'(Renda − Gastos) ÷ Renda'
            f'</div>'
        )

    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)


def render_consistency(consistency: dict | None, user_config: UserConfig | None = None) -> None:
    """Renderiza índice de consistência financeira."""
    if not consistency:
        return

    ucfg = user_config or UserConfig()
    c = consistency

    overall = c["overall_pct"]
    if overall >= 80:
        overall_color, grade = "#00FFCC", "Excelente"
    elif overall >= 60:
        overall_color, grade = "#00FFCC", "Bom"
    elif overall >= 40:
        overall_color, grade = "#FFAA00", "Regular"
    else:
        overall_color, grade = "#FF4444", "Fraco"

    html = (
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ Consistência ({c["months_analyzed"]} meses)</div>'
        f'<div style="display:flex;gap:16px;flex-wrap:wrap;">'

        f'<div style="text-align:center;min-width:70px;">'
        f'<div style="font-family:JetBrains Mono,monospace;font-size:1.6rem;'
        f'font-weight:700;color:{overall_color};">{overall:.0f}%</div>'
        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.5rem;'
        f'color:#555;text-transform:uppercase;letter-spacing:0.1em;">{grade}</div>'
        f'</div>'

        f'<div style="flex:1;min-width:150px;">'

        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.62rem;'
        f'color:#888;padding:3px 0;display:flex;justify-content:space-between;">'
        f'<span>Meta aporte ({ucfg.meta_investimento}%)</span>'
        f'<span style="color:{"#00FFCC" if c["aporte_pct"] >= 60 else "#FFAA00"};">'
        f'{c["aporte_ok"]}/{c["months_analyzed"]} ({c["aporte_pct"]:.0f}%)</span>'
        f'</div>'

        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.62rem;'
        f'color:#888;padding:3px 0;display:flex;justify-content:space-between;">'
        f'<span>Saldo positivo</span>'
        f'<span style="color:{"#00FFCC" if c["saldo_pct"] >= 60 else "#FFAA00"};">'
        f'{c["saldo_ok"]}/{c["months_analyzed"]} ({c["saldo_pct"]:.0f}%)</span>'
        f'</div>'

        f'</div>'
        f'</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_anomalies(anomalies: list[dict]) -> None:
    """Renderiza alertas de gastos anômalos (I2)."""
    if not anomalies:
        return

    html = '<div class="intel-box" style="border-left-color:#FF4444;">'
    html += '<div class="intel-title" style="color:#FF4444;">◆ Anomalias Detectadas</div>'

    for a in anomalies:
        cat = sanitize(a["categoria"])
        ratio = a["ratio"]
        color = "#FF4444" if ratio >= 3 else "#FFAA00"
        icon = "▲▲" if ratio >= 3 else "▲"
        html += (
            f'<div style="display:flex;justify-content:space-between;align-items:center;'
            f'padding:6px 0;font-family:JetBrains Mono,monospace;font-size:0.62rem;'
            f'border-bottom:1px solid #0f0f0f;">'
            f'<span style="color:{color};min-width:20px;">{icon}</span>'
            f'<span style="color:#F0F0F0;flex:1;">{cat}</span>'
            f'<span style="color:{color};min-width:90px;text-align:right;font-weight:700;">'
            f'{fmt_brl(a["valor_atual"])}</span>'
            f'<span style="color:#555;min-width:130px;text-align:right;">'
            f'{a["ratio"]:.1f}x da média ({fmt_brl(a["media_historica"])})</span>'
            f'</div>'
        )

    html += (
        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.5rem;'
        f'color:#333;margin-top:6px;">Comparação: média 3 meses · Threshold: 2x</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_calendar_heatmap(heatmap: dict | None) -> None:
    """Renderiza heatmap calendário de gastos diários (V5)."""
    if not heatmap:
        return

    month_name = MESES_FULL[heatmap["month"]]
    days_in_month = heatmap["days_in_month"]
    first_wd = heatmap["first_weekday"]
    daily = heatmap["daily"]
    max_val = heatmap["max_val"]

    def _color(val: float) -> str:
        if val == 0 or max_val == 0:
            return "#0a0a0a"
        ratio = val / max_val
        if ratio < 0.25:
            return "#0a2a1a"
        if ratio < 0.5:
            return "#0d3d26"
        if ratio < 0.75:
            return "#115533"
        return "#00FFCC"

    dias_semana = ["S", "T", "Q", "Q", "S", "S", "D"]
    header = "".join(
        f'<div style="width:34px;text-align:center;font-family:JetBrains Mono,monospace;'
        f'font-size:0.45rem;color:#444;">{d}</div>'
        for d in dias_semana
    )

    cells = ""
    for _ in range(first_wd):
        cells += '<div style="width:34px;height:34px;"></div>'

    for day in range(1, days_in_month + 1):
        val = daily.get(day, 0)
        bg = _color(val)
        border = "1px solid #00FFCC" if val == max_val and max_val > 0 else "1px solid #111"
        day_color = "#F0F0F0" if val > 0 else "#333"
        cells += (
            f'<div style="width:34px;height:34px;background:{bg};border:{border};'
            f'display:flex;align-items:center;justify-content:center;'
            f'font-family:JetBrains Mono,monospace;font-size:0.5rem;'
            f'color:{day_color};">{day}</div>'
        )

    legend = (
        f'<div style="display:flex;gap:8px;margin-top:8px;font-family:JetBrains Mono,monospace;'
        f'font-size:0.45rem;color:#555;align-items:center;flex-wrap:wrap;">'
        f'<span style="display:flex;align-items:center;gap:2px;">'
        f'<span style="width:8px;height:8px;background:#0a0a0a;border:1px solid #111;"></span>R$0</span>'
        f'<span style="display:flex;align-items:center;gap:2px;">'
        f'<span style="width:8px;height:8px;background:#0a2a1a;"></span>Leve</span>'
        f'<span style="display:flex;align-items:center;gap:2px;">'
        f'<span style="width:8px;height:8px;background:#0d3d26;"></span>Médio</span>'
        f'<span style="display:flex;align-items:center;gap:2px;">'
        f'<span style="width:8px;height:8px;background:#115533;"></span>Alto</span>'
        f'<span style="display:flex;align-items:center;gap:2px;">'
        f'<span style="width:8px;height:8px;background:#00FFCC;"></span>Pico</span>'
        f'</div>'
    )

    stats = ""
    if heatmap["dia_pesado"] > 0:
        stats = (
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
            f'color:#555;padding-top:6px;border-top:1px solid #111;margin-top:8px;">'
            f'Mais pesado: <span style="color:#FF4444;">dia {heatmap["dia_pesado"]}</span> '
            f'({fmt_brl(heatmap["dia_pesado_val"])} · {heatmap["dia_pesado_count"]}tx) · '
            f'Sem gasto: <span style="color:#00FFCC;">{heatmap["dias_sem_gasto"]}d</span> · '
            f'Média: {fmt_brl(heatmap["media_diaria"])}/dia'
            f'</div>'
        )

    html = (
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ Mapa de Gastos — {sanitize(month_name)} {heatmap["year"]}</div>'
        f'<div style="display:flex;gap:2px;margin-bottom:4px;">{header}</div>'
        f'<div style="display:flex;flex-wrap:wrap;gap:2px;">{cells}</div>'
        f'{legend}{stats}'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)

def render_transaction_cards(df: pd.DataFrame, max_items: int = 25) -> None:
    """Renderiza transações como cards compactos mobile-friendly (V6)."""
    if df.empty:
        st.caption("Nenhuma transação para exibir.")
        return

    df_sorted = df.copy()
    df_sorted["Data"] = pd.to_datetime(df_sorted["Data"], errors="coerce")
    df_sorted = df_sorted.sort_values("Data", ascending=False).head(max_items)

    html = '<div class="tx-cards-container">'
    for _, row in df_sorted.iterrows():
        tipo = str(row.get("Tipo", ""))
        val = float(row.get("Valor", 0))
        desc = sanitize(str(row.get("Descricao", "")))[:40]
        cat = sanitize(str(row.get("Categoria", "")))
        resp = sanitize(str(row.get("Responsavel", "")))
        tag = str(row.get("Tag", "")).strip()
        dt = row.get("Data")

        if isinstance(dt, pd.Timestamp) and not pd.isna(dt):
            date_str = dt.strftime("%d/%m")
        else:
            date_str = "—"

        if tipo == CFG.TIPO_ENTRADA:
            val_color = "#00FFCC"
            val_prefix = "+"
            badge_cls = "tx-badge-entrada"
            badge_text = "entrada"
        elif str(row.get("Categoria", "")) == CFG.CAT_INVESTIMENTO:
            val_color = "#FFAA00"
            val_prefix = ""
            badge_cls = "tx-badge-investimento"
            badge_text = "investimento"
        else:
            val_color = "#FF4444"
            val_prefix = "-"
            badge_cls = "tx-badge-saida"
            badge_text = "saída"

        tag_html = (
            f' <span style="color:#00FFCC;opacity:0.5;">#{sanitize(tag)}</span>'
            if tag else ""
        )

        html += (
            f'<div class="tx-card">'
            f'<div class="tx-card-left">'
            f'<div class="tx-card-desc">{desc}</div>'
            f'<div class="tx-card-meta">'
            f'{cat} · {resp} · {date_str}{tag_html}</div>'
            f'</div>'
            f'<div class="tx-card-right">'
            f'<div class="tx-card-valor" style="color:{val_color};">'
            f'{val_prefix}{fmt_brl(val)}</div>'
            f'<div class="tx-card-badge {badge_cls}">{badge_text}</div>'
            f'</div>'
            f'</div>'
        )
    html += '</div>'

    if len(df) > max_items:
        html += (
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.5rem;'
            f'color:#333;text-align:center;padding:8px 0;">'
            f'Exibindo {max_items} de {len(df)} transações</div>'
        )

    st.markdown(html, unsafe_allow_html=True)

def render_metas(metas_progress: list[dict]) -> None:
    """Renderiza cards de metas financeiras com progresso (G1)."""
    if not metas_progress:
        render_intel("Metas", "Nenhuma meta ativa. Crie uma usando o formulário ao lado.")
        return

    for m in metas_progress:
        pct = m["pct"]
        if m["status"] == "achieved":
            color, status_text = "#00FFCC", "✓ Atingida"
        elif m["status"] == "overdue":
            color, status_text = "#FF4444", "⚠ Prazo vencido"
        else:
            color = "#00FFCC" if pct >= 50 else "#FFAA00"
            status_text = f"{pct:.0f}%"

        prazo_info = ""
        if m["months_remaining"] is not None:
            if m["monthly_needed"] and m["monthly_needed"] > 0:
                prazo_info = (
                    f' · {m["months_remaining"]}m restantes '
                    f'· precisa {fmt_brl(m["monthly_needed"])}/mês'
                )
            else:
                prazo_info = f' · {m["months_remaining"]}m restantes'
        elif m["prazo"]:
            prazo_info = f' · Prazo: {m["prazo"]}'

        html = (
            f'<div class="intel-box">'
            f'<div style="display:flex;justify-content:space-between;align-items:center;">'
            f'<div class="intel-title" style="margin-bottom:0;">'
            f'{sanitize(m["nome"])}</div>'
            f'<span style="font-family:JetBrains Mono,monospace;font-size:0.6rem;'
            f'color:{color};font-weight:700;">{status_text}</span>'
            f'</div>'
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.8rem;'
            f'color:#F0F0F0;margin:8px 0 4px 0;">'
            f'{fmt_brl(m["atual"])} / {fmt_brl(m["alvo"])}'
            f'</div>'
            f'<div style="width:100%;height:6px;background:#111;margin-bottom:4px;">'
            f'<div style="width:{min(100, pct):.0f}%;height:100%;background:{color};'
            f'transition:width 0.4s ease;"></div>'
            f'</div>'
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
            f'color:#555;">'
            f'Restante: {fmt_brl(m["restante"])}{prazo_info}'
            f'</div>'
            f'</div>'
        )
        st.markdown(html, unsafe_allow_html=True)


def render_challenges(challenges: list[dict]) -> None:
    """Renderiza micro-desafios do mês (G3)."""
    if not challenges:
        return
    html = '<div class="intel-box">'
    html += '<div class="intel-title">◆ Desafios do Mês</div>'
    for c in challenges:
        if c["done"]:
            check = "✓"
            check_style = "color:#00FFCC;font-weight:700;"
        else:
            check = f'{c["progress"]:.0f}%'
            check_style = "color:#FFAA00;font-weight:700;" if c["progress"] >= 50 else "color:#FF4444;font-weight:700;"
        fill_color = "#00FFCC" if c["done"] else "#FFAA00"
        html += (
            f'<div style="padding:8px 0;border-bottom:1px solid #0f0f0f;">'
            f'<div style="display:flex;align-items:center;gap:8px;'
            f'font-family:JetBrains Mono,monospace;font-size:0.62rem;">'
            f'<span style="font-size:0.9rem;">{c["icon"]}</span>'
            f'<div style="flex:1;">'
            f'<div style="color:#F0F0F0;">{c["title"]}</div>'
            f'<div style="color:#555;font-size:0.55rem;">{c["desc"]}</div>'
            f'</div>'
            f'<span style="{check_style}">{check}</span>'
            f'</div>'
            f'<div style="width:100%;height:3px;background:#111;margin-top:4px;">'
            f'<div style="width:{c["progress"]:.0f}%;height:100%;background:{fill_color};'
            f'transition:width 0.4s ease;"></div>'
            f'</div>'
            f'</div>'
        )
    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)


# ==============================================================================
# 9. FORMULÁRIOS
# ==============================================================================

def generate_monthly_report(
    mx: MonthMetrics,
    budget_data: list[dict],
    score_data: dict,
    sel_mo: int,
    sel_yr: int,
    user: str,
) -> BytesIO | None:
    """Gera relatório mensal completo em Excel (múltiplas abas)."""
    try:
        buffer = BytesIO()

        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            # --- Aba Resumo ---
            resumo = pd.DataFrame({
                "Métrica": [
                    "Renda", "Gastos Lifestyle", "Investido no Mês", "Saldo Disponível",
                    "Taxa de Aporte (%)", "Autonomia (meses)",
                    "Score Financeiro", "Classificação",
                    "Necessidades (%)", "Desejos (%)", "Investimento (%)",
                    "Ticket Médio", "Nº Transações",
                ],
                "Valor": [
                    mx.renda, mx.lifestyle, mx.investido_mes, mx.disponivel,
                    round(mx.taxa_aporte, 1), round(mx.autonomia, 1),
                    round(score_data["score"]), score_data["grade"],
                    round(mx.nec_pct, 1), round(mx.des_pct, 1), round(mx.inv_pct, 1),
                    round(mx.ticket_medio, 2), mx.month_tx_count,
                ],
            })
            resumo.to_excel(writer, sheet_name="Resumo", index=False)

            # --- Aba Transações ---
            if not mx.df_month.empty:
                df_tx = mx.df_month.copy()
                if "Data" in df_tx.columns:
                    df_tx["Data"] = pd.to_datetime(
                        df_tx["Data"], errors="coerce"
                    ).dt.strftime("%d/%m/%Y")
                cols_export = [c for c in df_tx.columns if c != "Id"]
                df_tx[cols_export].to_excel(
                    writer, sheet_name="Transações", index=False
                )

            # --- Aba Categorias ---
            if mx.cat_breakdown:
                cat_df = pd.DataFrame({
                    "Categoria": list(mx.cat_breakdown.keys()),
                    "Valor (R$)": list(mx.cat_breakdown.values()),
                    "% do Total": [
                        round((v / mx.lifestyle * 100), 1) if mx.lifestyle > 0 else 0
                        for v in mx.cat_breakdown.values()
                    ],
                })
                cat_df.to_excel(writer, sheet_name="Categorias", index=False)

            # --- Aba Orçamento ---
            if budget_data:
                orc_df = pd.DataFrame({
                    "Categoria": [b["categoria"] for b in budget_data],
                    "Limite (R$)": [b["limite"] for b in budget_data],
                    "Gasto (R$)": [b["gasto"] for b in budget_data],
                    "% Consumido": [round(b["pct"], 1) for b in budget_data],
                    "Restante (R$)": [b["restante"] for b in budget_data],
                    "Status": [b["status"].upper() for b in budget_data],
                })
                orc_df.to_excel(writer, sheet_name="Orçamento", index=False)

            # --- Aba Top 5 ---
            if mx.top5_gastos:
                top_df = pd.DataFrame(mx.top5_gastos)
                top_df.columns = ["Descrição", "Valor (R$)", "Categoria"]
                top_df.to_excel(writer, sheet_name="Top Gastos", index=False)

        buffer.seek(0)
        return buffer
    except Exception as e:
        logger.error(f"generate_monthly_report failed: {e}")
        return None

def transaction_form(
    form_key: str, tipo: str, categorias: list[str],
    submit_label: str = "REGISTRAR",
    desc_placeholder: str = "Descrição",
    default_step: float = 10.0,
    sel_mo: int | None = None, sel_yr: int | None = None,
    default_resp: str = "Casal",
    df_month: pd.DataFrame | None = None,
) -> None:
    """Formulário genérico de transação."""
    form_date = default_form_date(sel_mo, sel_yr) if sel_mo and sel_yr else datetime.now().date()
    if sel_mo and sel_yr:
        d_min = date(sel_yr, sel_mo, 1)
        d_max = date(sel_yr, sel_mo, calendar.monthrange(sel_yr, sel_mo)[1])
    else:
        d_min, d_max = None, None
    with st.form(form_key, clear_on_submit=True):
        d = st.date_input("Data", form_date, min_value=d_min, max_value=d_max, format="DD/MM/YYYY")
        desc = st.text_input(
            "Descrição", placeholder=desc_placeholder,
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Valor (R$)", min_value=0.01, step=default_step)
        cat = st.selectbox("Categoria", categorias)
        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Responsável", resp_options, index=resp_index)
        tag = st.text_input("Tag (opcional)", placeholder="Ex: viagem, reforma, natal", max_chars=50)
        if st.form_submit_button(submit_label):
            entry = {
                "Data": d, "Descricao": desc.strip(), "Valor": val,
                "Categoria": cat, "Tipo": tipo, "Responsavel": resp,
                "Origem": CFG.ORIGEM_MANUAL,
                "Tag": tag.strip() if tag else "",
            }
            ok, err = validate_transaction(entry)
            if not ok:
                st.toast(f"⚠ {err}")
            else:
                is_dup = df_month is not None and check_duplicate(df_month, desc.strip(), val, d)
                if save_entry(entry, "Transacoes"):
                    if is_dup:
                        st.toast(f"⚠ Possível duplicata: {desc.strip()} — {fmt_brl(val)}")
                    else:
                        st.toast(f"✓ {desc.strip()} — {fmt_brl(val)}")
                    st.rerun()

def wealth_form(
    sel_mo: int | None = None,
    sel_yr: int | None = None,
    default_resp: str = "Casal",
    df_month: pd.DataFrame | None = None,
) -> None:
    """Formulário de aporte / investimento."""
    form_date = default_form_date(sel_mo, sel_yr) if sel_mo and sel_yr else datetime.now().date()
    if sel_mo and sel_yr:
        d_min = date(sel_yr, sel_mo, 1)
        d_max = date(sel_yr, sel_mo, calendar.monthrange(sel_yr, sel_mo)[1])
    else:
        d_min, d_max = None, None
    with st.form("f_wealth", clear_on_submit=True):
        d = st.date_input("Data", form_date, min_value=d_min, max_value=d_max, format="DD/MM/YYYY")
        desc = st.text_input(
            "Ativo / Corretora", placeholder="Ex: IVVB11, Bitcoin, CDB",
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Valor (R$)", min_value=0.01, step=100.0)
        # [FIX B1] Usar default_resp
        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Titular", resp_options, index=resp_index)
        w_tag = st.text_input("Tag (opcional)", placeholder="Ex: renda fixa, cripto", max_chars=50, key="w_tag")
        if st.form_submit_button("CONFIRMAR APORTE"):
            entry = {
                "Data": d, "Descricao": desc.strip(), "Valor": val,
                "Categoria": CFG.CAT_INVESTIMENTO, "Tipo": CFG.TIPO_SAIDA, "Responsavel": resp,
                "Origem": CFG.ORIGEM_MANUAL,
                "Tag": w_tag.strip() if w_tag else "",
            }
            ok, err = validate_transaction(entry)
            if not ok:
                st.toast(f"⚠ {err}")
            else:
                is_dup = df_month is not None and check_duplicate(df_month, desc.strip(), val, d)
                if save_entry(entry, "Transacoes"):
                    if is_dup:
                        st.toast(f"⚠ Possível duplicata: {desc.strip()} — {fmt_brl(val)}")
                    else:
                        st.toast(f"✓ Aporte: {desc.strip()} — {fmt_brl(val)}")
                    st.rerun()

def patrimonio_form(
    default_resp: str = "Casal",  # [FIX M3] Adicionado parâmetro
) -> None:
    """Formulário de ativo patrimonial."""
    with st.form("f_patrimonio", clear_on_submit=True):
        item = st.text_input(
            "Ativo / Conta", placeholder="Ex: Poupança Nubank, Apartamento",
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Valor (R$)", min_value=0.01, step=100.0)
        # [FIX M3] Usar default_resp
        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Titular", resp_options, index=resp_index)
        if st.form_submit_button("ADICIONAR ATIVO"):
            entry = {"Item": item.strip(), "Valor": val, "Responsavel": resp}
            ok, err = validate_asset(entry)
            if not ok:
                st.toast(f"⚠ {err}")
            elif save_entry(entry, "Patrimonio"):
                st.toast(f"✓ Ativo: {item.strip()} — {fmt_brl(val)}")
                st.rerun()


def recorrente_form(default_resp: str = "Casal", df_existing: pd.DataFrame | None = None) -> None:
    """Formulário para cadastrar transação recorrente."""
    with st.form("f_recorrente", clear_on_submit=True):
        tipo = st.selectbox("Tipo", list(CFG.TIPOS))
        desc = st.text_input(
            "Descrição", placeholder="Ex: Aluguel, Netflix, Salário",
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Valor (R$)", min_value=0.01, step=50.0)
        if tipo == CFG.TIPO_SAIDA:
            cat_options = list(CFG.CATEGORIAS_SAIDA) + [CFG.CAT_INVESTIMENTO]
        else:
            cat_options = list(CFG.CATEGORIAS_ENTRADA)
        cat = st.selectbox("Categoria", cat_options)
        dia = st.number_input(
            "Dia do vencimento", min_value=1, max_value=28, value=1, step=1
        )
        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Responsável", resp_options, index=resp_index)
        if st.form_submit_button("CADASTRAR RECORRENTE"):
            entry = {
                "Descricao": desc.strip(),
                "Valor": val,
                "Categoria": cat,
                "Tipo": tipo,
                "Responsavel": resp,
                "DiaVencimento": int(dia),
                "Ativo": True,
            }
            ok, err = validate_recorrente(entry)
            if not ok:
                st.toast(f"⚠ {err}")
            elif df_existing is not None and not df_existing.empty and (
                (df_existing["Descricao"].str.strip().str.lower() == desc.strip().lower()) &
                (df_existing["Categoria"].str.strip() == cat) &
                (df_existing["Tipo"].str.strip() == tipo) &
                (df_existing["Responsavel"].str.strip() == resp)
            ).any():
                st.toast(f"⚠ Recorrente já cadastrada: {desc.strip()}")
            elif save_entry(entry, "Recorrentes"):
                st.toast(f"✓ Recorrente: {desc.strip()} — {fmt_brl(val)}/mês")
                st.rerun()


def orcamento_form(default_resp: str = "Casal", df_existing: pd.DataFrame | None = None) -> None:
    """Formulário para definir limite de orçamento por categoria."""
    with st.form("f_orcamento", clear_on_submit=True):
        cat = st.selectbox("Categoria", list(CFG.CATEGORIAS_SAIDA))
        limite = st.number_input("Limite mensal (R$)", min_value=0.01, step=50.0)
        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Responsável", resp_options, index=resp_index)
        if st.form_submit_button("DEFINIR LIMITE"):
            entry = {
                "Categoria": cat,
                "Limite": limite,
                "Responsavel": resp,
            }
            ok, err = validate_orcamento(entry)
            if not ok:
                st.toast(f"⚠ {err}")
            elif df_existing is not None and not df_existing.empty and (
                (df_existing["Categoria"].str.strip() == cat) &
                (df_existing["Responsavel"].str.strip() == resp)
            ).any():
                st.toast(f"⚠ {cat}/{resp} já tem limite — edite na tabela abaixo")
            elif save_entry(entry, "Orcamentos"):
                st.toast(f"✓ Limite de {fmt_brl(limite)} definido para {cat}")
                st.rerun()


def passivo_form(default_resp: str = "Casal") -> None:
    """Formulário de passivo/dívida (I5)."""
    with st.form("f_passivo", clear_on_submit=True):
        item = st.text_input(
            "Dívida / Financiamento",
            placeholder="Ex: Financiamento Apto, Empréstimo, Cartão",
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Saldo Devedor (R$)", min_value=0.01, step=100.0)
        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Responsável", resp_options, index=resp_index)
        if st.form_submit_button("ADICIONAR PASSIVO"):
            entry = {"Item": item.strip(), "Valor": val, "Responsavel": resp}
            ok, err = validate_passivo(entry)
            if not ok:
                st.toast(f"⚠ {err}")
            elif save_entry(entry, "Passivos"):
                st.toast(f"✓ Passivo: {item.strip()} — {fmt_brl(val)}")
                st.rerun()


def generate_full_backup() -> BytesIO | None:
    """Gera backup completo de todas as planilhas em Excel (S1)."""
    try:
        conn = get_conn()
        buffer = BytesIO()
        sheets_to_backup = [
            "Transacoes", "Patrimonio", "Passivos", "Recorrentes",
            "Orcamentos", "Metas", "Configuracoes",
        ]
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            for ws_name in sheets_to_backup:
                try:
                    df = conn.read(worksheet=ws_name)
                    df = df.dropna(how="all")
                    if "Data" in df.columns:
                        df["Data"] = pd.to_datetime(
                            df["Data"], errors="coerce"
                        ).dt.strftime("%Y-%m-%d")
                    df.to_excel(writer, sheet_name=ws_name, index=False)
                except Exception:
                    pd.DataFrame().to_excel(
                        writer, sheet_name=ws_name, index=False
                    )
        buffer.seek(0)
        _log_audit("BACKUP", "ALL", f"{len(sheets_to_backup)} planilhas")
        return buffer
    except Exception as e:
        logger.error(f"generate_full_backup failed: {e}")
        return None


def meta_form(default_resp: str = "Casal") -> None:
    """Formulário para criar meta financeira (G1)."""
    with st.form("f_meta", clear_on_submit=True):
        nome = st.text_input(
            "Nome da Meta",
            placeholder="Ex: Reserva de Emergência, Viagem Europa",
            max_chars=100,
        )
        m1, m2 = st.columns(2)
        with m1:
            valor_alvo = st.number_input("Valor Alvo (R$)", min_value=0.01, step=500.0)
        with m2:
            valor_atual = st.number_input(
                "Valor Atual (R$)", min_value=0.0, step=100.0, value=0.0,
            )
        m3, m4 = st.columns(2)
        with m3:
            prazo = st.text_input(
                "Prazo (YYYY-MM)", placeholder="Ex: 2025-12", max_chars=7,
            )
        with m4:
            resp_opts = list(CFG.RESPONSAVEIS)
            resp_idx = resp_opts.index(default_resp) if default_resp in resp_opts else 0
            resp = st.selectbox("Responsável", resp_opts, index=resp_idx)
        if st.form_submit_button("CRIAR META", use_container_width=True):
            if not nome or not nome.strip():
                st.toast("⚠ Nome da meta obrigatório")
            elif valor_alvo <= 0:
                st.toast("⚠ Valor alvo deve ser maior que zero")
            elif valor_atual < 0:
                st.toast("⚠ Valor atual não pode ser negativo")
            elif prazo and not (len(prazo.strip()) == 7 and prazo.strip()[4] == "-"):
                st.toast("⚠ Prazo deve estar no formato YYYY-MM (ex: 2025-12)")
            else:
                entry = {
                    "Id": generate_id(),
                    "Nome": nome.strip(),
                    "ValorAlvo": valor_alvo,
                    "ValorAtual": valor_atual,
                    "Prazo": prazo.strip() if prazo else "",
                    "Responsavel": resp,
                    "Ativo": True,
                }
                if save_entry(entry, "Metas"):
                    st.toast(f"✓ Meta criada: {nome.strip()}")
                    st.rerun()


# ==============================================================================
# 10. HISTÓRICO
# ==============================================================================

def _df_equals_safe(df1: pd.DataFrame, df2: pd.DataFrame) -> bool:
    """Comparação segura de DataFrames normalizando tipos."""
    try:
        d1 = df1.reset_index(drop=True).copy()
        d2 = df2.reset_index(drop=True).copy()
        if d1.shape != d2.shape:
            return False
        if list(d1.columns) != list(d2.columns):
            return False
        for col in d1.columns:
            d1[col] = d1[col].astype(str)
            d2[col] = d2[col].astype(str)
        return d1.equals(d2)
    except Exception:
        return False


def _render_historico(
    mx: MonthMetrics,
    user: str,  # [FIX B2] Removido df_trans_full (não era usado)
    sel_mo: int,
    sel_yr: int,
) -> None:
    """Renderiza aba de histórico com busca, export e edição."""
    df_hist = mx.df_month.copy()
    month_label = fmt_month_year(sel_mo, sel_yr)

    if df_hist.empty:
        render_intel(
            f"Histórico — {sanitize(month_label)}",
            "Nenhuma transação registrada neste mês."
        )
        return

    df_hist["Data"] = pd.to_datetime(df_hist["Data"], errors="coerce")
    df_hist = df_hist.sort_values("Data", ascending=False).reset_index(drop=True)

    render_intel(
        f"Histórico — {sanitize(month_label)}",
        f"<strong>{len(df_hist)}</strong> transações neste mês"
    )
    render_hist_summary(mx)

    # --- Relatório Completo ---
    try:
        report_buf = generate_monthly_report(
            mx, mx.budget_data,
            compute_score(mx),
            sel_mo, sel_yr, user,
        )
        if report_buf:
            st.download_button(
                "📊 RELATÓRIO COMPLETO (Excel)",
                report_buf.getvalue(),
                f"relatorio_{sel_mo:02d}_{sel_yr}_{user}.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
                key=f"report_{user}_{sel_mo}_{sel_yr}",
            )
    except Exception as e:
        logger.warning(f"Report generation failed: {e}")

    search = st.text_input(
        "🔍 Buscar",
        placeholder="Filtrar visualização por descrição, categoria...",
        label_visibility="collapsed",
        key=f"hist_search_{user}_{sel_mo}_{sel_yr}",
    )

    df_display = df_hist.copy()
    if search and search.strip():
        search_lower = search.strip().lower()
        tag_mask = df_display["Tag"].str.lower().str.contains(search_lower, na=False) if "Tag" in df_display.columns else False
        mask = (
            df_display["Descricao"].str.lower().str.contains(search_lower, na=False) |
            df_display["Categoria"].str.lower().str.contains(search_lower, na=False) |
            df_display["Tipo"].str.lower().str.contains(search_lower, na=False) |
            df_display["Responsavel"].str.lower().str.contains(search_lower, na=False) |
            tag_mask
        )
        df_display = df_display[mask].reset_index(drop=True)
        if df_display.empty:
            render_intel("", f"Nenhum resultado para '<em>{sanitize(search)}</em>'")
            return

    col_csv, col_excel, _ = st.columns([1, 1, 4])
    with col_csv:
        csv_data = df_display.to_csv(index=False).encode("utf-8-sig")
        st.download_button(
            "⬇ CSV", csv_data,
            f"financas_{sel_mo:02d}_{sel_yr}_{user}.csv",
            "text/csv", use_container_width=True,
        )
    with col_excel:
        try:
            buffer = BytesIO()
            df_export = df_display.copy()
            if "Data" in df_export.columns:
                df_export["Data"] = df_export["Data"].dt.strftime("%d/%m/%Y")
            df_export.to_excel(buffer, index=False, engine="openpyxl")
            st.download_button(
                "⬇ EXCEL", buffer.getvalue(),
                f"financas_{sel_mo:02d}_{sel_yr}_{user}.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
            )
        except ImportError:
            st.caption("Excel indisponível (instale openpyxl)")

    if search and search.strip():
        st.caption("⚠ A busca filtra apenas a visualização/export. A edição abaixo mostra todos os registros do mês.")

    # --- Toggle Tabela/Cards (V6) ---
    _hist_vc1, _hist_vc2 = st.columns([1, 3])
    with _hist_vc1:
        _hist_view = st.radio(
            "Vista", ["Tabela", "Cards"],
            horizontal=True, label_visibility="collapsed",
            key=f"hist_view_{user}_{sel_mo}_{sel_yr}",
        )

    if _hist_view == "Cards":
        _show_all_cards = len(df_display) > 25 and st.checkbox(
            f"Mostrar todas ({len(df_display)})",
            key=f"cards_all_{user}_{sel_mo}_{sel_yr}",
        )
        render_transaction_cards(
            df_display,
            max_items=len(df_display) if _show_all_cards else 25,
        )
        st.caption("💡 Para editar/excluir, mude para visualização Tabela.")
        return

    st.caption("💡 Para excluir transações, selecione a linha e pressione Delete.")

    edited = st.data_editor(
        df_hist,
        use_container_width=True,
        num_rows="dynamic",
        column_config={
            "Data": st.column_config.DateColumn(
                "Data", format="DD/MM/YYYY", required=True
            ),
            "Valor": st.column_config.NumberColumn(
                "Valor", format="R$ %.2f", required=True, min_value=0.0
            ),
            "Tipo": st.column_config.SelectboxColumn(
                "Tipo", options=list(CFG.TIPOS), required=True
            ),
            "Categoria": st.column_config.SelectboxColumn(
                "Categoria", options=list(CFG.CATEGORIAS_TODAS), required=True,
            ),
            "Descricao": st.column_config.TextColumn("Descrição", required=True),
            "Responsavel": st.column_config.SelectboxColumn(
                "Responsável", options=list(CFG.RESPONSAVEIS)
            ),
            "Origem": st.column_config.TextColumn("Origem", disabled=True),
            "Tag": st.column_config.TextColumn("Tag", max_chars=50),
            "Id": None,  # Oculta coluna Id do editor
        },
        hide_index=True,
        key=f"editor_historico_{user}_{sel_mo}_{sel_yr}",
    )

    if not _df_equals_safe(df_hist, edited):
        rows_removed = len(df_hist) - len(edited)
        if rows_removed > 0:
            if rows_removed >= 3:
                st.error(f"⚠ ATENÇÃO: {rows_removed} transações serão excluídas em {month_label}")
            else:
                st.warning(f"⚠ {rows_removed} transação(ões) será(ão) excluída(s) em {month_label}")
        else:
            st.warning(f"⚠ Alterações pendentes em {month_label}")

        c_save, c_discard = st.columns(2)
        with c_save:
            if st.button("✓ SALVAR ALTERAÇÕES", key=f"save_hist_{user}_{sel_mo}_{sel_yr}", use_container_width=True):
                if edited.empty and len(df_hist) > 0:
                    st.error("⚠ Não é possível excluir todas as transações de uma vez.")
                else:
                    # Garantir coluna Origem em linhas novas
                    if "Origem" in edited.columns:
                        edited["Origem"] = edited["Origem"].fillna(CFG.ORIGEM_MANUAL)
                    else:
                        edited["Origem"] = CFG.ORIGEM_MANUAL

                    # Validar cada linha editada
                    validation_errors = []
                    for idx, row in edited.iterrows():
                        entry = {
                            "Data": row.get("Data"),
                            "Descricao": row.get("Descricao", ""),
                            "Valor": row.get("Valor", 0),
                            "Categoria": row.get("Categoria", ""),
                            "Tipo": row.get("Tipo", ""),
                            "Responsavel": row.get("Responsavel", ""),
                        }
                        ok, err = validate_transaction(entry)
                        if not ok:
                            validation_errors.append(f"Linha {idx + 1}: {err}")
                    if validation_errors:
                        for ve in validation_errors[:5]:
                            st.error(f"⚠ {ve}")
                        if len(validation_errors) > 5:
                            st.error(f"... e mais {len(validation_errors) - 5} erro(s)")
                    else:
                        _save_historico_mensal(edited, user, sel_mo, sel_yr)
        with c_discard:
            if st.button("✗ DESCARTAR", key=f"discard_hist_{user}_{sel_mo}_{sel_yr}", use_container_width=True):
                st.rerun()


def _save_historico_mensal(
    edited_month: pd.DataFrame,
    user: str,
    sel_mo: int,
    sel_yr: int,
) -> None:
    """Salva edições do histórico mensal com soft delete (S3)."""
    st.cache_data.clear()
    time.sleep(0.3)
    df_full_fresh, _ = load_data()

    mask_month = (
        (df_full_fresh["Data"].dt.month == sel_mo) &
        (df_full_fresh["Data"].dt.year == sel_yr)
    )
    if user != "Casal":
        mask_user = df_full_fresh["Responsavel"] == user
        mask_remove = mask_month & mask_user
    else:
        mask_remove = mask_month

    df_original_month = df_full_fresh[mask_remove].copy()

    # --- Detectar linhas removidas e mover para Lixeira (S3) ---
    if not df_original_month.empty and len(edited_month) < len(df_original_month):
        if "Id" in df_original_month.columns and "Id" in edited_month.columns:
            orig_ids = set(df_original_month["Id"].astype(str).str.strip())
            edit_ids = set(edited_month["Id"].astype(str).str.strip())
            removed_ids = orig_ids - edit_ids
            if removed_ids:
                df_removed = df_original_month[
                    df_original_month["Id"].astype(str).str.strip().isin(removed_ids)
                ]
                _move_to_lixeira(df_removed)

    df_kept = df_full_fresh[~mask_remove].copy()
    df_merged = pd.concat([df_kept, edited_month], ignore_index=True)
    df_merged["Data"] = pd.to_datetime(df_merged["Data"], errors="coerce")
    df_merged = df_merged.sort_values("Data").reset_index(drop=True)

    if update_sheet(df_merged, "Transacoes"):
        st.toast("✓ Histórico atualizado")
        st.rerun()


# ==============================================================================
# 11. EDIÇÃO SEGURA
# ==============================================================================

def _save_filtered_sheet(
    df_full: pd.DataFrame,
    df_edited: pd.DataFrame,
    user: str,
    worksheet: str,
) -> bool:
    """Salva edição filtrada preservando registros de outros usuários.

    Registros 'Casal' são protegidos contra deleção por perfil individual.
    """
    if user != "Casal" and "Responsavel" in df_full.columns:
        # Registros de outros usuários individuais (intocáveis)
        df_others = df_full[
            ~df_full["Responsavel"].isin([user, "Casal"])
        ].copy()

        # Registros Casal: proteger contra deleção acidental
        df_casal_orig = df_full[df_full["Responsavel"] == "Casal"].copy()
        df_casal_edit = (
            df_edited[df_edited["Responsavel"] == "Casal"].copy()
            if not df_edited.empty and "Responsavel" in df_edited.columns
            else pd.DataFrame()
        )

        if len(df_casal_edit) < len(df_casal_orig):
            logger.warning(f"[{worksheet}] {user}: deleção de Casal bloqueada")
            st.toast("⚠ Registros 'Casal' só podem ser excluídos pelo perfil Casal")
            df_casal_final = df_casal_orig
        else:
            df_casal_final = df_casal_edit

        # Registros do próprio usuário (editáveis livremente)
        df_user_edit = (
            df_edited[df_edited["Responsavel"] == user].copy()
            if not df_edited.empty and "Responsavel" in df_edited.columns
            else pd.DataFrame()
        )

        df_final = pd.concat(
            [df_others, df_casal_final, df_user_edit], ignore_index=True
        )
    else:
        df_final = df_edited.copy()
    return update_sheet(df_final, worksheet)

# ==============================================================================
# 12. AUTENTICAÇÃO (Fase 1 — Hardened)
# ==============================================================================

def _verify_password(stored_hash: str, password: str) -> bool:
    """Delega para core.auth.verify_password (Fase 2)."""
    return _verify_password_core(stored_hash, password)


def _check_login_rate_limit() -> tuple[bool, int]:
    """Rate limit de login com backoff exponencial.

    Retorna (permitido, segundos_restantes).
    """
    attempts = st.session_state.get("_login_attempts", 0)
    last_attempt = st.session_state.get("_login_last_attempt", 0.0)

    if attempts >= CFG.LOGIN_MAX_ATTEMPTS:
        cooldown = CFG.LOGIN_COOLDOWN_BASE ** min(attempts - CFG.LOGIN_MAX_ATTEMPTS + 1, 6)
        elapsed = time.time() - last_attempt
        if elapsed < cooldown:
            remaining = int(cooldown - elapsed) + 1
            return False, remaining
        # Cooldown expirou — reset parcial
        st.session_state["_login_attempts"] = max(0, attempts - 2)

    return True, 0


def _check_auth() -> bool:
    """Verifica se o usuário está autenticado.

    Se auth não está configurado em secrets.toml, permite acesso livre.
    Verifica expiração da sessão (SESSION_TTL_HOURS).
    """
    try:
        auth_cfg = st.secrets.get("auth", {})
        if not auth_cfg.get("enabled", False):
            return True
    except (FileNotFoundError, KeyError, Exception):
        return True

    if not st.session_state.get("authenticated", False):
        return False

    # Verificar expiração da sessão
    login_ts = st.session_state.get("_session_created", 0.0)
    if login_ts > 0:
        hours_elapsed = (time.time() - login_ts) / 3600
        if hours_elapsed > CFG.SESSION_TTL_HOURS:
            logger.info("Sessão expirada — forçando re-login")
            _logout()
            return False

    return True


def _render_login() -> None:
    """Renderiza tela de login no tema do terminal."""
    st.markdown("""
    <div style="text-align:center; padding:80px 20px 20px 20px;">
        <div style="font-family:'JetBrains Mono',monospace; font-size:0.6rem;
             color:#00FFCC; text-transform:uppercase; letter-spacing:0.6em;
             margin-bottom:12px; opacity:0.5;">▮ L&L Finance Terminal</div>
        <div style="font-family:'JetBrains Mono',monospace; font-size:2.5rem;
             color:#F0F0F0; margin-bottom:8px; letter-spacing:-0.02em;">Autenticação</div>
        <div style="font-family:'JetBrains Mono',monospace; font-size:0.65rem;
             color:#333; letter-spacing:0.05em;">Acesso restrito</div>
    </div>
    """, unsafe_allow_html=True)

    # Mostrar rate limit se ativo
    allowed, remaining = _check_login_rate_limit()
    if not allowed:
        st.error(f"⚠ Muitas tentativas. Aguarde {remaining}s antes de tentar novamente.")
        return

    _, col_center, _ = st.columns([1, 1, 1])
    with col_center:
        with st.form("login_form"):
            username = st.text_input(
                "Usuário", placeholder="seu nome",
                label_visibility="collapsed",
            )
            password = st.text_input(
                "Senha", type="password", placeholder="senha",
                label_visibility="collapsed",
            )
            if st.form_submit_button("ENTRAR", use_container_width=True):
                try:
                    users = st.secrets.get("auth", {}).get("users", {})
                    user_key = username.strip().lower()
                    user_data = users.get(user_key, None)

                    if user_data and _verify_password(
                        str(user_data.get("password", "")), password
                    ):
                        st.session_state.authenticated = True
                        st.session_state.auth_user = str(
                            user_data.get("name", username.strip())
                        )
                        st.session_state["_session_created"] = time.time()
                        st.session_state["_login_attempts"] = 0
                        logger.info(f"Login OK: {user_key}")
                        _log_audit("LOGIN", "Auth", f"user={user_key}")
                        st.rerun()
                    else:
                        # Incrementar tentativas
                        attempts = st.session_state.get("_login_attempts", 0) + 1
                        st.session_state["_login_attempts"] = attempts
                        st.session_state["_login_last_attempt"] = time.time()
                        remaining_attempts = max(
                            0, CFG.LOGIN_MAX_ATTEMPTS - attempts
                        )
                        if remaining_attempts > 0:
                            st.error(
                                f"Usuário ou senha incorretos "
                                f"({remaining_attempts} tentativa"
                                f"{'s' if remaining_attempts != 1 else ''} restante"
                                f"{'s' if remaining_attempts != 1 else ''})"  
                            )
                        else:
                            st.error("⚠ Conta temporariamente bloqueada")
                        logger.warning(
                            f"Login falhou: {user_key} "
                            f"(tentativa {attempts})"
                        )
                        _log_audit(
                            "LOGIN_FAILED", "Auth",
                            f"user={user_key} attempt={attempts}",
                        )
                except Exception as e:
                    st.error("Erro na autenticação")
                    logger.error(f"Auth error: {e}")

        st.markdown(
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.5rem;'
            f'color:#1a1a1a;text-align:center;margin-top:24px;">v{CFG.VERSION}</div>',
            unsafe_allow_html=True,
        )


def _logout() -> None:
    """Limpa sessão de autenticação."""
    auth_user = st.session_state.get("auth_user", "")
    for key in ["authenticated", "auth_user", "_session_created"]:
        st.session_state.pop(key, None)
    if auth_user:
        _log_audit("LOGOUT", "Auth", f"user={auth_user}")
    logger.info("Logout")
    st.rerun()


# ==============================================================================
# 13. APLICAÇÃO PRINCIPAL
# ==============================================================================

def main() -> None:
    inject_css()
    _apply_theme()

    # --- Autenticação ---
    if not _check_auth():
        _render_login()
        return

    validate_worksheets()

    # --- V2: Modo de exibição ---
    if "display_mode" not in st.session_state:
        st.session_state.display_mode = "expert"

    # --- V4: Tema ---
    if "theme" not in st.session_state:
        st.session_state.theme = "dark"

    now = datetime.now()

    # --- Barra de Controle ---
    auth_user = st.session_state.get("auth_user", "")
    default_filter = auth_user if auth_user in list(CFG.RESPONSAVEIS) else "Casal"

    c_filter, _, c_status = st.columns([1, 2, 1])
    with c_filter:
        try:
            user = st.pills(
                "", list(CFG.RESPONSAVEIS),
                default=default_filter, selection_mode="single",
                label_visibility="collapsed"
            )
        except Exception:
            user = st.radio(
                "", list(CFG.RESPONSAVEIS),
                horizontal=True, label_visibility="collapsed"
            )
    if not user:
        user = "Casal"
    with c_status:
        status_parts = [f"L&L v{CFG.VERSION} — {fmt_date(now)}"]
        if auth_user:
            status_parts.append(sanitize(auth_user))
        st.markdown(
            f'<div class="status-line">{" — ".join(status_parts)}</div>',
            unsafe_allow_html=True,
        )
        cs1, cs2, cs3, cs4 = st.columns(4)
        with cs1:
            if st.button("⟳", key="refresh_btn", help="Atualizar dados"):
                st.cache_data.clear()
                st.rerun()
        with cs2:
            _mode_label = "◉" if st.session_state.display_mode == "expert" else "○"
            if st.button(
                _mode_label, key="mode_toggle",
                help="Expert ↔ Clean",
            ):
                st.session_state.display_mode = (
                    "clean" if st.session_state.display_mode == "expert" else "expert"
                )
                st.rerun()
        with cs3:
            _theme_icon = "☀" if st.session_state.get("theme") == "dark" else "☽"
            if st.button(
                _theme_icon, key="theme_toggle",
                help="Light ↔ Dark",
            ):
                st.session_state.theme = (
                    "light" if st.session_state.get("theme") == "dark" else "dark"
                )
                st.rerun()
        with cs4:
            if auth_user:
                if st.button("⏻", key="logout_btn", help="Sair"):
                    _logout()

    # --- Navegação Mensal ---
    if "nav_month" not in st.session_state:
        st.session_state.nav_month = now.month
    if "nav_year" not in st.session_state:
        st.session_state.nav_year = now.year

    if _is_future_month(st.session_state.nav_month, st.session_state.nav_year):
        st.session_state.nav_month = now.month
        st.session_state.nav_year = now.year

    nav_prev, nav_label, nav_next = st.columns([1, 3, 1])
    with nav_prev:
        if st.button("◀", key="nav_prev", use_container_width=True):
            st.session_state.nav_month -= 1
            if st.session_state.nav_month == 0:
                st.session_state.nav_month = 12
                st.session_state.nav_year -= 1
            st.rerun()
    with nav_label:
        is_current = (
            st.session_state.nav_month == now.month and
            st.session_state.nav_year == now.year
        )

        if not is_current:
            col_label, col_today = st.columns([4, 1])
            with col_label:
                st.markdown(
                    f'<div class="month-nav">'
                    f'{fmt_month_year(st.session_state.nav_month, st.session_state.nav_year)}'
                    f'</div>',
                    unsafe_allow_html=True
                )
            with col_today:
                if st.button("●", key="nav_today", help="Voltar ao mês atual"):
                    st.session_state.nav_month = now.month
                    st.session_state.nav_year = now.year
                    st.rerun()
        else:
            st.markdown(
                f'<div class="month-nav">'
                f'{fmt_month_year(st.session_state.nav_month, st.session_state.nav_year)}'
                f' ●</div>',
                unsafe_allow_html=True
            )

    with nav_next:
        if st.button("▶", key="nav_next", use_container_width=True):
            next_mo = st.session_state.nav_month + 1
            next_yr = st.session_state.nav_year
            if next_mo == 13:
                next_mo = 1
                next_yr += 1
            if not _is_future_month(next_mo, next_yr):
                st.session_state.nav_month = next_mo
                st.session_state.nav_year = next_yr
                st.rerun()

    sel_mo = st.session_state.nav_month
    sel_yr = st.session_state.nav_year

    # --- Carregar Todos os Dados (batch) ---
    df_config = load_config()
    df_trans, df_assets = load_data()
    df_recorrentes = load_recorrentes()
    df_orcamentos = load_orcamentos()
    df_metas = load_metas()
    df_passivos = load_passivos()
    df_lixeira = load_lixeira()
    df_favoritos = load_favoritos()

    # --- Config do Usuário ---
    user_config = UserConfig.from_df(df_config, user)

    # --- Métricas ---
    mx = compute_metrics(df_trans, df_assets, user, sel_mo, sel_yr, user_config)

    # --- Projeção (só mês atual) ---
    projection = compute_projection(mx, sel_mo, sel_yr)

    # --- Recorrentes Pendentes ---
    pendentes = detect_pending_recorrentes(df_recorrentes, df_trans, user, sel_mo, sel_yr)

    # --- Auto-gerar recorrentes (se habilitado) ---
    if user_config.auto_gerar_recorrentes and not pendentes.empty:
        auto_key = f"auto_gen_{user}_{sel_mo}_{sel_yr}"
        if auto_key not in st.session_state:
            st.session_state[auto_key] = True
            result = generate_recorrentes(pendentes, sel_mo, sel_yr)
            if result:
                parts = []
                if result["entradas"] > 0:
                    parts.append(f"{result['entradas']} entrada{'s' if result['entradas'] > 1 else ''}")
                if result["saidas"] > 0:
                    parts.append(f"{result['saidas']} saída{'s' if result['saidas'] > 1 else ''}")
                detail = " + ".join(parts) if parts else ""
                st.toast(f"⟳ Auto: {result['count']} recorrentes geradas ({detail})")
                st.rerun()
    budget_data = compute_budget(df_orcamentos, mx.cat_breakdown, user)
    mx.budget_data = budget_data

    # --- Alertas ---
    alerts = compute_alerts(mx, sel_mo, sel_yr, projection, n_pendentes=len(pendentes))

    month_label = fmt_month_year(sel_mo, sel_yr)
    has_data = mx.renda > 0 or mx.lifestyle > 0 or mx.investido_mes > 0

    # ===== DASHBOARD COMPACTO (V1) =====
    if has_data:
        _dash_l, _dash_r = st.columns([1, 2])
        with _dash_l:
            render_autonomia(mx.autonomia, mx.sobrevivencia, user_config)
        with _dash_r:
            _kr1, _kr2, _kr3 = st.columns(3)
            with _kr1:
                render_kpi("Renda", fmt_brl(mx.renda), "Entradas", mx.d_renda)
            with _kr2:
                render_kpi(
                    "Gastos", fmt_brl(mx.lifestyle), "Consumo",
                    mx.d_lifestyle, delta_invert=True,
                )
            with _kr3:
                render_kpi(
                    "Investido", fmt_brl(mx.investido_mes),
                    f"Aporte: {mx.taxa_aporte:.1f}%", mx.d_investido,
                )
            _saldo_color = "#00FFCC" if mx.disponivel >= 0 else "#FF4444"
            st.markdown(
                f'<div style="font-family:JetBrains Mono,monospace;padding:4px 16px;'
                f'display:flex;justify-content:space-between;align-items:center;'
                f'border-left:3px solid {_saldo_color};margin-bottom:8px;">'
                f'<span style="font-size:0.6rem;color:#555;text-transform:uppercase;'
                f'letter-spacing:0.15em;">Saldo</span>'
                f'<span style="font-size:1.1rem;font-weight:700;color:{_saldo_color};">'
                f'{fmt_brl(mx.disponivel)}</span>'
                f'<span style="font-size:0.55rem;color:#444;">Reserva: '
                f'{fmt_brl(mx.sobrevivencia)}</span>'
                f'</div>',
                unsafe_allow_html=True,
            )
            render_aporte_meta(mx)
    else:
        render_autonomia(mx.autonomia, mx.sobrevivencia, user_config)

    # ===== HEALTH + ALERTAS =====
    render_health_badge(mx.health, month_label, mx.month_tx_count)
    render_alerts(alerts)

    # ===== BANNER RECORRENTES PENDENTES =====
    render_pending_banner(pendentes, user, sel_mo, sel_yr)

    if not has_data:
        render_empty_month(month_label)
    else:
        # ===== PROJEÇÃO (só mês atual) =====
        render_projection(projection, mx)

        # ===== DESAFIOS (G3) =====
        _challenges = compute_challenges(mx)
        if _challenges:
            render_challenges(_challenges)

        # ===== ANÁLISE DETALHADA (colapsável com sub-tabs — X5, V2) =====
        if st.session_state.display_mode == "expert":
          with st.expander("📊 Análise Detalhada", expanded=False):
            ad_score, ad_regra, ad_comp, ad_forecast = st.tabs([
                "SCORE", "REGRA", "COMPARATIVO", "FORECAST"
            ])

            with ad_score:
                _score_data = compute_score(mx)
                _consistency = compute_consistency(
                    df_trans, user, sel_mo, sel_yr, user_config=user_config,
                )
                _ad_l, _ad_r = st.columns([1, 1])
                with _ad_l:
                    render_score(_score_data)
                with _ad_r:
                    render_consistency(_consistency, user_config)

            with ad_regra:
                render_regra_503020(mx)
                if user == "Casal":
                    render_split_casal(mx.split_gastos, mx.split_renda)
                    _divisao = compute_divisao_casal(mx.df_month)
                    render_divisao_casal(_divisao)

            with ad_comp:
                _yoy = compute_yoy(df_trans, user, sel_mo, sel_yr)
                _annual = compute_annual_summary(df_trans, user, sel_yr)
                _savings = compute_savings_rate(df_trans, user, sel_mo, sel_yr)
                _cmp_l, _cmp_r = st.columns([1, 1])
                with _cmp_l:
                    render_prev_comparison(mx, sel_mo, sel_yr)
                with _cmp_r:
                    render_yoy(_yoy)
                render_annual_strip(_annual)
                render_savings_rate(_savings)

            with ad_forecast:
                _forecast = compute_cashflow_forecast(
                    df_trans, df_recorrentes, user, sel_mo, sel_yr,
                )
                render_cashflow_forecast(_forecast)

    # ===== LANÇAMENTO RÁPIDO =====
    with st.expander("⚡ Lançamento Rápido"):
        # U6: Remember last category/responsavel used
        _last_cat_key = f"_last_cat_{user}"
        _last_cat = st.session_state.get(_last_cat_key, None)
        _cat_list = list(CFG.CATEGORIAS_SAIDA)
        _cat_idx = _cat_list.index(_last_cat) if _last_cat and _last_cat in _cat_list else 0

        with st.form("f_quick", clear_on_submit=True):
            qc1, qc2 = st.columns([3, 1])
            with qc1:
                q_desc = st.text_input(
                    "Descrição", placeholder="Ex: Mercado, Uber, Jantar",
                    max_chars=CFG.MAX_DESC_LENGTH,
                )
            with qc2:
                q_val = st.number_input("Valor (R$)", min_value=0.01, step=10.0)
            qc3, qc4 = st.columns(2)
            with qc3:
                q_cat = st.selectbox("Categoria", _cat_list, index=_cat_idx)
            with qc4:
                q_min = date(sel_yr, sel_mo, 1)
                q_max = date(sel_yr, sel_mo, calendar.monthrange(sel_yr, sel_mo)[1])
                q_date = st.date_input(
                    "Data", default_form_date(sel_mo, sel_yr),
                    min_value=q_min, max_value=q_max, format="DD/MM/YYYY"
                )
            qc5, qc6 = st.columns(2)
            with qc5:
                q_resp_opts = list(CFG.RESPONSAVEIS)
                q_resp_idx = q_resp_opts.index(user) if user in q_resp_opts else 0
                q_resp = st.selectbox("Responsável", q_resp_opts, index=q_resp_idx)
            with qc6:
                q_tag = st.text_input("Tag", placeholder="opcional", max_chars=50, key="q_tag")
            if st.form_submit_button("REGISTRAR GASTO", use_container_width=True):
                entry = {
                    "Data": q_date,
                    "Descricao": q_desc.strip(),
                    "Valor": q_val,
                    "Categoria": q_cat,
                    "Tipo": CFG.TIPO_SAIDA,
                    "Responsavel": q_resp,
                    "Origem": CFG.ORIGEM_MANUAL,
                    "Tag": q_tag.strip() if q_tag else "",
                }
                ok, err = validate_transaction(entry)
                if not ok:
                    st.toast(f"⚠ {err}")
                else:
                    is_dup = check_duplicate(mx.df_month, q_desc.strip(), q_val, q_date)
                    if save_entry(entry, "Transacoes"):
                        # U6: Remember last category
                        st.session_state[_last_cat_key] = q_cat
                        if is_dup:
                            st.toast(f"⚠ Possível duplicata: {q_desc.strip()} — {fmt_brl(q_val)}")
                        else:
                            st.toast(f"✓ {q_desc.strip()} — {fmt_brl(q_val)}")
                        st.rerun()

        # --- Favoritos (X6) ---
        df_fav_user = filter_by_user(df_favoritos, user, include_shared=True)
        if not df_fav_user.empty:
            df_fav_sorted = df_fav_user.sort_values(
                "Ordem", ascending=True
            ).reset_index(drop=True)
            st.markdown(
                '<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
                'color:#555;text-transform:uppercase;letter-spacing:0.15em;'
                'padding:8px 0 4px 0;border-top:1px solid #111;margin-top:8px;">'
                '⭐ Favoritos</div>',
                unsafe_allow_html=True,
            )
            _n_fav_show = min(len(df_fav_sorted), 6)
            _fav_cols = st.columns(min(_n_fav_show, 3))
            for i, (_, fav) in enumerate(df_fav_sorted.head(_n_fav_show).iterrows()):
                with _fav_cols[i % min(_n_fav_show, 3)]:
                    _fv_desc = str(fav.get("Descricao", fav.get("Nome", "")))[:18]
                    _fv_cat = str(fav["Categoria"])
                    _fv_val = float(fav["Valor"])
                    _fv_tipo = str(fav["Tipo"]).strip()
                    if st.button(
                        f"⭐ {_fv_desc} — {fmt_brl(_fv_val)}",
                        key=f"fav_{i}_{fav['Id']}",
                        use_container_width=True,
                        help=f"{_fv_cat} · {_fv_tipo}",
                    ):
                        fav_entry = {
                            "Data": default_form_date(sel_mo, sel_yr),
                            "Descricao": str(fav.get("Descricao", fav.get("Nome", ""))).strip(),
                            "Valor": _fv_val,
                            "Categoria": _fv_cat,
                            "Tipo": _fv_tipo,
                            "Responsavel": str(fav["Responsavel"]).strip(),
                            "Origem": CFG.ORIGEM_MANUAL,
                            "Tag": str(fav.get("Tag", "")).strip(),
                        }
                        if save_entry(fav_entry, "Transacoes"):
                            st.toast(f"✓ {_fv_desc} — {fmt_brl(_fv_val)}")
                            st.rerun()

        # --- Repetir Último Gasto (N4) ---
        if not mx.df_month.empty:
            _df_last_gastos = mx.df_month[
                (mx.df_month["Tipo"] == CFG.TIPO_SAIDA)
                & (mx.df_month["Categoria"] != CFG.CAT_INVESTIMENTO)
            ].copy()
            if not _df_last_gastos.empty:
                _df_last_gastos["Data"] = pd.to_datetime(
                    _df_last_gastos["Data"], errors="coerce"
                )
                _last = _df_last_gastos.sort_values("Data", ascending=False).iloc[0]
                _l_desc = str(_last.get("Descricao", ""))
                _l_val = float(_last.get("Valor", 0))
                _l_cat = str(_last.get("Categoria", ""))
                _l_resp = str(_last.get("Responsavel", ""))
                _l_tag = str(_last.get("Tag", "")).strip()
                st.markdown(
                    f'<div style="font-family:JetBrains Mono,monospace;font-size:0.6rem;'
                    f'color:#555;padding:8px 0;border-top:1px solid #111;margin-top:8px;">'
                    f'Último: <span style="color:#888;">{sanitize(_l_desc)}</span>'
                    f' · {sanitize(_l_cat)} · {fmt_brl(_l_val)}</div>',
                    unsafe_allow_html=True,
                )
                if st.button(
                    f"⟳ REPETIR: {_l_desc[:25]} — {fmt_brl(_l_val)}",
                    key="dup_last_tx",
                    use_container_width=True,
                ):
                    dup_entry = {
                        "Data": default_form_date(sel_mo, sel_yr),
                        "Descricao": _l_desc.strip(),
                        "Valor": _l_val,
                        "Categoria": _l_cat,
                        "Tipo": CFG.TIPO_SAIDA,
                        "Responsavel": _l_resp,
                        "Origem": CFG.ORIGEM_MANUAL,
                        "Tag": _l_tag,
                    }
                    if save_entry(dup_entry, "Transacoes"):
                        st.toast(f"✓ Duplicado: {_l_desc} — {fmt_brl(_l_val)}")
                        st.rerun()

        # --- Templates Rápidos (N2 — lazy P1) ---
        _frequent_tx = compute_frequent_transactions(df_trans, user)
        if _frequent_tx:
            st.markdown(
                '<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
                'color:#555;text-transform:uppercase;letter-spacing:0.15em;'
                'padding:8px 0 4px 0;border-top:1px solid #111;margin-top:8px;">'
                '◆ Templates Frequentes</div>',
                unsafe_allow_html=True,
            )
            _tpl_cols = st.columns(min(len(_frequent_tx), 3))
            for i, tpl in enumerate(_frequent_tx[:3]):
                with _tpl_cols[i]:
                    _tpl_label = f"{tpl['desc'][:18]}\n{tpl['cat']} · ~{fmt_brl(tpl['avg_valor'])}"
                    if st.button(
                        _tpl_label,
                        key=f"tpl_{i}_{tpl['desc'][:10]}",
                        use_container_width=True,
                    ):
                        tpl_entry = {
                            "Data": default_form_date(sel_mo, sel_yr),
                            "Descricao": tpl["desc"].strip(),
                            "Valor": round(tpl["avg_valor"], 2),
                            "Categoria": tpl["cat"],
                            "Tipo": CFG.TIPO_SAIDA,
                            "Responsavel": tpl["resp"],
                            "Origem": CFG.ORIGEM_MANUAL,
                            "Tag": "",
                        }
                        if save_entry(tpl_entry, "Transacoes"):
                            st.toast(
                                f"✓ Template: {tpl['desc']} — {fmt_brl(tpl['avg_valor'])}"
                            )
                            st.rerun()

    # ===== ABAS =====
    tab_ls, tab_renda, tab_pat, tab_rec, tab_metas, tab_hist, tab_cfg = st.tabs([
        "GASTOS", "RENDA", "PATRIMÔNIO", "FIXOS", "METAS", "HISTÓRICO", "CONFIG"
    ])

    with tab_ls:
        col_form, col_intel = st.columns([1, 1])
        with col_form:
            render_intel(
                "Consumo Mensal",
                f"Total: <strong>{fmt_brl(mx.lifestyle)}</strong>"
            )
            if budget_data:
                render_budget_bars(budget_data)
            if mx.cat_breakdown:
                _sparklines = compute_category_sparklines(df_trans, user, sel_mo, sel_yr)
                render_cat_breakdown(mx.cat_breakdown, sparklines=_sparklines)
            transaction_form(
                form_key="f_lifestyle",
                tipo=CFG.TIPO_SAIDA,
                categorias=list(CFG.CATEGORIAS_SAIDA),
                submit_label="REGISTRAR SAÍDA",
                desc_placeholder="Ex: Mercado, Uber, Jantar",
                default_step=10.0,
                sel_mo=sel_mo, sel_yr=sel_yr,
                default_resp=user,
                df_month=mx.df_month,
            )
            render_recent_context(mx.df_month, CFG.TIPO_SAIDA)
        with col_intel:
            render_intel("Intel — Gastos", mx.insight_ls)
            evo_data = compute_evolution(df_trans, user, sel_mo, sel_yr)
            render_evolution_chart(evo_data)

            # --- Radiografia ---
            render_top_gastos(
                mx.top5_gastos,
                mx.ticket_medio,
                mx.split_gastos,
                mx.dia_mais_caro,
                mx.dia_mais_caro_val,
                mx.dia_mais_caro_count,
            )

            # --- Anomalias (I2 — lazy P1) ---
            _anomalies = compute_anomalies(df_trans, user, sel_mo, sel_yr)
            if _anomalies:
                render_anomalies(_anomalies)

            # --- Heatmap calendário (V5 — lazy P1) ---
            _heatmap = compute_calendar_heatmap(mx.df_month, sel_mo, sel_yr)
            render_calendar_heatmap(_heatmap)

            # --- Padrão semanal (lazy P1) ---
            _weekday = compute_weekday_pattern(mx.df_month)
            render_weekday_pattern(_weekday)

            # --- Tags (lazy P1) ---
            _tags = compute_tag_summary(df_trans, user, sel_mo, sel_yr)
            if _tags:
                render_tag_summary(_tags)

            # --- Gestão de Orçamentos ---
            st.markdown("---")
            render_intel(
                "Definir Orçamento",
                "Defina limites mensais por categoria de gasto"
            )
            orcamento_form(default_resp=user, df_existing=df_orcamentos)

            df_orc_view = filter_by_user(df_orcamentos, user, include_shared=True)
            if not df_orc_view.empty:
                edited_orc = st.data_editor(
                    df_orc_view,
                    use_container_width=True,
                    num_rows="dynamic",
                    column_config={
                        "Categoria": st.column_config.SelectboxColumn(
                            "Categoria", options=list(CFG.CATEGORIAS_SAIDA), required=True
                        ),
                        "Limite": st.column_config.NumberColumn(
                            "Limite", format="R$ %.2f", required=True, min_value=0.01
                        ),
                        "Responsavel": st.column_config.SelectboxColumn(
                            "Responsável", options=list(CFG.RESPONSAVEIS)
                        ),
                    },
                    hide_index=True,
                    key=f"editor_orcamento_{user}",
                )

                if not _df_equals_safe(df_orc_view, edited_orc):
                    c_save, c_cancel = st.columns(2)
                    with c_save:
                        if st.button(
                            "✓ SALVAR ORÇAMENTOS",
                            key=f"save_orc_{user}",
                            use_container_width=True,
                        ):
                            orc_errors = []
                            for idx, row in edited_orc.iterrows():
                                entry = {
                                    "Categoria": row.get("Categoria", ""),
                                    "Limite": row.get("Limite", 0),
                                    "Responsavel": row.get("Responsavel", ""),
                                }
                                ok, err = validate_orcamento(entry)
                                if not ok:
                                    orc_errors.append(f"Linha {idx + 1}: {err}")
                            if orc_errors:
                                for oe in orc_errors[:5]:
                                    st.error(f"⚠ {oe}")
                            else:
                                if _save_filtered_sheet(df_orcamentos, edited_orc, user, "Orcamentos"):
                                    st.toast("✓ Orçamentos atualizados")
                                    st.rerun()
                    with c_cancel:
                        if st.button(
                            "✗ DESCARTAR",
                            key=f"discard_orc_{user}",
                            use_container_width=True,
                        ):
                            st.rerun()

    with tab_renda:
        col_form, col_intel = st.columns([1, 1])
        with col_form:
            render_intel(
                "Entradas do Mês",
                f"Total: <strong>{fmt_brl(mx.renda)}</strong>"
            )
            if mx.renda_breakdown:
                render_cat_breakdown(mx.renda_breakdown)
            transaction_form(
                form_key="f_renda",
                tipo=CFG.TIPO_ENTRADA,
                categorias=list(CFG.CATEGORIAS_ENTRADA),
                submit_label="REGISTRAR ENTRADA",
                desc_placeholder="Ex: Salário, Freelance",
                default_step=100.0,
                sel_mo=sel_mo, sel_yr=sel_yr,
                default_resp=user,
                df_month=mx.df_month,
            )
            render_recent_context(mx.df_month, CFG.TIPO_ENTRADA)
        with col_intel:
            render_intel("Intel — Renda", mx.insight_renda)
            renda_evo = compute_renda_evolution(df_trans, user, sel_mo, sel_yr)
            render_renda_chart(renda_evo)
            if mx.renda_breakdown and len(mx.renda_breakdown) > 1:
                principal = list(mx.renda_breakdown.keys())[0]
                principal_val = list(mx.renda_breakdown.values())[0]
                principal_pct = (principal_val / mx.renda * 100) if mx.renda > 0 else 0
                render_intel(
                    "Composição",
                    f"{len(mx.renda_breakdown)} fontes de renda · "
                    f"Principal: <strong>{sanitize(principal)}</strong> ({principal_pct:.0f}%)"
                )

    with tab_pat:
        df_assets_view = filter_by_user(df_assets, user, include_shared=True)
        df_passivos_view = filter_by_user(df_passivos, user, include_shared=True)
        total_pat = df_assets_view["Valor"].sum() if not df_assets_view.empty else 0
        total_passivos = df_passivos_view["Valor"].sum() if not df_passivos_view.empty else 0
        patrimonio_liquido = mx.sobrevivencia - total_passivos

        _pl_color = "#00FFCC" if patrimonio_liquido >= 0 else "#FF4444"
        render_intel(
            "Patrimônio & Investimentos",
            f"Patrimônio Líquido: <strong style='color:{_pl_color};'>"
            f"{fmt_brl(patrimonio_liquido)}</strong><br>"
            f"Ativos: <strong>{fmt_brl(mx.sobrevivencia)}</strong> · "
            f"Passivos: <strong style='color:#FF4444;'>{fmt_brl(total_passivos)}</strong> · "
            f"Autonomia: <strong>{mx.autonomia:.1f} meses</strong><br>"
            f"Investido (mês): <strong>{fmt_brl(mx.investido_mes)}</strong> · "
            f"Acumulado: <strong>{fmt_brl(mx.investido_total)}</strong> · "
            f"Base patrimonial: <strong>{fmt_brl(total_pat)}</strong>"
        )

        col_left, col_right = st.columns([1, 1])

        with col_left:
            render_intel(
                "📥 Registrar Aporte",
                "Investimentos, aportes mensais, compras de ativos"
            )
            wealth_form(sel_mo=sel_mo, sel_yr=sel_yr, default_resp=user, df_month=mx.df_month)

            # Contexto: últimos aportes do mês
            df_inv_ctx = mx.df_month[
                (mx.df_month["Tipo"] == CFG.TIPO_SAIDA) &
                (mx.df_month["Categoria"] == CFG.CAT_INVESTIMENTO)
            ] if not mx.df_month.empty else pd.DataFrame()
            if not df_inv_ctx.empty:
                df_inv_ctx = df_inv_ctx.sort_values("Data", ascending=False).head(3)
                ctx_html = '<div style="margin-top:8px;padding:8px 0;border-top:1px solid #111;">'
                ctx_html += '<div class="intel-title" style="font-size:0.55rem;margin-bottom:6px;">Últimos aportes</div>'
                for _, row in df_inv_ctx.iterrows():
                    desc = sanitize(str(row.get("Descricao", "")))[:35]
                    val = fmt_brl(float(row.get("Valor", 0)))
                    ctx_html += (
                        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.6rem;'
                        f'color:#555;padding:2px 0;display:flex;justify-content:space-between;">'
                        f'<span>{desc}</span><span>{val}</span></div>'
                    )
                ctx_html += '</div>'
                st.markdown(ctx_html, unsafe_allow_html=True)

            st.markdown("---")

            if not df_assets_view.empty and "Responsavel" in df_assets_view.columns:
                totais = df_assets_view.groupby("Responsavel")["Valor"].sum()
                partes = " | ".join(
                    [f"{sanitize(str(r))}: <strong>{fmt_brl(v)}</strong>" for r, v in totais.items()]
                )
            else:
                partes = "Nenhum ativo registrado"
            render_intel(
                "🏦 Base Patrimonial",
                f"Saldos e ativos estáticos<br>{partes}"
            )
            patrimonio_form(default_resp=user)

            # --- Passivos (I5) ---
            st.markdown("---")
            _passivos_total_text = (
                f"Saldo devedor total: <strong style='color:#FF4444;'>"
                f"{fmt_brl(total_passivos)}</strong>"
                if total_passivos > 0
                else "Nenhum passivo registrado"
            )
            render_intel("📉 Passivos (Dívidas)", _passivos_total_text)
            passivo_form(default_resp=user)

            if not df_passivos_view.empty:
                edited_passivos = st.data_editor(
                    df_passivos_view,
                    use_container_width=True,
                    num_rows="dynamic",
                    column_config={
                        "Item": st.column_config.TextColumn("Dívida", required=True),
                        "Valor": st.column_config.NumberColumn(
                            "Saldo Devedor", format="R$ %.2f",
                            required=True, min_value=0.01,
                        ),
                        "Responsavel": st.column_config.SelectboxColumn(
                            "Responsável", options=list(CFG.RESPONSAVEIS),
                        ),
                    },
                    hide_index=True,
                    key=f"editor_passivos_{user}",
                )
                if not _df_equals_safe(df_passivos_view, edited_passivos):
                    c_save, c_cancel = st.columns(2)
                    with c_save:
                        if st.button(
                            "✓ SALVAR PASSIVOS",
                            key=f"save_pass_{user}",
                            use_container_width=True,
                        ):
                            pass_errors = []
                            for idx, row in edited_passivos.iterrows():
                                entry = {
                                    "Item": row.get("Item", ""),
                                    "Valor": row.get("Valor", 0),
                                    "Responsavel": row.get("Responsavel", ""),
                                }
                                ok, err = validate_passivo(entry)
                                if not ok:
                                    pass_errors.append(f"Linha {idx + 1}: {err}")
                            if pass_errors:
                                for pe in pass_errors[:5]:
                                    st.error(f"⚠ {pe}")
                            else:
                                if _save_filtered_sheet(
                                    df_passivos, edited_passivos, user, "Passivos"
                                ):
                                    st.toast("✓ Passivos atualizados")
                                    st.rerun()
                    with c_cancel:
                        if st.button(
                            "✗ DESCARTAR",
                            key=f"discard_pass_{user}",
                            use_container_width=True,
                        ):
                            st.rerun()

        with col_right:
            # --- Gráfico Evolução Patrimonial (lazy P1) ---
            _pat_evo = compute_patrimonio_evolution(
                df_trans, df_assets, user, sel_mo, sel_yr,
            )
            render_patrimonio_chart(_pat_evo)

            render_intel(
                "Ativos Registrados",
                f"{len(df_assets_view)} itens no patrimônio base"
            )
            if not df_assets_view.empty:
                edited_assets = st.data_editor(
                    df_assets_view,
                    use_container_width=True,
                    num_rows="dynamic",
                    column_config={
                        "Item": st.column_config.TextColumn("Ativo", required=True),
                        "Valor": st.column_config.NumberColumn(
                            "Valor", format="R$ %.2f", required=True, min_value=0.01
                        ),
                        "Responsavel": st.column_config.SelectboxColumn(
                            "Titular", options=list(CFG.RESPONSAVEIS)
                        ),
                    },
                    hide_index=True,
                    key=f"editor_patrimonio_{user}",
                )
                if not _df_equals_safe(df_assets_view, edited_assets):
                    c_save, c_cancel = st.columns(2)
                    with c_save:
                        if st.button("✓ SALVAR PATRIMÔNIO", key=f"save_pat_{user}", use_container_width=True):
                            pat_errors = []
                            for idx, row in edited_assets.iterrows():
                                entry = {
                                    "Item": row.get("Item", ""),
                                    "Valor": row.get("Valor", 0),
                                    "Responsavel": row.get("Responsavel", ""),
                                }
                                ok, err = validate_asset(entry)
                                if not ok:
                                    pat_errors.append(f"Linha {idx + 1}: {err}")
                            if pat_errors:
                                for pe in pat_errors[:5]:
                                    st.error(f"⚠ {pe}")
                            else:
                                if _save_filtered_sheet(df_assets, edited_assets, user, "Patrimonio"):
                                    st.toast("✓ Patrimônio atualizado")
                                    st.rerun()
                    with c_cancel:
                        if st.button("✗ DESCARTAR", key=f"discard_pat_{user}", use_container_width=True):
                            st.rerun()
            else:
                render_intel("", "Adicione ativos usando o formulário ao lado.")

    with tab_rec:
        col_form, col_list = st.columns([1, 1])

        df_rec_view = filter_by_user(df_recorrentes, user, include_shared=True)

        with col_form:
            if not pendentes.empty:
                total_pendente = pendentes["Valor"].sum()
                render_pending_box(len(pendentes), total_pendente)

                for _, rec in pendentes.iterrows():
                    tipo_cls = "rec-badge-saida" if rec["Tipo"] == CFG.TIPO_SAIDA else "rec-badge-entrada"
                    st.markdown(
                        f'<div class="rec-card">'
                        f'<div class="rec-card-left">'
                        f'<span class="rec-card-desc">{sanitize(str(rec["Descricao"]))}</span>'
                        f'<span class="rec-card-meta">'
                        f'{sanitize(str(rec["Categoria"]))} · Dia {int(rec["DiaVencimento"])}'
                        f'</span>'
                        f'</div>'
                        f'<div class="rec-card-right">'
                        f'<span class="rec-card-valor">{fmt_brl(float(rec["Valor"]))}</span>'
                        f'<span class="rec-card-badge {tipo_cls}">{sanitize(str(rec["Tipo"]))}</span>'
                        f'</div>'
                        f'</div>',
                        unsafe_allow_html=True
                    )

                n_pend = len(pendentes)
                if st.button(
                    f"⟳ GERAR {n_pend} RECORRENTE{'S' if n_pend > 1 else ''}",
                    key=f"gen_rec_{user}_{sel_mo}_{sel_yr}",
                    use_container_width=True,
                ):
                    result = generate_recorrentes(pendentes, sel_mo, sel_yr)
                    if result:
                        parts = []
                        if result["entradas"] > 0:
                            parts.append(f"{result['entradas']} entrada{'s' if result['entradas'] > 1 else ''}")
                        if result["saidas"] > 0:
                            parts.append(f"{result['saidas']} saída{'s' if result['saidas'] > 1 else ''}")
                        detail = " + ".join(parts) if parts else ""
                        st.toast(f"✓ {result['count']} geradas ({detail}) — {fmt_brl(result['total'])}")
                        st.rerun()
                    else:
                        st.error("Falha ao gerar recorrentes")
            else:
                render_intel(
                    "Recorrentes",
                    f"Nenhuma pendente em <strong>{sanitize(month_label)}</strong>"
                )

            st.markdown("---")
            render_intel("Nova Despesa/Receita Fixa", "Cadastre aqui os gastos e receitas que se repetem todo mês")
            recorrente_form(default_resp=user, df_existing=df_rec_view)

        with col_list:
            n_ativas = 0
            total_saidas_fix = 0.0
            total_entradas_fix = 0.0
            if not df_rec_view.empty:
                mask_ativo = df_rec_view["Ativo"].eq(True)
                n_ativas = int(mask_ativo.sum())
                total_saidas_fix = df_rec_view[
                    mask_ativo & (df_rec_view["Tipo"] == CFG.TIPO_SAIDA)
                ]["Valor"].sum()
                total_entradas_fix = df_rec_view[
                    mask_ativo & (df_rec_view["Tipo"] == CFG.TIPO_ENTRADA)
                ]["Valor"].sum()

            render_intel(
                "Recorrentes Cadastradas",
                f"<strong>{n_ativas}</strong> ativas · "
                f"Saídas fixas: <strong>{fmt_brl(total_saidas_fix)}</strong> · "
                f"Entradas fixas: <strong>{fmt_brl(total_entradas_fix)}</strong>"
            )

            if not df_rec_view.empty:
                edited_rec = st.data_editor(
                    df_rec_view,
                    use_container_width=True,
                    num_rows="dynamic",
                    column_config={
                        "Descricao": st.column_config.TextColumn(
                            "Descrição", required=True
                        ),
                        "Valor": st.column_config.NumberColumn(
                            "Valor", format="R$ %.2f", required=True, min_value=0.01
                        ),
                        "Categoria": st.column_config.SelectboxColumn(
                            "Categoria", options=list(CFG.CATEGORIAS_TODAS), required=True
                        ),
                        "Tipo": st.column_config.SelectboxColumn(
                            "Tipo", options=list(CFG.TIPOS), required=True
                        ),
                        "Responsavel": st.column_config.SelectboxColumn(
                            "Responsável", options=list(CFG.RESPONSAVEIS)
                        ),
                        "DiaVencimento": st.column_config.NumberColumn(
                            "Dia", min_value=1, max_value=28, required=True
                        ),
                        "Ativo": st.column_config.CheckboxColumn(
                            "Ativo", default=True
                        ),
                    },
                    hide_index=True,
                    key=f"editor_recorrentes_{user}",
                )

                if not _df_equals_safe(df_rec_view, edited_rec):
                    c_save, c_cancel = st.columns(2)
                    with c_save:
                        if st.button(
                            "✓ SALVAR RECORRENTES",
                            key=f"save_rec_{user}",
                            use_container_width=True,
                        ):
                            rec_errors = []
                            for idx, row in edited_rec.iterrows():
                                try:
                                    dia_val = int(row.get("DiaVencimento", 1))
                                except (ValueError, TypeError):
                                    dia_val = 0
                                entry = {
                                    "Descricao": row.get("Descricao", ""),
                                    "Valor": row.get("Valor", 0),
                                    "Categoria": row.get("Categoria", ""),
                                    "Tipo": row.get("Tipo", ""),
                                    "Responsavel": row.get("Responsavel", ""),
                                    "DiaVencimento": dia_val,
                                }
                                ok, err = validate_recorrente(entry)
                                if not ok:
                                    rec_errors.append(f"Linha {idx + 1}: {err}")
                            if rec_errors:
                                for re_err in rec_errors[:5]:
                                    st.error(f"⚠ {re_err}")
                                if len(rec_errors) > 5:
                                    st.error(
                                        f"... e mais {len(rec_errors) - 5} erro(s)"
                                    )
                            else:
                                if _save_filtered_sheet(df_recorrentes, edited_rec, user, "Recorrentes"):
                                    st.toast("✓ Recorrentes atualizadas")
                                    st.rerun()
                    with c_cancel:
                        if st.button(
                            "✗ DESCARTAR",
                            key=f"discard_rec_{user}",
                            use_container_width=True,
                        ):
                            st.rerun()
            else:
                render_intel(
                    "",
                    "Nenhuma recorrente cadastrada. Use o formulário ao lado."
                )

    with tab_metas:
        render_intel(
            "🎯 Metas Financeiras",
            "Defina objetivos, acompanhe progresso e veja projeções."
        )
        metas_progress = compute_meta_progress(df_metas, user)

        col_metas_l, col_metas_r = st.columns([1, 1])
        with col_metas_l:
            render_metas(metas_progress)
        with col_metas_r:
            render_intel("Nova Meta", "Defina um objetivo financeiro com prazo")
            meta_form(default_resp=user)
            df_metas_view = filter_by_user(df_metas, user, include_shared=True)
            if not df_metas_view.empty:
                st.markdown("---")
                render_intel(
                    "Gerenciar Metas",
                    f"{len(df_metas_view)} meta(s) cadastrada(s)"
                )
                edited_metas = st.data_editor(
                    df_metas_view,
                    use_container_width=True,
                    num_rows="dynamic",
                    column_config={
                        "Id": None,
                        "Nome": st.column_config.TextColumn("Meta", required=True),
                        "ValorAlvo": st.column_config.NumberColumn(
                            "Alvo", format="R$ %.2f", required=True, min_value=0.01,
                        ),
                        "ValorAtual": st.column_config.NumberColumn(
                            "Atual", format="R$ %.2f", required=True, min_value=0.0,
                        ),
                        "Prazo": st.column_config.TextColumn("Prazo", max_chars=7),
                        "Responsavel": st.column_config.SelectboxColumn(
                            "Responsável", options=list(CFG.RESPONSAVEIS),
                        ),
                        "Ativo": st.column_config.CheckboxColumn("Ativo", default=True),
                    },
                    hide_index=True,
                    key=f"editor_metas_{user}",
                )
                if not _df_equals_safe(df_metas_view, edited_metas):
                    c_save, c_cancel = st.columns(2)
                    with c_save:
                        if st.button(
                            "✓ SALVAR METAS",
                            key=f"save_metas_{user}",
                            use_container_width=True,
                        ):
                            if _save_filtered_sheet(
                                df_metas, edited_metas, user, "Metas"
                            ):
                                st.toast("✓ Metas atualizadas")
                                st.rerun()
                    with c_cancel:
                        if st.button(
                            "✗ DESCARTAR",
                            key=f"discard_metas_{user}",
                            use_container_width=True,
                        ):
                            st.rerun()

    with tab_hist:
        # --- Import CSV (N1) ---
        with st.expander("📎 Importar Extrato Bancário"):
            csv_file = st.file_uploader(
                "CSV do banco", type=["csv"], key="csv_upload",
            )
            _csv_c1, _csv_c2 = st.columns(2)
            with _csv_c1:
                csv_bank = st.selectbox(
                    "Formato", ["Nubank", "Inter", "Manual"], key="csv_bank",
                )
            with _csv_c2:
                _csv_resp_opts = list(CFG.RESPONSAVEIS)
                _csv_resp_idx = (
                    _csv_resp_opts.index(user)
                    if user in _csv_resp_opts
                    else 0
                )
                csv_resp = st.selectbox(
                    "Responsável", _csv_resp_opts,
                    index=_csv_resp_idx, key="csv_resp",
                )

            if csv_file is not None:
                df_parsed = parse_bank_csv(csv_file, csv_bank, csv_resp)
                if df_parsed is not None and not df_parsed.empty:
                    n_dup = 0
                    if not mx.df_month.empty:
                        for _, _pr in df_parsed.iterrows():
                            if check_duplicate(
                                mx.df_month,
                                str(_pr["Descricao"]),
                                float(_pr["Valor"]),
                                _pr["Data"],
                            ):
                                n_dup += 1

                    _n_ent = len(
                        df_parsed[df_parsed["Tipo"] == CFG.TIPO_ENTRADA]
                    )
                    _n_sai = len(
                        df_parsed[df_parsed["Tipo"] == CFG.TIPO_SAIDA]
                    )
                    _dup_warn = (
                        f"<br>⚠ {n_dup} possíveis duplicatas"
                        if n_dup > 0
                        else ""
                    )

                    st.markdown(
                        f'<div class="intel-box">'
                        f'<div class="intel-title">'
                        f'Preview — {len(df_parsed)} transações</div>'
                        f'<div class="intel-body">'
                        f'Entradas: {_n_ent} · Saídas: {_n_sai}'
                        f'{_dup_warn}</div></div>',
                        unsafe_allow_html=True,
                    )

                    st.dataframe(
                        df_parsed[
                            ["Data", "Descricao", "Valor", "Categoria", "Tipo"]
                        ].head(20),
                        use_container_width=True,
                        hide_index=True,
                    )

                    if st.button(
                        f"IMPORTAR {len(df_parsed)} TRANSAÇÕES",
                        key="csv_import_btn",
                        use_container_width=True,
                    ):
                        imported = 0
                        for _, _row_csv in df_parsed.iterrows():
                            entry = _row_csv.to_dict()
                            ok, _ = validate_transaction(entry)
                            if ok and save_entry(
                                entry,
                                "Transacoes",
                                skip_audit=True,
                                skip_rate_limit=True,
                            ):
                                imported += 1
                        if imported > 0:
                            _log_audit(
                                "CSV_IMPORT",
                                "Transacoes",
                                f"{imported} via {csv_bank}",
                            )
                            st.toast(f"✓ {imported} transações importadas")
                            st.rerun()
                        else:
                            st.error("Nenhuma transação importada")
                else:
                    if csv_file is not None:
                        st.warning(
                            "Não foi possível processar o CSV. "
                            "Verifique se o formato corresponde ao banco selecionado."
                        )

        # [FIX B2] Removido df_trans da chamada
        _render_historico(mx, user, sel_mo, sel_yr)

        # --- Lixeira (S3) ---
        if not df_lixeira.empty:
            with st.expander(f"🗑 Lixeira ({len(df_lixeira)} itens)"):
                render_intel(
                    "Transações Excluídas",
                    f"{len(df_lixeira)} transações na lixeira (máx 200, auto-limpa)"
                )
                df_lixeira_display = df_lixeira.copy()
                if "Data" in df_lixeira_display.columns:
                    df_lixeira_display["Data"] = pd.to_datetime(
                        df_lixeira_display["Data"], errors="coerce"
                    )
                df_lixeira_sorted = df_lixeira_display.sort_values(
                    "DeletadoEm", ascending=False
                ).head(20).reset_index(drop=True)

                st.dataframe(
                    df_lixeira_sorted[
                        [c for c in ["DeletadoEm", "Data", "Descricao", "Valor", "Categoria", "Tipo"]
                         if c in df_lixeira_sorted.columns]
                    ],
                    use_container_width=True,
                    hide_index=True,
                )

                _sel_restore = st.multiselect(
                    "Selecione para restaurar",
                    options=df_lixeira_sorted.index.tolist(),
                    format_func=lambda i: (
                        f"{df_lixeira_sorted.loc[i, 'Descricao']}"
                        f" — {fmt_brl(float(df_lixeira_sorted.loc[i, 'Valor']))}"
                    ),
                    key="restore_sel",
                )
                if _sel_restore and st.button(
                    f"↩ RESTAURAR {len(_sel_restore)} TRANSAÇÃO(ÕES)",
                    key="restore_btn",
                    use_container_width=True,
                ):
                    rows_to_restore = df_lixeira_sorted.loc[_sel_restore]
                    if _restore_from_lixeira(rows_to_restore):
                        st.toast(f"✓ {len(_sel_restore)} restaurada(s)")
                        st.rerun()
                    else:
                        st.error("Falha ao restaurar")

    with tab_cfg:
        render_intel(
            "⚙ Configurações",
            f"Personalize metas e comportamento do app · Perfil: <strong>{sanitize(user)}</strong>"
        )

        cfg_left, cfg_right = st.columns([1, 1])

        with cfg_left:
            render_intel(
                "Metas Financeiras",
                "Regra de alocação de renda. Os 3 valores devem somar 100%."
            )
            with st.form("f_config", clear_on_submit=False):
                cc1, cc2, cc3 = st.columns(3)
                with cc1:
                    cfg_nec = st.number_input(
                        "Necessidades %", min_value=0, max_value=100,
                        value=user_config.meta_necessidades, step=5,
                    )
                with cc2:
                    cfg_des = st.number_input(
                        "Desejos %", min_value=0, max_value=100,
                        value=user_config.meta_desejos, step=5,
                    )
                with cc3:
                    cfg_inv = st.number_input(
                        "Investimento %", min_value=0, max_value=100,
                        value=user_config.meta_investimento, step=5,
                    )

                cfg_total = cfg_nec + cfg_des + cfg_inv
                if cfg_total != 100:
                    st.markdown(
                        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.65rem;'
                        f'color:#FF4444;padding:4px 0;">Total: {cfg_total}% (deve ser 100%)</div>',
                        unsafe_allow_html=True,
                    )
                else:
                    st.markdown(
                        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.65rem;'
                        f'color:#00FFCC;padding:4px 0;">✓ Total: 100%</div>',
                        unsafe_allow_html=True,
                    )

                st.markdown("---")
                cfg_auto_alvo = st.number_input(
                    "Autonomia — Meta (meses)",
                    min_value=1, max_value=120,
                    value=user_config.autonomia_alvo, step=1,
                    help="Quantos meses de reserva você quer como objetivo",
                )
                cfg_auto_gen = st.checkbox(
                    "Auto-gerar recorrentes ao navegar para mês novo",
                    value=user_config.auto_gerar_recorrentes,
                    help="Se ativo, recorrentes pendentes são geradas automaticamente",
                )

                if st.form_submit_button("SALVAR CONFIGURAÇÕES", use_container_width=True):
                    if cfg_total != 100:
                        st.error(f"As metas devem somar 100% (atual: {cfg_total}%)")
                    elif cfg_auto_alvo < 1:
                        st.error("Autonomia-alvo deve ser ao menos 1 mês")
                    else:
                        new_config = UserConfig(
                            meta_necessidades=cfg_nec,
                            meta_desejos=cfg_des,
                            meta_investimento=cfg_inv,
                            autonomia_alvo=cfg_auto_alvo,
                            autonomia_warn=max(1, cfg_auto_alvo // 2),
                            auto_gerar_recorrentes=cfg_auto_gen,
                        )
                        if save_config(new_config, user):
                            st.toast("✓ Configurações salvas")
                            st.rerun()

        with cfg_right:
            render_intel(
                "Configuração Atual",
                f"Perfil: <strong>{sanitize(user)}</strong>"
            )

            # Preview visual das metas
            current_html = (
                f'<div class="t-panel">'
                f'<div style="font-family:JetBrains Mono,monospace;font-size:0.6rem;'
                f'color:#555;text-transform:uppercase;letter-spacing:0.15em;'
                f'margin-bottom:10px;">Regra de Alocação</div>'

                f'<div style="display:flex;gap:12px;margin-bottom:12px;">'

                f'<div style="flex:1;text-align:center;padding:12px;border:1px solid #1a1a1a;">'
                f'<div style="font-family:JetBrains Mono,monospace;font-size:1.2rem;'
                f'color:#F0F0F0;font-weight:700;">{user_config.meta_necessidades}%</div>'
                f'<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
                f'color:#555;margin-top:2px;">Necessidades</div></div>'

                f'<div style="flex:1;text-align:center;padding:12px;border:1px solid #1a1a1a;">'
                f'<div style="font-family:JetBrains Mono,monospace;font-size:1.2rem;'
                f'color:#FFAA00;font-weight:700;">{user_config.meta_desejos}%</div>'
                f'<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
                f'color:#555;margin-top:2px;">Desejos</div></div>'

                f'<div style="flex:1;text-align:center;padding:12px;border:1px solid #1a1a1a;">'
                f'<div style="font-family:JetBrains Mono,monospace;font-size:1.2rem;'
                f'color:#00FFCC;font-weight:700;">{user_config.meta_investimento}%</div>'
                f'<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
                f'color:#555;margin-top:2px;">Investimento</div></div>'

                f'</div>'

                f'<div style="font-family:JetBrains Mono,monospace;font-size:0.62rem;'
                f'color:#888;padding:8px 0;border-top:1px solid #111;">'
                f'Autonomia-alvo: <strong style="color:#F0F0F0;">'
                f'{user_config.autonomia_alvo} meses</strong>'
                f'<span style="color:#444;"> (alerta: {user_config.autonomia_warn}m)</span></div>'

                f'<div style="font-family:JetBrains Mono,monospace;font-size:0.62rem;'
                f'color:#888;padding:4px 0;">'
                f'Auto-gerar recorrentes: '
                f'<strong style="color:{"#00FFCC" if user_config.auto_gerar_recorrentes else "#555"};">'
                f'{"Ativo" if user_config.auto_gerar_recorrentes else "Desativado"}'
                f'</strong></div>'

                f'</div>'
            )
            st.markdown(current_html, unsafe_allow_html=True)

            # Impacto simulado se renda existe
            if mx.renda > 0:
                sim_nec = mx.renda * user_config.meta_necessidades / 100
                sim_des = mx.renda * user_config.meta_desejos / 100
                sim_inv = mx.renda * user_config.meta_investimento / 100

                sim_html = (
                    f'<div class="intel-box">'
                    f'<div class="intel-title">◆ Simulação com Renda Atual</div>'
                    f'<div style="font-family:JetBrains Mono,monospace;font-size:0.62rem;'
                    f'color:#888;">'
                    f'Renda: {fmt_brl(mx.renda)}<br>'
                    f'→ Necessidades ({user_config.meta_necessidades}%): '
                    f'<strong style="color:#F0F0F0;">{fmt_brl(sim_nec)}</strong><br>'
                    f'→ Desejos ({user_config.meta_desejos}%): '
                    f'<strong style="color:#FFAA00;">{fmt_brl(sim_des)}</strong><br>'
                    f'→ Investimento ({user_config.meta_investimento}%): '
                    f'<strong style="color:#00FFCC;">{fmt_brl(sim_inv)}</strong>'
                    f'</div></div>'
                )
                st.markdown(sim_html, unsafe_allow_html=True)

            render_intel(
                "Nota",
                "As configurações são salvas por perfil (Casal/Luan/Luana). "
                "Se não houver config individual, o app usa os valores do perfil Casal ou os defaults (50/30/20)."
            )

            # --- Backup (S1) ---
            st.markdown("---")
            render_intel(
                "💾 Backup Completo",
                "Exporte todos os dados (transações, patrimônio, passivos, "
                "metas, recorrentes, orçamentos, configurações) em um arquivo Excel."
            )
            if st.button("GERAR BACKUP", key="backup_btn", use_container_width=True):
                backup_buf = generate_full_backup()
                if backup_buf:
                    backup_date = datetime.now().strftime("%Y%m%d_%H%M")
                    st.download_button(
                        f"⬇ BAIXAR BACKUP ({backup_date})",
                        backup_buf.getvalue(),
                        f"backup_ll_finance_{backup_date}.xlsx",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        use_container_width=True,
                        key="backup_download",
                    )
                else:
                    st.error("Falha ao gerar backup")

            # --- Favoritos (X6) ---
            st.markdown("---")
            render_intel(
                "⭐ Favoritos de Lançamento",
                "Atalhos personalizados para o ⚡ Lançamento Rápido."
            )
            with st.form("f_add_favorito", clear_on_submit=True):
                _fav_fc1, _fav_fc2 = st.columns([2, 1])
                with _fav_fc1:
                    _fav_desc = st.text_input(
                        "Descrição", placeholder="Ex: Mercado semanal",
                        max_chars=CFG.MAX_DESC_LENGTH, key="fav_desc",
                    )
                with _fav_fc2:
                    _fav_val = st.number_input(
                        "Valor (R$)", min_value=0.01, step=10.0, key="fav_val",
                    )
                _fav_fc3, _fav_fc4, _fav_fc5 = st.columns(3)
                with _fav_fc3:
                    _fav_tipo = st.selectbox("Tipo", list(CFG.TIPOS), key="fav_tipo")
                with _fav_fc4:
                    if _fav_tipo == CFG.TIPO_SAIDA:
                        _fav_cat_opts = list(CFG.CATEGORIAS_SAIDA) + [CFG.CAT_INVESTIMENTO]
                    else:
                        _fav_cat_opts = list(CFG.CATEGORIAS_ENTRADA)
                    _fav_cat = st.selectbox("Categoria", _fav_cat_opts, key="fav_cat")
                with _fav_fc5:
                    _fav_resp_opts = list(CFG.RESPONSAVEIS)
                    _fav_resp_idx = (
                        _fav_resp_opts.index(user) if user in _fav_resp_opts else 0
                    )
                    _fav_resp = st.selectbox(
                        "Responsável", _fav_resp_opts,
                        index=_fav_resp_idx, key="fav_resp",
                    )
                _fav_tag = st.text_input(
                    "Tag (opcional)", placeholder="Ex: semanal",
                    max_chars=50, key="fav_tag_input",
                )
                if st.form_submit_button("⭐ SALVAR FAVORITO", use_container_width=True):
                    if not _fav_desc or not _fav_desc.strip():
                        st.toast("⚠ Descrição obrigatória")
                    elif _fav_val <= 0:
                        st.toast("⚠ Valor deve ser maior que zero")
                    else:
                        _fav_entry = {
                            "Id": generate_id(),
                            "Nome": _fav_desc.strip(),
                            "Descricao": _fav_desc.strip(),
                            "Valor": _fav_val,
                            "Categoria": _fav_cat,
                            "Tipo": _fav_tipo,
                            "Responsavel": _fav_resp,
                            "Tag": _fav_tag.strip() if _fav_tag else "",
                            "Ordem": 0,
                        }
                        if save_entry(_fav_entry, "Favoritos"):
                            st.toast(f"✓ Favorito: {_fav_desc.strip()}")
                            st.rerun()

            _df_fav_cfg = filter_by_user(df_favoritos, user, include_shared=True)
            if not _df_fav_cfg.empty:
                _edited_favs = st.data_editor(
                    _df_fav_cfg,
                    use_container_width=True,
                    num_rows="dynamic",
                    column_config={
                        "Id": None,
                        "Nome": st.column_config.TextColumn("Nome", required=True),
                        "Descricao": st.column_config.TextColumn("Descrição", required=True),
                        "Valor": st.column_config.NumberColumn(
                            "Valor", format="R$ %.2f", required=True, min_value=0.01,
                        ),
                        "Categoria": st.column_config.SelectboxColumn(
                            "Categoria", options=list(CFG.CATEGORIAS_TODAS), required=True,
                        ),
                        "Tipo": st.column_config.SelectboxColumn(
                            "Tipo", options=list(CFG.TIPOS), required=True,
                        ),
                        "Responsavel": st.column_config.SelectboxColumn(
                            "Responsável", options=list(CFG.RESPONSAVEIS),
                        ),
                        "Tag": st.column_config.TextColumn("Tag", max_chars=50),
                        "Ordem": st.column_config.NumberColumn("Ordem", min_value=0, step=1),
                    },
                    hide_index=True,
                    key=f"editor_favoritos_{user}",
                )
                if not _df_equals_safe(_df_fav_cfg, _edited_favs):
                    _fv_s, _fv_d = st.columns(2)
                    with _fv_s:
                        if st.button(
                            "✓ SALVAR FAVORITOS",
                            key=f"save_favs_{user}",
                            use_container_width=True,
                        ):
                            if _save_filtered_sheet(
                                df_favoritos, _edited_favs, user, "Favoritos"
                            ):
                                st.toast("✓ Favoritos atualizados")
                                st.rerun()
                    with _fv_d:
                        if st.button(
                            "✗ DESCARTAR",
                            key=f"discard_favs_{user}",
                            use_container_width=True,
                        ):
                            st.rerun()

            # --- Tema (V4) ---
            st.markdown("---")
            _theme_now = st.session_state.get("theme", "dark")
            render_intel(
                "🎨 Tema",
                f"Atual: <strong>{'Dark' if _theme_now == 'dark' else 'Light'}</strong>"
            )
            _th_c1, _th_c2 = st.columns(2)
            with _th_c1:
                if st.button(
                    "☽ DARK" if _theme_now != "dark" else "☽ DARK ✓",
                    key="theme_dark_cfg",
                    use_container_width=True,
                    disabled=_theme_now == "dark",
                ):
                    st.session_state.theme = "dark"
                    st.rerun()
            with _th_c2:
                if st.button(
                    "☀ LIGHT" if _theme_now != "light" else "☀ LIGHT ✓",
                    key="theme_light_cfg",
                    use_container_width=True,
                    disabled=_theme_now == "light",
                ):
                    st.session_state.theme = "light"
                    st.rerun()

            # --- Modo de exibição (V2) ---
            st.markdown("---")
            _mode_now = st.session_state.display_mode
            render_intel(
                "🖥 Modo de Exibição",
                f"Atual: <strong>{'Expert (tudo visível)' if _mode_now == 'expert' else 'Clean (essencial)'}</strong>"
            )
            _v2_c1, _v2_c2 = st.columns(2)
            with _v2_c1:
                if st.button(
                    "◉ EXPERT" if _mode_now != "expert" else "◉ EXPERT ✓",
                    key="mode_expert",
                    use_container_width=True,
                    disabled=_mode_now == "expert",
                ):
                    st.session_state.display_mode = "expert"
                    st.rerun()
            with _v2_c2:
                if st.button(
                    "○ CLEAN" if _mode_now != "clean" else "○ CLEAN ✓",
                    key="mode_clean",
                    use_container_width=True,
                    disabled=_mode_now == "clean",
                ):
                    st.session_state.display_mode = "clean"
                    st.rerun()


# ==============================================================================
# BOOT
# ==============================================================================

if __name__ == "__main__":
    main()