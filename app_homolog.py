import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from streamlit_gsheets import GSheetsConnection
from datetime import datetime, timedelta, date
import calendar
import html as html_lib
from dataclasses import dataclass
from io import BytesIO
import time  # [FIX #16] Movido para o topo

# ==============================================================================
# 1. CONFIGURAÇÃO CENTRALIZADA
# ==============================================================================

@dataclass(frozen=True)
class Config:
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
    COLS_TRANSACAO: tuple = ("Data", "Descricao", "Valor", "Categoria", "Tipo", "Responsavel")
    COLS_PATRIMONIO: tuple = ("Item", "Valor", "Responsavel")
    META_NECESSIDADES: int = 50
    META_DESEJOS: int = 30
    META_INVESTIMENTO: int = 20
    AUTONOMIA_OK: int = 12
    AUTONOMIA_WARN: int = 6
    CACHE_TTL: int = 120
    MAX_DESC_LENGTH: int = 200
    SAVE_RETRIES: int = 3
    MESES_EVOLUCAO: int = 6

CFG = Config()

MESES_PT: dict[int, str] = {
    1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun",
    7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez"
}
MESES_FULL: dict[int, str] = {
    1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
    5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
    9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
}

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
    st.markdown("""
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');

        #MainMenu, footer, header { visibility: hidden; }
        .stDeployButton { display: none; }
        div[data-testid="stDecoration"] { display: none; }
        div[data-testid="stToolbar"] { display: none; }

        .block-container {
            padding: 1rem 1.5rem 1rem 1.5rem !important;
            max-width: 100% !important;
        }

        html, body, [class*="css"] {
            font-family: 'Inter', sans-serif;
            background-color: #000000;
            color: #F0F0F0;
        }
        .stApp { background-color: #000000; }

        @keyframes scan-line {
            0%   { top: 0%; opacity: 1; }
            50%  { opacity: 0.4; }
            100% { top: 100%; opacity: 0; }
        }
        @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 20px rgba(0,255,204,0.1); }
            50%      { box-shadow: 0 0 40px rgba(0,255,204,0.25); }
        }
        @keyframes number-breathe {
            0%, 100% { text-shadow: 0 0 30px rgba(0,255,204,0.15); }
            50%      { text-shadow: 0 0 60px rgba(0,255,204,0.35); }
        }

        .autonomia-hero {
            background: #000000;
            border: 2px solid #00FFCC;
            border-radius: 0px;
            padding: 48px 32px 40px 32px;
            text-align: center;
            position: relative;
            overflow: hidden;
            animation: pulse-glow 4s ease-in-out infinite;
            margin-bottom: 16px;
        }
        .autonomia-hero::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 2px;
            background: #00FFCC;
            box-shadow: 0 0 20px #00FFCC, 0 0 60px rgba(0,255,204,0.3);
        }
        .autonomia-hero::after {
            content: '';
            position: absolute;
            left: 0; right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, #00FFCC, transparent);
            animation: scan-line 3s ease-in-out infinite;
            pointer-events: none;
        }
        .autonomia-tag {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.65rem;
            color: #00FFCC;
            text-transform: uppercase;
            letter-spacing: 0.6em;
            margin-bottom: 12px;
            opacity: 0.5;
        }
        .autonomia-number {
            font-family: 'JetBrains Mono', monospace;
            font-size: 6rem;
            font-weight: 700;
            line-height: 1;
            letter-spacing: -0.04em;
            animation: number-breathe 3s ease-in-out infinite;
        }
        .autonomia-unit {
            font-family: 'Inter', sans-serif;
            font-size: 0.85rem;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 0.35em;
            margin-top: 10px;
        }
        .autonomia-sub {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.7rem;
            color: #333;
            margin-top: 16px;
            letter-spacing: 0.05em;
        }

        .t-panel {
            background: #0a0a0a;
            border: 1px solid #1a1a1a;
            border-radius: 0px;
            padding: 20px;
            margin-bottom: 12px;
            transition: border-color 0.3s ease, transform 0.2s ease;
        }
        .t-panel:hover {
            border-color: #00FFCC;
            transform: translateX(2px);
        }

        .kpi-mono {
            font-family: 'JetBrains Mono', monospace;
            border-left: 3px solid #1a1a1a;
            padding: 14px 16px;
            margin-bottom: 8px;
            transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
        }
        .kpi-mono:hover {
            border-left-color: #00FFCC;
            background: rgba(0,255,204,0.03);
            transform: translateX(4px);
        }
        .kpi-mono-label {
            font-size: 0.6rem;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 0.2em;
        }
        .kpi-mono-value {
            font-size: 1.35rem;
            font-weight: 700;
            color: #F0F0F0;
            margin-top: 2px;
        }
        .kpi-mono-sub {
            font-size: 0.65rem;
            color: #444;
            margin-top: 2px;
        }
        .kpi-delta {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.65rem;
            margin-top: 3px;
        }
        .kpi-delta-up   { color: #00FFCC; }
        .kpi-delta-down { color: #FF4444; }
        .kpi-delta-neutral { color: #555; }

        .rule-bar-container {
            display: flex;
            width: 100%;
            height: 6px;
            margin: 8px 0;
            overflow: hidden;
        }
        .rule-bar-seg {
            height: 100%;
            transition: width 0.5s ease;
        }

        .deviation {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.72rem;
            padding: 4px 8px;
            border-radius: 0px;
            display: inline-block;
            margin: 2px 4px 2px 0;
            transition: background 0.2s ease;
        }
        .deviation:hover { background: rgba(255,255,255,0.03); }
        .dev-ok     { color: #00FFCC; border: 1px solid #00FFCC22; }
        .dev-warn   { color: #FFAA00; border: 1px solid #FFAA0022; }
        .dev-danger  { color: #FF4444; border: 1px solid #FF444422; }

        .intel-box {
            background: #0a0a0a;
            border: 1px solid #1a1a1a;
            border-left: 3px solid #00FFCC;
            border-radius: 0px;
            padding: 14px 16px;
            margin-bottom: 12px;
            transition: border-color 0.2s ease;
        }
        .intel-box:hover { border-color: #00FFCC; }
        .intel-title {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.6rem;
            color: #00FFCC;
            text-transform: uppercase;
            letter-spacing: 0.25em;
            margin-bottom: 6px;
        }
        .intel-body {
            font-size: 0.85rem;
            color: #999;
            line-height: 1.5;
        }

        .cat-bar-row {
            display: flex;
            align-items: center;
            margin-bottom: 6px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.7rem;
        }
        .cat-bar-label {
            width: 100px;
            color: #888;
            flex-shrink: 0;
        }
        .cat-bar-track {
            flex: 1;
            height: 6px;
            background: #111;
            margin: 0 10px;
            position: relative;
        }
        .cat-bar-fill {
            height: 100%;
            background: #00FFCC;
            transition: width 0.4s ease;
        }
        .cat-bar-value {
            width: 110px;
            color: #666;
            text-align: right;
            flex-shrink: 0;
        }

        .month-nav {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            color: #F0F0F0;
            text-align: center;
            letter-spacing: 0.1em;
            padding: 6px 0;
        }

        /* ===== HEALTH BADGE ===== */
        .health-badge {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.7rem;
            padding: 6px 12px;
            text-align: center;
            margin-bottom: 12px;
            letter-spacing: 0.08em;
        }
        .health-excellent {
            color: #00FFCC;
            border: 1px solid #00FFCC33;
            background: rgba(0,255,204,0.05);
        }
        .health-good {
            color: #00FFCC;
            border: 1px solid #00FFCC22;
        }
        .health-warning {
            color: #FFAA00;
            border: 1px solid #FFAA0022;
            background: rgba(255,170,0,0.05);
        }
        .health-danger {
            color: #FF4444;
            border: 1px solid #FF444422;
            background: rgba(255,68,68,0.05);
        }

        /* ===== ALERTAS ===== */
        .alerts-container {
            margin-bottom: 16px;
        }
        .alert-item {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.7rem;
            padding: 8px 12px;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: transform 0.15s ease, background 0.15s ease;
        }
        .alert-item:hover {
            transform: translateX(3px);
        }
        .alert-ok {
            color: #00FFCC;
            border-left: 2px solid #00FFCC;
            background: rgba(0,255,204,0.03);
        }
        .alert-info {
            color: #888;
            border-left: 2px solid #333;
            background: rgba(255,255,255,0.01);
        }
        .alert-warn {
            color: #FFAA00;
            border-left: 2px solid #FFAA00;
            background: rgba(255,170,0,0.03);
        }
        .alert-danger {
            color: #FF4444;
            border-left: 2px solid #FF4444;
            background: rgba(255,68,68,0.03);
        }
        .alert-icon {
            font-size: 0.75rem;
            flex-shrink: 0;
            width: 16px;
            text-align: center;
        }
        .alert-msg {
            flex: 1;
        }

        /* ===== PROJEÇÃO ===== */
        .projection-box {
            background: #0a0a0a;
            border: 1px solid #1a1a1a;
            border-radius: 0px;
            padding: 16px;
            margin-bottom: 12px;
        }
        .projection-header {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.6rem;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            margin-bottom: 10px;
        }
        .projection-track {
            width: 100%;
            height: 8px;
            background: #111;
            position: relative;
            margin-bottom: 8px;
        }
        .projection-fill-actual {
            height: 100%;
            position: absolute;
            left: 0;
            top: 0;
            transition: width 0.5s ease;
        }
        .projection-marker {
            position: absolute;
            top: -4px;
            width: 2px;
            height: 16px;
            background: #F0F0F0;
        }
        .projection-labels {
            display: flex;
            justify-content: space-between;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.65rem;
            color: #555;
        }
        .projection-main {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
            font-weight: 700;
            margin-top: 6px;
        }
        .projection-sub {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.65rem;
            color: #555;
            margin-top: 4px;
        }

        /* ===== HIST SUMMARY ===== */
        .hist-summary {
            display: flex;
            gap: 16px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.72rem;
            padding: 10px 0;
            border-bottom: 1px solid #1a1a1a;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }
        .hist-summary-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .hist-dot {
            width: 6px;
            height: 6px;
            border-radius: 0px;
            flex-shrink: 0;
        }

        .stTextInput input, .stNumberInput input, .stDateInput input {
            background-color: #0a0a0a !important;
            border: 1px solid #1a1a1a !important;
            border-radius: 0px !important;
            color: #F0F0F0 !important;
            font-family: 'JetBrains Mono', monospace !important;
        }
        .stTextInput input:focus, .stNumberInput input:focus, .stDateInput input:focus {
            border-color: #00FFCC !important;
            box-shadow: 0 0 0 1px #00FFCC33 !important;
        }
        .stSelectbox > div > div {
            background-color: #0a0a0a !important;
            border: 1px solid #1a1a1a !important;
            border-radius: 0px !important;
            color: #F0F0F0 !important;
        }

        .stTabs [data-baseweb="tab-list"] {
            background-color: transparent;
            gap: 0px;
            border-bottom: 1px solid #1a1a1a;
            margin-bottom: 20px;
        }
        .stTabs [data-baseweb="tab"] {
            background: transparent;
            color: #555;
            font-family: 'JetBrains Mono', monospace;
            font-weight: 400;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            border: none;
            border-bottom: 2px solid transparent;
            padding: 8px 16px 10px 16px;
            transition: color 0.2s ease, border-color 0.2s ease;
        }
        .stTabs [data-baseweb="tab"]:hover { color: #F0F0F0; }
        .stTabs [data-baseweb="tab"][aria-selected="true"] {
            color: #00FFCC;
            border-bottom: 2px solid #00FFCC;
        }

        .stFormSubmitButton button {
            background: transparent !important;
            border: 1px solid #00FFCC !important;
            border-radius: 0px !important;
            color: #00FFCC !important;
            font-family: 'JetBrains Mono', monospace !important;
            text-transform: uppercase !important;
            letter-spacing: 0.12em !important;
            transition: background 0.2s ease, color 0.2s ease !important;
        }
        .stFormSubmitButton button:hover {
            background: #00FFCC !important;
            color: #000000 !important;
        }

        .stButton button {
            background: transparent !important;
            border: 1px solid #333 !important;
            border-radius: 0px !important;
            color: #F0F0F0 !important;
            font-family: 'JetBrains Mono', monospace !important;
            transition: border-color 0.2s ease, transform 0.15s ease !important;
        }
        .stButton button:hover {
            border-color: #00FFCC !important;
            transform: translateY(-1px) !important;
        }

        .stDataFrame {
            border: 1px solid #1a1a1a;
            border-radius: 0px !important;
        }

        .status-line {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.6rem;
            color: #333;
            text-align: right;
            padding: 8px 0;
            letter-spacing: 0.05em;
        }

        .empty-month {
            text-align: center;
            padding: 40px 20px;
        }

        @media (max-width: 768px) {
            .autonomia-number { font-size: 4rem; }
            .autonomia-hero { padding: 28px 16px 24px 16px; }
            .block-container { padding: 0.5rem 0.8rem !important; }
            .kpi-mono-value { font-size: 1.1rem; }
            .cat-bar-label { width: 70px; font-size: 0.6rem; }
            .cat-bar-value { width: 80px; font-size: 0.6rem; }
            .hist-summary { gap: 8px; font-size: 0.65rem; }
            .alert-item { font-size: 0.63rem; padding: 6px 10px; }
            .projection-main { font-size: 0.8rem; }
        }

        @media (prefers-reduced-motion: reduce) {
            .autonomia-hero::after { animation: none; }
            .autonomia-hero { animation: none; }
            .autonomia-number { animation: none; }
        }
    </style>
    """, unsafe_allow_html=True)

# [FIX #17] inject_css() removida daqui — será chamada dentro de main()

# ==============================================================================
# 4. UTILITÁRIOS
# ==============================================================================

def sanitize(text: str) -> str:
    """Escapa HTML para prevenir injeção."""
    return html_lib.escape(str(text))

def fmt_brl(val: float) -> str:
    """Formata valor float para padrão BRL: R$ 1.234,56"""
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
        # [FIX #10] Não deveria chegar aqui com bloqueio de navegação futura,
        # mas por segurança retorna hoje
        return now.date()

def calc_delta(current: float, previous: float) -> float | None:
    """Calcula variação percentual entre dois valores."""
    if previous == 0:
        # [FIX #9] Se anterior é 0 e atual > 0, indica "novo"
        if current > 0:
            return float("inf")
        return None
    return ((current - previous) / abs(previous)) * 100

def _is_future_month(month: int, year: int) -> bool:
    """[FIX #1] Verifica se mês/ano é futuro em relação a agora."""
    now = datetime.now()
    return (year > now.year) or (year == now.year and month > now.month)

# ==============================================================================
# 5. VALIDAÇÃO
# ==============================================================================

def validate_transaction(entry: dict) -> tuple[bool, str]:
    """Valida dados de uma transação antes de salvar."""
    desc = entry.get("Descricao", "")
    if not desc or not str(desc).strip():
        return False, "Descrição obrigatória"
    if len(str(desc)) > CFG.MAX_DESC_LENGTH:
        return False, f"Descrição muito longa (máx {CFG.MAX_DESC_LENGTH})"
    val = entry.get("Valor")
    if not isinstance(val, (int, float)) or val <= 0:
        return False, "Valor deve ser maior que zero"
    if entry.get("Tipo") not in CFG.TIPOS:
        return False, "Tipo inválido"
    if entry.get("Responsavel") not in CFG.RESPONSAVEIS:
        return False, "Responsável inválido"
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

# ==============================================================================
# 6. CAMADA DE DADOS
# ==============================================================================

def get_conn() -> GSheetsConnection:
    """Retorna conexão com Google Sheets."""
    return st.connection("gsheets", type=GSheetsConnection)

def _normalize_strings(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """[FIX #11] Normaliza strings de colunas categóricas."""
    for col in columns:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()
    return df

@st.cache_data(ttl=CFG.CACHE_TTL)
def load_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Carrega transações e patrimônio do Google Sheets."""
    conn = get_conn()

    expected_trans = list(CFG.COLS_TRANSACAO)
    try:
        df_trans = conn.read(worksheet="Transacoes")
        df_trans = df_trans.dropna(how="all")
        missing = set(expected_trans) - set(df_trans.columns)
        for col in missing:
            df_trans[col] = None
        if not df_trans.empty:
            df_trans["Data"] = pd.to_datetime(df_trans["Data"], errors="coerce")
            df_trans["Valor"] = pd.to_numeric(df_trans["Valor"], errors="coerce").fillna(0.0)
            df_trans = df_trans.dropna(subset=["Data"])
            # [FIX #11] Normalizar strings
            df_trans = _normalize_strings(df_trans, ["Tipo", "Categoria", "Responsavel", "Descricao"])
    except Exception:
        df_trans = pd.DataFrame(columns=expected_trans)

    expected_pat = list(CFG.COLS_PATRIMONIO)
    try:
        df_assets = conn.read(worksheet="Patrimonio")
        df_assets = df_assets.dropna(how="all")
        missing = set(expected_pat) - set(df_assets.columns)
        for col in missing:
            df_assets[col] = None
        if not df_assets.empty:
            df_assets["Valor"] = pd.to_numeric(df_assets["Valor"], errors="coerce").fillna(0.0)
            # [FIX #11] Normalizar strings
            df_assets = _normalize_strings(df_assets, ["Item", "Responsavel"])
    except Exception:
        df_assets = pd.DataFrame(columns=expected_pat)

    return df_trans, df_assets

def save_entry(data: dict, worksheet: str) -> bool:
    """Salva uma nova entrada na planilha com retry."""
    conn = get_conn()
    st.cache_data.clear()  # [FIX #3] Limpar cache uma vez antes do loop
    for attempt in range(CFG.SAVE_RETRIES):
        try:
            try:
                df_curr = conn.read(worksheet=worksheet)
                df_curr = df_curr.dropna(how="all")
            except Exception:
                df_curr = pd.DataFrame()
            df_new = pd.DataFrame([data])
            df_updated = pd.concat([df_curr, df_new], ignore_index=True)
            if "Data" in df_updated.columns:
                df_updated["Data"] = pd.to_datetime(
                    df_updated["Data"], errors="coerce"
                ).dt.strftime("%Y-%m-%d")
            conn.update(worksheet=worksheet, data=df_updated)
            st.cache_data.clear()  # [FIX #3] Limpar após sucesso
            return True
        except Exception as e:
            if attempt == CFG.SAVE_RETRIES - 1:
                st.error(f"Falha ao salvar após {CFG.SAVE_RETRIES} tentativas: {e}")
                st.cache_data.clear()  # [FIX #14] Limpar cache mesmo em erro
                return False
            time.sleep(0.5 * (attempt + 1))
    return False

def update_sheet(df_edited: pd.DataFrame, worksheet: str) -> bool:
    """Atualiza planilha inteira com DataFrame editado."""
    conn = get_conn()
    try:
        df_to_save = df_edited.copy()
        if "Data" in df_to_save.columns:
            df_to_save["Data"] = pd.to_datetime(
                df_to_save["Data"], errors="coerce"
            ).dt.strftime("%Y-%m-%d")
        conn.update(worksheet=worksheet, data=df_to_save)
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Erro ao atualizar: {e}")
        st.cache_data.clear()  # [FIX #14] Limpar cache mesmo em erro
        return False

# ==============================================================================
# 7. MOTOR ANALÍTICO
# ==============================================================================

def filter_by_user(df: pd.DataFrame, user_filter: str, include_shared: bool = False) -> pd.DataFrame:
    """Filtra DataFrame por responsável.

    [FIX #2] include_shared=True inclui registros 'Casal' junto com o usuário individual.
    """
    if user_filter != "Casal" and "Responsavel" in df.columns:
        if include_shared:
            return df[df["Responsavel"].isin([user_filter, "Casal"])].copy()
        return df[df["Responsavel"] == user_filter].copy()
    return df.copy()

def filter_by_month(df: pd.DataFrame, month: int, year: int) -> pd.DataFrame:
    """Filtra DataFrame por mês/ano."""
    if df.empty:
        return df
    return df[
        (df["Data"].dt.month == month) &
        (df["Data"].dt.year == year)
    ].copy()


def compute_projection(
    mx: dict,
    sel_mo: int,
    sel_yr: int,
) -> dict | None:
    """Projeção linear de gastos para o fim do mês.

    Só calcula para o mês ATUAL (meses passados já encerraram).
    Retorna None se dados insuficientes.
    [FIX #7] Nota: investimentos não são projetados linearmente —
    assume-se que os aportes já feitos são os do mês inteiro.
    """
    now = datetime.now()
    is_current = (sel_mo == now.month and sel_yr == now.year)

    if not is_current:
        return None

    day_of_month = now.day
    days_in_month = calendar.monthrange(sel_yr, sel_mo)[1]

    if day_of_month < 3 or mx["lifestyle"] == 0:
        return None

    daily_rate = mx["lifestyle"] / day_of_month
    projected_lifestyle = daily_rate * days_in_month
    projected_investido = mx["investido_mes"]
    projected_available = mx["renda"] - projected_lifestyle - projected_investido
    progress_pct = (day_of_month / days_in_month) * 100
    renda_consumed_pct = (mx["lifestyle"] / mx["renda"] * 100) if mx["renda"] > 0 else 0
    renda_projected_pct = (projected_lifestyle / mx["renda"] * 100) if mx["renda"] > 0 else 0

    return {
        "day": day_of_month,
        "days_total": days_in_month,
        "days_remaining": days_in_month - day_of_month,
        "progress_pct": progress_pct,
        "daily_rate": daily_rate,
        "projected_lifestyle": projected_lifestyle,
        "projected_available": projected_available,
        "projected_deficit": projected_available < 0,
        "renda_consumed_pct": renda_consumed_pct,
        "renda_projected_pct": renda_projected_pct,
        "remaining_budget": max(0, mx["renda"] - mx["lifestyle"] - mx["investido_mes"]),
        "daily_budget": max(0, (mx["renda"] - mx["lifestyle"] - mx["investido_mes"]) / max(1, days_in_month - day_of_month)),
    }


def compute_alerts(
    mx: dict,
    sel_mo: int,
    sel_yr: int,
    projection: dict | None,
) -> list[dict]:
    """Engine de alertas inteligentes baseado em regras."""
    alerts: list[dict] = []
    now = datetime.now()
    is_current = (sel_mo == now.month and sel_yr == now.year)

    if mx["disponivel"] > 0 and mx["investido_mes"] > 0 and mx["renda"] > 0:
        alerts.append({
            "level": "ok",
            "icon": "✦",
            "msg": f"Mês positivo — {mx['taxa_aporte']:.0f}% investido, saldo de {fmt_brl(mx['disponivel'])}",
        })

    if mx["renda"] > 0 and mx["lifestyle"] > mx["renda"]:
        pct = (mx["lifestyle"] / mx["renda"]) * 100
        alerts.append({
            "level": "danger",
            "icon": "▲",
            "msg": f"Gastos em {pct:.0f}% da renda — mês no vermelho",
        })
    elif mx["renda"] > 0 and mx["lifestyle"] > mx["renda"] * 0.8:
        pct = (mx["lifestyle"] / mx["renda"]) * 100
        alerts.append({
            "level": "danger",
            "icon": "▲",
            "msg": f"Gastos em {pct:.0f}% da renda — margem crítica",
        })

    if projection and projection["projected_deficit"]:
        alerts.append({
            "level": "warn",
            "icon": "◆",
            "msg": f"Projeção: gastos de {fmt_brl(projection['projected_lifestyle'])} — acima da renda",
        })
    elif projection and not projection["projected_deficit"] and projection["renda_projected_pct"] > 90:
        alerts.append({
            "level": "warn",
            "icon": "◆",
            "msg": f"Projeção aperta: gastos consumirão {projection['renda_projected_pct']:.0f}% da renda",
        })

    if mx["cat_breakdown"] and mx["lifestyle"] > 0:
        for cat, val in mx["cat_breakdown"].items():
            pct = (val / mx["lifestyle"]) * 100
            if pct > 40:
                alerts.append({
                    "level": "warn",
                    "icon": "◈",
                    "msg": f"{sanitize(str(cat))} concentra {pct:.0f}% dos gastos ({fmt_brl(val)})",
                })
                break

    if mx["d_lifestyle"] is not None and mx["d_lifestyle"] != float("inf") and mx["d_lifestyle"] > 30:
        alerts.append({
            "level": "warn",
            "icon": "▲",
            "msg": f"Gastos {mx['d_lifestyle']:.0f}% acima do mês anterior",
        })

    if is_current and now.day >= 5 and mx["renda"] == 0:
        alerts.append({
            "level": "info",
            "icon": "○",
            "msg": "Nenhuma entrada registrada este mês",
        })

    if mx["renda"] > 0 and mx["investido_mes"] == 0:
        if is_current and now.day >= 20:
            alerts.append({
                "level": "info",
                "icon": "◇",
                "msg": "Nenhum aporte realizado — considere investir antes do fechamento",
            })
        elif not is_current:
            alerts.append({
                "level": "info",
                "icon": "◇",
                "msg": "Mês encerrado sem aportes de investimento",
            })

    if projection and projection["daily_budget"] > 0 and not projection["projected_deficit"]:
        alerts.append({
            "level": "info",
            "icon": "◎",
            "msg": f"Budget restante: {fmt_brl(projection['daily_budget'])}/dia por {projection['days_remaining']} dias",
        })

    return alerts


def compute_metrics(
    df_trans: pd.DataFrame,
    df_assets: pd.DataFrame,
    user_filter: str,
    target_month: int,
    target_year: int,
) -> dict:
    """Calcula todas as métricas financeiras para o mês/usuário."""

    df_t = filter_by_user(df_trans, user_filter)
    # [FIX #2] Patrimônio inclui ativos "Casal" na visão individual
    df_a = filter_by_user(df_assets, user_filter, include_shared=True)
    df_mo = filter_by_month(df_t, target_month, target_year)

    m: dict = {
        "renda": 0.0, "lifestyle": 0.0, "investido_mes": 0.0,
        "disponivel": 0.0, "sobrevivencia": 0.0, "investido_total": 0.0,
        "taxa_aporte": 0.0, "autonomia": 0.0,
        "nec_pct": 0.0, "des_pct": 0.0, "inv_pct": 0.0,
        "nec_delta": 0.0, "des_delta": 0.0, "inv_delta": 0.0,
        "top_cat": "—", "top_cat_val": 0.0,
        "top_gasto_desc": "—", "top_gasto_val": 0.0,
        "df_user": df_t,
        "df_month": df_mo,
        "insight_ls": "", "insight_renda": "",
        "d_renda": None, "d_lifestyle": None,
        "d_investido": None, "d_disponivel": None,
        "cat_breakdown": {},
        "renda_breakdown": {},
        "month_tx_count": len(df_mo),
        "month_entradas": 0,
        "month_saidas": 0,
        "month_investimentos": 0,
        "health": "neutral",
    }

    if df_t.empty:
        m["insight_ls"] = "Nenhum dado registrado."
        m["insight_renda"] = "Nenhum dado registrado."
        return m

    if not df_mo.empty:
        m["renda"] = df_mo[df_mo["Tipo"] == "Entrada"]["Valor"].sum()
        despesas = df_mo[
            (df_mo["Tipo"] == "Saída") &
            (df_mo["Categoria"] != "Investimento")
        ]
        m["lifestyle"] = despesas["Valor"].sum()
        m["investido_mes"] = df_mo[
            (df_mo["Tipo"] == "Saída") &
            (df_mo["Categoria"] == "Investimento")
        ]["Valor"].sum()
        m["month_entradas"] = len(df_mo[df_mo["Tipo"] == "Entrada"])
        m["month_saidas"] = len(despesas)
        m["month_investimentos"] = len(df_mo[
            (df_mo["Tipo"] == "Saída") &
            (df_mo["Categoria"] == "Investimento")
        ])

    m["disponivel"] = m["renda"] - m["lifestyle"] - m["investido_mes"]

    base_patrimonio = df_a["Valor"].sum()
    m["investido_total"] = df_t[
        (df_t["Tipo"] == "Saída") &
        (df_t["Categoria"] == "Investimento")
    ]["Valor"].sum()
    m["sobrevivencia"] = base_patrimonio + m["investido_total"]

    m["taxa_aporte"] = (m["investido_mes"] / m["renda"] * 100) if m["renda"] > 0 else 0.0

    # --- Autonomia ---
    ref_date = end_of_month(target_year, target_month)
    inicio_3m = ref_date - timedelta(days=90)
    df_burn = df_t[
        (df_t["Data"] >= inicio_3m) &
        (df_t["Data"] <= ref_date) &
        (df_t["Tipo"] == "Saída") &
        (df_t["Categoria"] != "Investimento")
    ]
    if not df_burn.empty:
        dias = max(1, (ref_date - df_burn["Data"].min()).days)
        meses = max(1, min(3, dias / 30))
        media_gastos = df_burn["Valor"].sum() / meses
        m["autonomia"] = (m["sobrevivencia"] / media_gastos) if media_gastos > 0 else 999.0
    else:
        m["autonomia"] = 999.0

    # --- Regra 50/30/20 ---
    if m["renda"] > 0 and not df_mo.empty:
        despesas_mo = df_mo[
            (df_mo["Tipo"] == "Saída") &
            (df_mo["Categoria"] != "Investimento")
        ]
        val_nec = despesas_mo[despesas_mo["Categoria"].isin(CFG.NECESSIDADES)]["Valor"].sum()
        val_des = despesas_mo[despesas_mo["Categoria"].isin(CFG.DESEJOS)]["Valor"].sum()
        m["nec_pct"] = (val_nec / m["renda"]) * 100
        m["des_pct"] = (val_des / m["renda"]) * 100
        m["inv_pct"] = (m["investido_mes"] / m["renda"]) * 100
        m["nec_delta"] = m["nec_pct"] - CFG.META_NECESSIDADES
        m["des_delta"] = m["des_pct"] - CFG.META_DESEJOS
        m["inv_delta"] = m["inv_pct"] - CFG.META_INVESTIMENTO

    # --- Breakdown ---
    if not df_mo.empty:
        cat_grp = df_mo[
            (df_mo["Tipo"] == "Saída") &
            (df_mo["Categoria"] != "Investimento")
        ].groupby("Categoria")["Valor"].sum()

        if not cat_grp.empty:
            m["top_cat"] = cat_grp.idxmax()
            m["top_cat_val"] = cat_grp.max()
            m["cat_breakdown"] = cat_grp.sort_values(ascending=False).to_dict()

        top_row = df_mo[
            (df_mo["Tipo"] == "Saída") &
            (df_mo["Categoria"] != "Investimento")
        ].nlargest(1, "Valor")
        if not top_row.empty:
            m["top_gasto_desc"] = str(top_row["Descricao"].values[0])
            m["top_gasto_val"] = float(top_row["Valor"].values[0])

        renda_grp = df_mo[df_mo["Tipo"] == "Entrada"].groupby("Categoria")["Valor"].sum()
        if not renda_grp.empty:
            m["renda_breakdown"] = renda_grp.sort_values(ascending=False).to_dict()

    # --- Health ---
    m["health"] = _compute_health(m)

    # --- Comparativo ---
    prev_mo = target_month - 1 if target_month > 1 else 12
    prev_yr = target_year if target_month > 1 else target_year - 1
    df_prev = filter_by_month(df_t, prev_mo, prev_yr)

    if not df_prev.empty:
        prev_renda = df_prev[df_prev["Tipo"] == "Entrada"]["Valor"].sum()
        prev_lifestyle = df_prev[
            (df_prev["Tipo"] == "Saída") &
            (df_prev["Categoria"] != "Investimento")
        ]["Valor"].sum()
        prev_investido = df_prev[
            (df_prev["Tipo"] == "Saída") &
            (df_prev["Categoria"] == "Investimento")
        ]["Valor"].sum()
        prev_disponivel = prev_renda - prev_lifestyle - prev_investido
        m["d_renda"] = calc_delta(m["renda"], prev_renda)
        m["d_lifestyle"] = calc_delta(m["lifestyle"], prev_lifestyle)
        m["d_investido"] = calc_delta(m["investido_mes"], prev_investido)
        m["d_disponivel"] = calc_delta(m["disponivel"], prev_disponivel)

    # --- Insights ---
    if m["lifestyle"] > 0:
        m["insight_ls"] = (
            f"Impacto: <strong>{sanitize(m['top_cat'])}</strong> "
            f"({fmt_brl(m['top_cat_val'])})<br>"
            f"Maior gasto: <em>{sanitize(m['top_gasto_desc'])}</em> "
            f"({fmt_brl(m['top_gasto_val'])})"
        )
    else:
        m["insight_ls"] = "Sem registros de consumo este mês."

    if m["renda"] > 0:
        m["insight_renda"] = f"Gerado: <strong>{fmt_brl(m['renda'])}</strong> este mês."
    else:
        m["insight_renda"] = "Nenhuma entrada registrada."

    return m


def _compute_health(m: dict) -> str:
    """Classifica saúde financeira do mês."""
    if m["renda"] == 0:
        return "neutral"
    score = 0
    if m["disponivel"] > 0:
        score += 1
    if m["investido_mes"] > 0:
        score += 1
    if m["renda"] > 0 and (m["lifestyle"] / m["renda"]) < 0.8:
        score += 1
    if abs(m["nec_delta"]) <= 15 and abs(m["des_delta"]) <= 15:
        score += 1
    if score >= 4:
        return "excellent"
    elif score >= 3:
        return "good"
    elif score >= 2:
        return "warning"
    return "danger"


def compute_evolution(
    df_trans: pd.DataFrame,
    user_filter: str,
    ref_month: int,
    ref_year: int,
    months_back: int = CFG.MESES_EVOLUCAO,
) -> list[dict]:
    """Calcula dados de evolução mensal para gráfico."""
    df = filter_by_user(df_trans, user_filter)
    if df.empty:
        return []

    ref_end = end_of_month(ref_year, ref_month)
    mo, yr = ref_month, ref_year
    for _ in range(months_back - 1):
        mo -= 1
        if mo == 0:
            mo, yr = 12, yr - 1
    start_date = datetime(yr, mo, 1)

    df_range = df[(df["Data"] >= start_date) & (df["Data"] <= ref_end)].copy()
    if df_range.empty:
        return []

    df_range["period"] = df_range["Data"].dt.to_period("M")

    df_saidas = df_range[df_range["Tipo"] == "Saída"].copy()

    def classify(cat: str) -> str:
        if cat in CFG.NECESSIDADES:
            return "necessidades"
        if cat == "Investimento":
            return "investido"
        return "desejos"

    if not df_saidas.empty:
        df_saidas["group"] = df_saidas["Categoria"].apply(classify)
        pivot_s = df_saidas.pivot_table(
            values="Valor", index="period", columns="group",
            aggfunc="sum", fill_value=0
        )
    else:
        pivot_s = pd.DataFrame()

    df_entradas = df_range[df_range["Tipo"] == "Entrada"].copy()
    if not df_entradas.empty:
        renda_por_periodo = df_entradas.groupby(
            df_entradas["Data"].dt.to_period("M")
        )["Valor"].sum()
    else:
        renda_por_periodo = pd.Series(dtype=float)

    all_periods = set()
    if not pivot_s.empty:
        all_periods.update(pivot_s.index)
    if not renda_por_periodo.empty:
        all_periods.update(renda_por_periodo.index)

    data = []
    for period in sorted(all_periods):
        nec = float(pivot_s.loc[period].get("necessidades", 0)) if (not pivot_s.empty and period in pivot_s.index) else 0.0
        des = float(pivot_s.loc[period].get("desejos", 0)) if (not pivot_s.empty and period in pivot_s.index) else 0.0
        inv = float(pivot_s.loc[period].get("investido", 0)) if (not pivot_s.empty and period in pivot_s.index) else 0.0
        ren = float(renda_por_periodo[period]) if period in renda_por_periodo.index else 0.0

        data.append({
            "label": f"{MESES_PT[period.month]}/{period.year}",
            "necessidades": nec,
            "desejos": des,
            "investido": inv,
            "renda": ren,
            "total_gastos": nec + des,
            # [FIX #8] Defaults para trend em todos os itens
            "media_movel": 0.0,
            "trend_pct": 0.0,
            "trend_direction": "stable",
        })

    # --- Média Móvel 3 meses (gastos consumo, sem investimento) ---
    for i, d in enumerate(data):
        window = data[max(0, i - 2):i + 1]
        d["media_movel"] = sum(w["total_gastos"] for w in window) / len(window)

    # --- Tendência: comparar primeira e última média ---
    if len(data) >= 3:
        first_ma = data[2]["media_movel"]
        last_ma = data[-1]["media_movel"]
        if first_ma > 0:
            trend_pct = ((last_ma - first_ma) / first_ma) * 100
        else:
            trend_pct = 0.0
        data[-1]["trend_pct"] = trend_pct
        data[-1]["trend_direction"] = "up" if trend_pct > 5 else "down" if trend_pct < -5 else "stable"

    return data


# ==============================================================================
# 8. COMPONENTES VISUAIS
# ==============================================================================

def render_autonomia(val: float, sobrevivencia: float) -> None:
    """Renderiza hero de autonomia financeira."""
    # [FIX #6] Tratar autonomia infinita / sem burn rate
    if val >= 999:
        display_text = "∞"
        color = "#00FFCC"
    else:
        display_text = f"{min(val, 999):.1f}"
        if val >= CFG.AUTONOMIA_OK:
            color = "#00FFCC"
        elif val >= CFG.AUTONOMIA_WARN:
            color = "#FFAA00"
        else:
            color = "#FF4444"

    # [FIX #6] Subtítulo contextual
    if val >= 999:
        unit_text = "sem burn rate registrado"
    else:
        unit_text = "meses de sobrevivência"

    st.markdown(f"""
    <div class="autonomia-hero">
        <div class="autonomia-tag">▮ Autonomia Financeira</div>
        <div class="autonomia-number" style="color: {color};">{display_text}</div>
        <div class="autonomia-unit">{unit_text}</div>
        <div class="autonomia-sub">Patrimônio líquido: {fmt_brl(sobrevivencia)}</div>
    </div>
    """, unsafe_allow_html=True)


def render_health_badge(health: str, month_label: str) -> None:
    """Renderiza badge de saúde do mês."""
    config = {
        "excellent": ("● Mês excelente", "health-excellent"),
        "good":      ("● Mês saudável", "health-good"),
        "warning":   ("● Atenção necessária", "health-warning"),
        "danger":    ("● Mês crítico", "health-danger"),
        "neutral":   ("○ Sem dados suficientes", "health-good"),
    }
    label, cls = config.get(health, config["neutral"])
    st.markdown(
        f'<div class="health-badge {cls}">{label} — {sanitize(month_label)}</div>',
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


def render_projection(proj: dict | None, mx: dict) -> None:
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
    if mx["renda"] > 0:
        remaining = mx["renda"] - proj["projected_lifestyle"]
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
            <span>Gasto: {fmt_brl(mx['lifestyle'])}</span>
            <span style="color:{proj_color};">→ {fmt_brl(proj['projected_lifestyle'])}</span>
            <span>Renda: {fmt_brl(mx['renda'])}</span>
        </div>
        <div class="projection-main" style="color:{proj_color};">{main_text}</div>
        <div class="projection-sub">{sub_text}</div>
    </div>
    """, unsafe_allow_html=True)


def _format_delta_html(delta: float | None, delta_invert: bool = False) -> str:
    """[FIX #9] Formata delta para HTML, tratando inf (novo) e zero."""
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


def render_regra_503020(mx: dict) -> None:
    """Renderiza barra e badges da regra 50/30/20."""
    total = mx["nec_pct"] + mx["des_pct"] + mx["inv_pct"]
    if total == 0:
        n_w, d_w, i_w = 33, 33, 34
    else:
        n_w = max(1, int(mx["nec_pct"] / total * 100))
        d_w = max(1, int(mx["des_pct"] / total * 100))
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

    b_nec = _badge("Necessidades", mx["nec_pct"], mx["nec_delta"], CFG.META_NECESSIDADES)
    b_des = _badge("Desejos", mx["des_pct"], mx["des_delta"], CFG.META_DESEJOS)
    b_inv = _badge("Investimento", mx["inv_pct"], mx["inv_delta"], CFG.META_INVESTIMENTO)

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


def render_cat_breakdown(cat_dict: dict) -> None:
    """Renderiza barras de breakdown por categoria."""
    if not cat_dict:
        return
    total = sum(cat_dict.values())
    if total == 0:
        return
    html = ""
    for cat, val in cat_dict.items():
        pct = (val / total) * 100
        html += f"""
        <div class="cat-bar-row">
            <span class="cat-bar-label">{sanitize(str(cat))}</span>
            <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width:{pct:.0f}%;"></div>
            </div>
            <span class="cat-bar-value">{pct:.0f}%  {fmt_brl(val)}</span>
        </div>"""
    st.markdown(html, unsafe_allow_html=True)


def render_hist_summary(mx: dict) -> None:
    """Renderiza resumo do histórico mensal."""
    entradas = mx["renda"]
    saidas = mx["lifestyle"]
    investido = mx["investido_mes"]
    saldo = mx["disponivel"]
    saldo_color = "#00FFCC" if saldo >= 0 else "#FF4444"
    st.markdown(f"""
    <div class="hist-summary">
        <div class="hist-summary-item">
            <div class="hist-dot" style="background:#00FFCC;"></div>
            <span style="color:#888;">Entradas</span>
            <span style="color:#F0F0F0;">{fmt_brl(entradas)}</span>
            <span style="color:#555;">({mx['month_entradas']})</span>
        </div>
        <div class="hist-summary-item">
            <div class="hist-dot" style="background:#FF4444;"></div>
            <span style="color:#888;">Saídas</span>
            <span style="color:#F0F0F0;">{fmt_brl(saidas)}</span>
            <span style="color:#555;">({mx['month_saidas']})</span>
        </div>
        <div class="hist-summary-item">
            <div class="hist-dot" style="background:#FFAA00;"></div>
            <span style="color:#888;">Investido</span>
            <span style="color:#F0F0F0;">{fmt_brl(investido)}</span>
            <span style="color:#555;">({mx['month_investimentos']})</span>
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

    fig.update_layout(
        barmode="stack",
        paper_bgcolor="#000000",
        plot_bgcolor="#000000",
        font=dict(family="JetBrains Mono, monospace", color="#888", size=11),
        legend=dict(
            orientation="h", yanchor="bottom", y=1.02,
            xanchor="center", x=0.5, font=dict(size=9)
        ),
        margin=dict(l=0, r=0, t=30, b=0),
        height=300,
        xaxis=dict(gridcolor="#111", showline=False),
        yaxis=dict(gridcolor="#111", showline=False, tickformat=",.0f"),
    )
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

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


def render_empty_month(month_label: str) -> None:
    """Renderiza mensagem de mês vazio."""
    st.markdown(f"""
    <div class="intel-box empty-month">
        <div class="intel-title">Mês sem registros</div>
        <div class="intel-body">
            Nenhuma transação encontrada em <strong>{sanitize(month_label)}</strong>.<br>
            Use as abas abaixo para adicionar entradas.
        </div>
    </div>
    """, unsafe_allow_html=True)


# ==============================================================================
# 9. FORMULÁRIOS
# ==============================================================================

def transaction_form(
    form_key: str, tipo: str, categorias: list[str],
    submit_label: str = "REGISTRAR",
    desc_placeholder: str = "Descrição",
    default_step: float = 10.0,
    sel_mo: int | None = None, sel_yr: int | None = None,
    default_resp: str = "Casal",  # [MELHORIA 1.4]
) -> None:
    """Formulário genérico de transação."""
    form_date = default_form_date(sel_mo, sel_yr) if sel_mo and sel_yr else datetime.now().date()
    with st.form(form_key, clear_on_submit=True):
        d = st.date_input("Data", form_date, format="DD/MM/YYYY")
        desc = st.text_input(
            "Descrição", placeholder=desc_placeholder,
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Valor (R$)", min_value=0.01, step=default_step)
        cat = st.selectbox("Categoria", categorias)
                # [MELHORIA 1.4] Responsável default baseado no filtro ativo
        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Responsável", resp_options, index=resp_index)
        if st.form_submit_button(submit_label):
            entry = {
                "Data": d, "Descricao": desc.strip(), "Valor": val,
                "Categoria": cat, "Tipo": tipo, "Responsavel": resp,
            }
            ok, err = validate_transaction(entry)
            if not ok:
                st.toast(f"⚠ {err}")
            elif save_entry(entry, "Transacoes"):
                st.toast("✓ Registrado")
                st.rerun()


def wealth_form(sel_mo: int | None = None, sel_yr: int | None = None) -> None:
    """Formulário de aporte / investimento."""
    form_date = default_form_date(sel_mo, sel_yr) if sel_mo and sel_yr else datetime.now().date()
    with st.form("f_wealth", clear_on_submit=True):
        d = st.date_input("Data", form_date, format="DD/MM/YYYY")
        desc = st.text_input(
            "Ativo / Corretora", placeholder="Ex: IVVB11, Bitcoin, CDB",
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Valor (R$)", min_value=0.01, step=100.0)
        resp = st.selectbox("Titular", list(CFG.RESPONSAVEIS))
        if st.form_submit_button("CONFIRMAR APORTE"):
            entry = {
                "Data": d, "Descricao": desc.strip(), "Valor": val,
                "Categoria": "Investimento", "Tipo": "Saída", "Responsavel": resp,
            }
            ok, err = validate_transaction(entry)
            if not ok:
                st.toast(f"⚠ {err}")
            elif save_entry(entry, "Transacoes"):
                st.toast("✓ Aporte registrado")
                st.rerun()


def patrimonio_form() -> None:
    """Formulário de ativo patrimonial."""
    with st.form("f_patrimonio", clear_on_submit=True):
        item = st.text_input(
            "Ativo / Conta", placeholder="Ex: Poupança Nubank, Apartamento",
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Valor (R$)", min_value=0.01, step=100.0)
        resp = st.selectbox("Titular", list(CFG.RESPONSAVEIS))
        if st.form_submit_button("ADICIONAR ATIVO"):
            entry = {"Item": item.strip(), "Valor": val, "Responsavel": resp}
            ok, err = validate_asset(entry)
            if not ok:
                st.toast(f"⚠ {err}")
            elif save_entry(entry, "Patrimonio"):
                st.toast("✓ Ativo registrado")
                st.rerun()


# ==============================================================================
# 10. HISTÓRICO
# ==============================================================================

def _df_equals_safe(df1: pd.DataFrame, df2: pd.DataFrame) -> bool:
    """[FIX #5] Comparação segura de DataFrames normalizando tipos."""
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
    mx: dict,
    df_trans_full: pd.DataFrame,
    user: str,
    sel_mo: int,
    sel_yr: int,
) -> None:
    """Renderiza aba de histórico com busca, export e edição."""
    df_hist = mx["df_month"].copy()
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

    # [FIX #19] Busca e edição separadas visualmente
    search = st.text_input(
        "🔍 Buscar",
        placeholder="Filtrar visualização por descrição, categoria...",
        label_visibility="collapsed",
        key="hist_search",
    )

    df_display = df_hist.copy()
    if search and search.strip():
        search_lower = search.strip().lower()
        mask = (
            df_display["Descricao"].str.lower().str.contains(search_lower, na=False) |
            df_display["Categoria"].str.lower().str.contains(search_lower, na=False) |
            df_display["Tipo"].str.lower().str.contains(search_lower, na=False) |
            df_display["Responsavel"].str.lower().str.contains(search_lower, na=False)
        )
        df_display = df_display[mask].reset_index(drop=True)
        if df_display.empty:
            render_intel("", f"Nenhum resultado para '<em>{sanitize(search)}</em>'")
            return

    col_csv, col_excel, _ = st.columns([1, 1, 4])  # [FIX #18] _ no spacer
    with col_csv:
        csv_data = df_display.to_csv(index=False).encode("utf-8-sig")
        st.download_button(
            "⬇ CSV", csv_data,
            f"financas_{sel_mo:02d}_{sel_yr}_{user}.csv",
            "text/csv", use_container_width=True,
        )
    with col_excel:
        # [FIX #15] Feedback quando openpyxl não disponível
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

    # [FIX #19] Aviso de que edição é sobre todos os registros
    if search and search.strip():
        st.caption("⚠ A busca filtra apenas a visualização/export. A edição abaixo mostra todos os registros do mês.")

    # [MELHORIA 1.1] Permitir exclusão de linhas
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
        },
        hide_index=True,
        key="editor_historico",
    )

    # [FIX #5] Comparação segura
    if not _df_equals_safe(df_hist, edited):
        # [MELHORIA 1.1] Detectar exclusões e mostrar aviso apropriado
        rows_removed = len(df_hist) - len(edited)
        if rows_removed > 0:
            st.warning(f"⚠ {rows_removed} transação(ões) será(ão) excluída(s) em {month_label}")
        else:
            st.warning(f"⚠ Alterações pendentes em {month_label}")

        c_save, c_discard = st.columns(2)
        with c_save:
            if st.button("✓ SALVAR ALTERAÇÕES", key="save_hist", use_container_width=True):
                # Validar que não ficou vazio acidentalmente
                if edited.empty and len(df_hist) > 3:
                    st.error("⚠ Não é possível excluir todas as transações de uma vez. Descarte e tente novamente.")
                else:
                    _save_historico_mensal(edited, user, sel_mo, sel_yr)
        with c_discard:
            if st.button("✗ DESCARTAR", key="discard_hist", use_container_width=True):
                st.rerun()


def _save_historico_mensal(
    edited_month: pd.DataFrame,
    user: str,  # [FIX #4] Removido df_trans_full
    sel_mo: int,
    sel_yr: int,
) -> None:
    """Salva edições do histórico mensal na planilha completa."""
    st.cache_data.clear()
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

    df_kept = df_full_fresh[~mask_remove].copy()
    df_merged = pd.concat([df_kept, edited_month], ignore_index=True)
    df_merged["Data"] = pd.to_datetime(df_merged["Data"], errors="coerce")
    df_merged = df_merged.sort_values("Data").reset_index(drop=True)

    if update_sheet(df_merged, "Transacoes"):
        st.toast("✓ Histórico atualizado")
        st.rerun()


# ==============================================================================
# 11. APLICAÇÃO PRINCIPAL
# ==============================================================================

def main() -> None:
    # [FIX #17] CSS injetado dentro de main()
    inject_css()

    now = datetime.now()

    # --- Barra de Controle ---
    c_filter, _, c_status = st.columns([1, 2, 1])  # [FIX #18] _ no spacer
    with c_filter:
        try:
            user = st.pills(
                "", list(CFG.RESPONSAVEIS),
                default="Casal", selection_mode="single",
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
        st.markdown(
            f'<div class="status-line">L&L TERMINAL v4.1 — {fmt_date(now)}</div>',
            unsafe_allow_html=True
        )

    # --- Navegação Mensal ---
    if "nav_month" not in st.session_state:
        st.session_state.nav_month = now.month
    if "nav_year" not in st.session_state:
        st.session_state.nav_year = now.year

    # [FIX #1] Clamp para impedir meses futuros ao carregar
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
            # [FIX #1] Verificar se o próximo mês não é futuro
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

    # --- Carregar Dados e Métricas ---
    df_trans, df_assets = load_data()
    mx = compute_metrics(df_trans, df_assets, user, sel_mo, sel_yr)

    # --- Projeção (só mês atual) ---
    projection = compute_projection(mx, sel_mo, sel_yr)

    # --- Alertas ---
    alerts = compute_alerts(mx, sel_mo, sel_yr, projection)

    month_label = fmt_month_year(sel_mo, sel_yr)
    has_data = mx["renda"] > 0 or mx["lifestyle"] > 0 or mx["investido_mes"] > 0

    # ===== HERO =====
    render_autonomia(mx["autonomia"], mx["sobrevivencia"])

    # ===== HEALTH + ALERTAS =====
    render_health_badge(mx["health"], month_label)
    render_alerts(alerts)

    if not has_data:
        render_empty_month(month_label)

    # ===== PROJEÇÃO (só mês atual) =====
    render_projection(projection, mx)

    # ===== KPI STRIP =====
    k1, k2 = st.columns(2)
    k3, k4 = st.columns(2)
    with k1:
        render_kpi(
            "Fluxo Mensal", fmt_brl(mx["disponivel"]),
            "Entradas − Saídas − Aportes", mx["d_disponivel"]
        )
    with k2:
        render_kpi(
            "Renda", fmt_brl(mx["renda"]),
            "Entradas do mês", mx["d_renda"]
        )
    with k3:
        render_kpi(
            "Investido", fmt_brl(mx["investido_mes"]),
            f"Taxa de Aporte: {mx['taxa_aporte']:.1f}%", mx["d_investido"]
        )
    with k4:
        render_kpi(
            "Sobrevivência", fmt_brl(mx["sobrevivencia"]),
            "Patrimônio líquido total"
        )

    # ===== REGRA 50/30/20 =====
    render_regra_503020(mx)

    # ===== ABAS =====
    tab_ls, tab_renda, tab_wealth, tab_pat, tab_hist = st.tabs([
        "LIFESTYLE", "RENDA", "WEALTH", "PATRIMÔNIO", "HISTÓRICO"
    ])

    with tab_ls:
        col_form, col_intel = st.columns([1, 1])
        with col_form:
            render_intel(
                "Consumo Mensal",
                f"Total: <strong>{fmt_brl(mx['lifestyle'])}</strong>"
            )
            if mx["cat_breakdown"]:
                render_cat_breakdown(mx["cat_breakdown"])
            transaction_form(
                form_key="f_lifestyle",
                tipo="Saída",
                categorias=list(CFG.CATEGORIAS_SAIDA),
                submit_label="REGISTRAR SAÍDA",
                desc_placeholder="Ex: Mercado, Uber, Jantar",
                default_step=10.0,
                sel_mo=sel_mo, sel_yr=sel_yr,
                default_resp=user,  # [MELHORIA 1.4]
            )
        with col_intel:
            render_intel("Intel — Lifestyle", mx["insight_ls"])
            evo_data = compute_evolution(df_trans, user, sel_mo, sel_yr)
            render_evolution_chart(evo_data)

    with tab_renda:
        col_form, col_intel = st.columns([1, 1])
        with col_form:
            render_intel(
                "Entradas do Mês",
                f"Total: <strong>{fmt_brl(mx['renda'])}</strong>"
            )
            if mx["renda_breakdown"]:
                render_cat_breakdown(mx["renda_breakdown"])
            transaction_form(
                form_key="f_renda",
                tipo="Entrada",
                categorias=list(CFG.CATEGORIAS_ENTRADA),
                submit_label="REGISTRAR ENTRADA",
                desc_placeholder="Ex: Salário, Freelance",
                default_step=100.0,
                sel_mo=sel_mo, sel_yr=sel_yr,
                default_resp=user,  # [MELHORIA 1.4]
            )
        with col_intel:
            render_intel("Intel — Renda", mx["insight_renda"])

    with tab_wealth:
        col_form, col_intel = st.columns([1, 1])
        with col_form:
            render_intel(
                "Aportes do Mês",
                f"Mês: <strong>{fmt_brl(mx['investido_mes'])}</strong><br>"
                f"Acumulado: <strong>{fmt_brl(mx['investido_total'])}</strong>"
            )
            wealth_form(sel_mo=sel_mo, sel_yr=sel_yr, default_resp=user)  # [MELHORIA 1.4]
        with col_intel:
            render_intel(
                "Intel — Patrimônio",
                f"Sobrevivência: <strong>{fmt_brl(mx['sobrevivencia'])}</strong><br>"
                f"Autonomia: <strong>{mx['autonomia']:.1f} meses</strong>"
            )

    with tab_pat:
        col_form, col_list = st.columns([1, 1])
        with col_form:
            if not df_assets.empty and "Responsavel" in df_assets.columns:
                totais = df_assets.groupby("Responsavel")["Valor"].sum()
                partes = " | ".join(
                    [f"{sanitize(str(r))}: <strong>{fmt_brl(v)}</strong>" for r, v in totais.items()]
                )
            else:
                partes = "Nenhum ativo registrado"
            total_pat = df_assets["Valor"].sum() if not df_assets.empty else 0
            render_intel(
                "Patrimônio Base",
                f"Total: <strong>{fmt_brl(total_pat)}</strong><br>{partes}"
            )
            patrimonio_form()
        with col_list:
            render_intel(
                "Ativos Registrados",
                f"{len(df_assets)} itens no patrimônio base"
            )
            if not df_assets.empty:
                edited_assets = st.data_editor(
                    df_assets,
                    use_container_width=True,
                    num_rows="dynamic",
                    column_config={
                        "Item": st.column_config.TextColumn("Ativo", required=True),
                        "Valor": st.column_config.NumberColumn(
                            "Valor", format="R$ %.2f", required=True, min_value=0.0
                        ),
                        "Responsavel": st.column_config.SelectboxColumn(
                            "Titular", options=list(CFG.RESPONSAVEIS)
                        ),
                    },
                    hide_index=True,
                    key="editor_patrimonio",
                )
                # [FIX #5] Comparação segura
                if not _df_equals_safe(df_assets, edited_assets):
                    c_save, c_cancel = st.columns(2)
                    with c_save:
                        if st.button("✓ SALVAR PATRIMÔNIO", use_container_width=True):
                            if update_sheet(edited_assets, "Patrimonio"):
                                st.toast("✓ Patrimônio atualizado")
                                st.rerun()
                    with c_cancel:
                        if st.button("✗ DESCARTAR", use_container_width=True):
                            st.rerun()
            else:
                render_intel("", "Adicione ativos usando o formulário ao lado.")

    with tab_hist:
        _render_historico(mx, df_trans, user, sel_mo, sel_yr)


# ==============================================================================
# BOOT
# ==============================================================================

if __name__ == "__main__":
    main()