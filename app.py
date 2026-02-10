import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from streamlit_gsheets import GSheetsConnection
from datetime import datetime, timedelta

# ==============================================================================
# 1. SYSTEM BOOT — TERMINAL v3.0
# ==============================================================================
st.set_page_config(
    page_title="L&L — Finanças",
    page_icon="▮",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ==============================================================================
# 2. DESIGN SYSTEM — ANTIGRAVITY ENGINE v3.0
# ==============================================================================
# Paleta: Preto Absoluto (#000) / Verde Esmeralda (#00FFCC) / Off-White (#F0F0F0)
# Geometria: Sharp 0px (Terminal de Elite)
# Tipografia: JetBrains Mono (Dados) + Inter (Labels)
# Proibido: Roxo, Gradientes, Bento Grid, Bordas arredondadas

def inject_css():
    st.markdown("""
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');

        /* ===== EXTERMINAR DEFAULTS STREAMLIT ===== */
        #MainMenu, footer, header { visibility: hidden; }
        .stDeployButton { display: none; }
        div[data-testid="stDecoration"] { display: none; }
        div[data-testid="stToolbar"] { display: none; }

        /* WebApp Standalone — Modo Imersivo */
        .block-container {
            padding: 1rem 1.5rem 1rem 1.5rem !important;
            max-width: 100% !important;
        }

        /* ===== VOID BASE ===== */
        html, body, [class*="css"] {
            font-family: 'Inter', sans-serif;
            background-color: #000000;
            color: #F0F0F0;
        }
        .stApp {
            background-color: #000000;
        }

        /* ===== SCANNER ANIMATION ===== */
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

        /* ===== HERO — AUTONOMIA FINANCEIRA ===== */
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

        /* ===== PAINÉIS TERMINAL ===== */
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

        /* ===== KPI STRIP ===== */
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

        /* ===== BARRA 50/30/20 ===== */
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

        /* ===== INDICADOR DE DESVIO ===== */
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

        /* ===== CAIXA DE INTELIGÊNCIA ===== */
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

        /* ===== BREAKDOWN BARS ===== */
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

        /* ===== NAVEGAÇÃO MENSAL ===== */
        .month-nav {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.85rem;
            color: #F0F0F0;
            text-align: center;
            letter-spacing: 0.1em;
            padding: 6px 0;
        }

        /* ===== OVERRIDE INPUTS STREAMLIT ===== */
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

        /* ===== TABS TERMINAL ===== */
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

        /* ===== BOTÕES DE FORMULÁRIO ===== */
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

        /* ===== BOTÕES GERAIS ===== */
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

        /* ===== DATAFRAME ===== */
        .stDataFrame {
            border: 1px solid #1a1a1a;
            border-radius: 0px !important;
        }

        /* ===== LINHA DE STATUS ===== */
        .status-line {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.6rem;
            color: #333;
            text-align: right;
            padding: 8px 0;
            letter-spacing: 0.05em;
        }

        /* ===== OTIMIZAÇÃO MOBILE ===== */
        @media (max-width: 768px) {
            .autonomia-number { font-size: 4rem; }
            .autonomia-hero { padding: 28px 16px 24px 16px; }
            .block-container { padding: 0.5rem 0.8rem !important; }
            .kpi-mono-value { font-size: 1.1rem; }
            .cat-bar-label { width: 70px; font-size: 0.6rem; }
            .cat-bar-value { width: 80px; font-size: 0.6rem; }
        }

        /* ===== PREFERS REDUCED MOTION ===== */
        @media (prefers-reduced-motion: reduce) {
            .autonomia-hero::after { animation: none; }
            .autonomia-hero { animation: none; }
            .autonomia-number { animation: none; }
        }
    </style>
    """, unsafe_allow_html=True)

inject_css()

# ==============================================================================
# 3. LOCALIZAÇÃO (PT-BR)
# ==============================================================================
MESES_PT = {1:"Jan",2:"Fev",3:"Mar",4:"Abr",5:"Mai",6:"Jun",
            7:"Jul",8:"Ago",9:"Set",10:"Out",11:"Nov",12:"Dez"}
MESES_FULL = {1:"Janeiro",2:"Fevereiro",3:"Março",4:"Abril",5:"Maio",6:"Junho",
              7:"Julho",8:"Agosto",9:"Setembro",10:"Outubro",11:"Novembro",12:"Dezembro"}

def fmt_brl(val):
    """Formata valor em Reais brasileiros."""
    return f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def fmt_date(dt):
    """Formata data no padrão brasileiro."""
    return f"{dt.day:02d} {MESES_PT[dt.month]} {dt.year}"

def fmt_month_year(mo, yr):
    """Formata mês/ano para exibição."""
    return f"{MESES_FULL[mo]} {yr}"

# ==============================================================================
# 4. CAMADA DE DADOS — GOOGLE SHEETS
# ==============================================================================
def get_conn():
    """Conexão com Google Sheets via Streamlit."""
    return st.connection("gsheets", type=GSheetsConnection)

@st.cache_data(ttl=60)
def load_data():
    """Carrega transações e patrimônio do Google Sheets."""
    conn = get_conn()
    try:
        df_trans = conn.read(worksheet="Transacoes", ttl=0)
        df_trans = df_trans.dropna(how="all")
        if not df_trans.empty:
            df_trans["Data"] = pd.to_datetime(df_trans["Data"], errors='coerce')
            df_trans["Valor"] = pd.to_numeric(df_trans["Valor"], errors='coerce').fillna(0.0)
    except Exception:
        df_trans = pd.DataFrame(columns=["Data","Descricao","Valor","Categoria","Tipo","Responsavel"])
    try:
        df_assets = conn.read(worksheet="Patrimonio", ttl=0)
        df_assets = df_assets.dropna(how="all")
        if not df_assets.empty:
            df_assets["Valor"] = pd.to_numeric(df_assets["Valor"], errors='coerce').fillna(0.0)
    except Exception:
        df_assets = pd.DataFrame(columns=["Item","Valor","Responsavel"])
    return df_trans, df_assets

def save_entry(data, worksheet):
    """Salva nova entrada na planilha especificada."""
    conn = get_conn()
    try:
        try:
            df_curr = conn.read(worksheet=worksheet, ttl=0)
        except Exception:
            df_curr = pd.DataFrame()
        df_new = pd.DataFrame([data])
        df_updated = pd.concat([df_curr, df_new], ignore_index=True)
        if "Data" in df_updated.columns:
            df_updated["Data"] = pd.to_datetime(df_updated["Data"]).dt.strftime("%Y-%m-%d")
        conn.update(worksheet=worksheet, data=df_updated)
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"ERRO_SALVAR: {e}")
        return False

def update_sheet(df_edited, worksheet):
    """Atualiza planilha completa com dados editados."""
    conn = get_conn()
    try:
        if "Data" in df_edited.columns:
            df_edited["Data"] = pd.to_datetime(df_edited["Data"]).dt.strftime("%Y-%m-%d")
        conn.update(worksheet=worksheet, data=df_edited)
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"ERRO_ATUALIZAR: {e}")
        return False

# ==============================================================================
# 5. MOTOR ANALÍTICO — MÉTRICAS DE ELITE
# ==============================================================================
NECESSIDADES = ["Moradia", "Alimentação", "Saúde", "Transporte"]
DESEJOS = ["Lazer", "Assinaturas", "Educação", "Outros"]

def compute_metrics(df_trans, df_assets, user_filter, target_month, target_year):
    """Calcula todas as métricas financeiras para filtro e mês selecionado."""
    # --- Filtro por responsável ---
    if user_filter != "Casal":
        df_t = df_trans[df_trans["Responsavel"] == user_filter].copy() if "Responsavel" in df_trans.columns else df_trans.copy()
        df_a = df_assets[df_assets["Responsavel"] == user_filter].copy() if "Responsavel" in df_assets.columns else df_assets.copy()
    else:
        df_t = df_trans.copy()
        df_a = df_assets.copy()

    now = datetime.now()

    m = {
        "renda": 0.0, "lifestyle": 0.0, "investido_mes": 0.0,
        "disponivel": 0.0, "sobrevivencia": 0.0, "investido_total": 0.0,
        "taxa_aporte": 0.0, "autonomia": 0.0,
        "nec_pct": 0.0, "des_pct": 0.0, "inv_pct": 0.0,
        "nec_delta": 0.0, "des_delta": 0.0, "inv_delta": 0.0,
        "top_cat": "—", "top_cat_val": 0.0,
        "top_gasto_desc": "—", "top_gasto_val": 0.0,
        "df": df_t, "insight_ls": "", "insight_renda": "",
        # Deltas vs mês anterior
        "d_renda": None, "d_lifestyle": None, "d_investido": None, "d_disponivel": None,
        # Breakdown por categoria
        "cat_breakdown": {}
    }

    if df_t.empty:
        m["insight_ls"] = "Nenhum dado registrado."
        m["insight_renda"] = "Nenhum dado registrado."
        return m

    # --- Fatia do mês selecionado ---
    df_mo = df_t[(df_t["Data"].dt.month == target_month) & (df_t["Data"].dt.year == target_year)]

    if not df_mo.empty:
        m["renda"] = df_mo[df_mo["Tipo"] == "Entrada"]["Valor"].sum()
        despesas = df_mo[(df_mo["Tipo"] == "Saída") & (df_mo["Categoria"] != "Investimento")]
        m["lifestyle"] = despesas["Valor"].sum()
        m["investido_mes"] = df_mo[(df_mo["Tipo"] == "Saída") & (df_mo["Categoria"] == "Investimento")]["Valor"].sum()

    # --- Disponível (Fluxo Mensal) ---
    m["disponivel"] = m["renda"] - m["lifestyle"] - m["investido_mes"]

    # --- Sobrevivência (Patrimônio Líquido Total) ---
    base_patrimonio = df_a["Valor"].sum()
    m["investido_total"] = df_t[(df_t["Tipo"] == "Saída") & (df_t["Categoria"] == "Investimento")]["Valor"].sum()
    m["sobrevivencia"] = base_patrimonio + m["investido_total"]

    # --- Taxa de Aporte ---
    m["taxa_aporte"] = (m["investido_mes"] / m["renda"] * 100) if m["renda"] > 0 else 0.0

    # --- Autonomia = Patrimônio / Média Gastos 3 meses ---
    inicio_3m = now - timedelta(days=90)
    df_burn = df_t[(df_t["Data"] >= inicio_3m) & (df_t["Tipo"] == "Saída") & (df_t["Categoria"] != "Investimento")]
    if not df_burn.empty:
        dias = max(1, (now - df_burn["Data"].min()).days)
        meses = max(1, min(3, dias / 30))
        media_gastos = df_burn["Valor"].sum() / meses
        m["autonomia"] = (m["sobrevivencia"] / media_gastos) if media_gastos > 0 else 999.0
    else:
        m["autonomia"] = 999.0

    # --- Regra 50/30/20 ---
    if m["renda"] > 0 and not df_mo.empty:
        despesas_mo = df_mo[(df_mo["Tipo"] == "Saída") & (df_mo["Categoria"] != "Investimento")]
        val_nec = despesas_mo[despesas_mo["Categoria"].isin(NECESSIDADES)]["Valor"].sum()
        val_des = despesas_mo[despesas_mo["Categoria"].isin(DESEJOS)]["Valor"].sum()

        m["nec_pct"] = (val_nec / m["renda"]) * 100
        m["des_pct"] = (val_des / m["renda"]) * 100
        m["inv_pct"] = (m["investido_mes"] / m["renda"]) * 100

        m["nec_delta"] = m["nec_pct"] - 50
        m["des_delta"] = m["des_pct"] - 30
        m["inv_delta"] = m["inv_pct"] - 20

    # --- Breakdown por Categoria ---
    if not df_mo.empty:
        cat_grp = df_mo[(df_mo["Tipo"] == "Saída") & (df_mo["Categoria"] != "Investimento")].groupby("Categoria")["Valor"].sum()
        if not cat_grp.empty:
            m["top_cat"] = cat_grp.idxmax()
            m["top_cat_val"] = cat_grp.max()
            m["cat_breakdown"] = cat_grp.sort_values(ascending=False).to_dict()

        top_row = df_mo[(df_mo["Tipo"] == "Saída") & (df_mo["Categoria"] != "Investimento")].nlargest(1, "Valor")
        if not top_row.empty:
            m["top_gasto_desc"] = top_row["Descricao"].values[0]
            m["top_gasto_val"] = top_row["Valor"].values[0]

    # --- Comparativo: Mês Anterior ---
    prev_mo = target_month - 1 if target_month > 1 else 12
    prev_yr = target_year if target_month > 1 else target_year - 1
    df_prev = df_t[(df_t["Data"].dt.month == prev_mo) & (df_t["Data"].dt.year == prev_yr)]

    if not df_prev.empty:
        prev_renda = df_prev[df_prev["Tipo"] == "Entrada"]["Valor"].sum()
        prev_lifestyle = df_prev[(df_prev["Tipo"] == "Saída") & (df_prev["Categoria"] != "Investimento")]["Valor"].sum()
        prev_investido = df_prev[(df_prev["Tipo"] == "Saída") & (df_prev["Categoria"] == "Investimento")]["Valor"].sum()
        prev_disponivel = prev_renda - prev_lifestyle - prev_investido

        m["d_renda"] = _calc_delta(m["renda"], prev_renda)
        m["d_lifestyle"] = _calc_delta(m["lifestyle"], prev_lifestyle)
        m["d_investido"] = _calc_delta(m["investido_mes"], prev_investido)
        m["d_disponivel"] = _calc_delta(m["disponivel"], prev_disponivel)

    # --- Insights ---
    if m["lifestyle"] > 0:
        m["insight_ls"] = f"Impacto: <strong>{m['top_cat']}</strong> ({fmt_brl(m['top_cat_val'])})<br>Maior gasto: <em>{m['top_gasto_desc']}</em> ({fmt_brl(m['top_gasto_val'])})"
    else:
        m["insight_ls"] = "Sem registros de consumo este mês."

    if m["renda"] > 0:
        m["insight_renda"] = f"Gerado: <strong>{fmt_brl(m['renda'])}</strong> este mês."
    else:
        m["insight_renda"] = "Nenhuma entrada registrada."

    return m


def _calc_delta(current, previous):
    """Calcula variação percentual entre valores."""
    if previous == 0:
        return None
    return ((current - previous) / abs(previous)) * 100


def compute_evolution(df_trans, user_filter, ref_month, ref_year, months_back=6):
    """Calcula dados de evolução para gráfico de barras empilhadas."""
    if user_filter != "Casal":
        df = df_trans[df_trans["Responsavel"] == user_filter].copy() if "Responsavel" in df_trans.columns else df_trans.copy()
    else:
        df = df_trans.copy()

    if df.empty:
        return []

    data = []
    mo, yr = ref_month, ref_year
    for _ in range(months_back):
        df_slice = df[(df["Data"].dt.month == mo) & (df["Data"].dt.year == yr)]
        nec = df_slice[(df_slice["Tipo"] == "Saída") & (df_slice["Categoria"].isin(NECESSIDADES))]["Valor"].sum()
        des = df_slice[(df_slice["Tipo"] == "Saída") & (df_slice["Categoria"].isin(DESEJOS))]["Valor"].sum()
        inv = df_slice[(df_slice["Tipo"] == "Saída") & (df_slice["Categoria"] == "Investimento")]["Valor"].sum()
        label = f"{MESES_PT[mo]}/{yr}"
        data.append({"label": label, "necessidades": nec, "desejos": des, "investido": inv})
        mo -= 1
        if mo == 0:
            mo = 12
            yr -= 1

    data.reverse()
    return data


# ==============================================================================
# 6. COMPONENTES VISUAIS — ANTIGRAVITY v3.0
# ==============================================================================
def render_autonomia(val, sobrevivencia):
    """Hero principal — Autonomia Financeira com efeito Scanner."""
    display = min(val, 999)
    color = "#00FFCC" if val >= 12 else "#FFAA00" if val >= 6 else "#FF4444"
    st.markdown(f"""
    <div class="autonomia-hero">
        <div class="autonomia-tag">▮ Autonomia Financeira</div>
        <div class="autonomia-number" style="color: {color};">{display:.1f}</div>
        <div class="autonomia-unit">meses de sobrevivência</div>
        <div class="autonomia-sub">Patrimônio líquido: {fmt_brl(sobrevivencia)}</div>
    </div>
    """, unsafe_allow_html=True)


def render_kpi(label, value, sub="", delta=None, delta_invert=False):
    """KPI com borda lateral, hover glow e delta vs mês anterior."""
    delta_html = ""
    if delta is not None:
        # Para lifestyle, gastar MENOS é bom (invertido)
        if delta_invert:
            cls = "kpi-delta-up" if delta <= 0 else "kpi-delta-down"
        else:
            cls = "kpi-delta-up" if delta >= 0 else "kpi-delta-down"
        if delta == 0:
            cls = "kpi-delta-neutral"
        sinal = "+" if delta > 0 else ""
        delta_html = f'<div class="kpi-delta {cls}">vs anterior: {sinal}{delta:.0f}%</div>'

    st.markdown(f"""
    <div class="kpi-mono">
        <div class="kpi-mono-label">{label}</div>
        <div class="kpi-mono-value">{value}</div>
        <div class="kpi-mono-sub">{sub}</div>
        {delta_html}
    </div>
    """, unsafe_allow_html=True)


def render_intel(title, body):
    """Caixa de inteligência com borda esmeralda."""
    st.markdown(f"""
    <div class="intel-box">
        <div class="intel-title">{title}</div>
        <div class="intel-body">{body}</div>
    </div>
    """, unsafe_allow_html=True)


def render_barra_regra(necessidades, desejos, investimentos):
    """Barra visual da Regra 50/30/20."""
    total = necessidades + desejos + investimentos
    if total == 0:
        n_w, d_w, i_w = 33, 33, 34
    else:
        n_w = max(1, int(necessidades / total * 100))
        d_w = max(1, int(desejos / total * 100))
        i_w = max(1, 100 - n_w - d_w)
    st.markdown(f"""
    <div class="rule-bar-container">
        <div class="rule-bar-seg" style="width:{n_w}%; background:#F0F0F0;"></div>
        <div class="rule-bar-seg" style="width:{d_w}%; background:#FFAA00;"></div>
        <div class="rule-bar-seg" style="width:{i_w}%; background:#00FFCC;"></div>
    </div>
    """, unsafe_allow_html=True)


def badge_desvio(label, pct, delta, meta):
    """Badge de desvio com cores semafóricas."""
    cls = "dev-ok" if abs(delta) <= 5 else "dev-warn" if abs(delta) <= 15 else "dev-danger"
    sinal = "+" if delta > 0 else ""
    st.markdown(
        f'<span class="deviation {cls}">{label} {pct:.0f}% (meta {meta}% | {sinal}{delta:.0f}pp)</span>',
        unsafe_allow_html=True
    )


def render_cat_breakdown(cat_dict):
    """Barras horizontais de breakdown por categoria."""
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
            <span class="cat-bar-label">{cat}</span>
            <div class="cat-bar-track"><div class="cat-bar-fill" style="width:{pct:.0f}%;"></div></div>
            <span class="cat-bar-value">{pct:.0f}%  {fmt_brl(val)}</span>
        </div>"""
    st.markdown(html, unsafe_allow_html=True)


def render_evolution_chart(evo_data):
    """Gráfico de barras empilhadas — evolução 6 meses (Plotly)."""
    if not evo_data:
        render_intel("Evolução", "Dados insuficientes para gráfico.")
        return

    labels = [d["label"] for d in evo_data]
    nec = [d["necessidades"] for d in evo_data]
    des = [d["desejos"] for d in evo_data]
    inv = [d["investido"] for d in evo_data]

    fig = go.Figure()
    fig.add_trace(go.Bar(name="Necessidades", x=labels, y=nec, marker_color="#F0F0F0"))
    fig.add_trace(go.Bar(name="Desejos", x=labels, y=des, marker_color="#FFAA00"))
    fig.add_trace(go.Bar(name="Investido", x=labels, y=inv, marker_color="#00FFCC"))

    fig.update_layout(
        barmode="stack",
        paper_bgcolor="#000000",
        plot_bgcolor="#000000",
        font=dict(family="JetBrains Mono, monospace", color="#888", size=11),
        legend=dict(
            orientation="h", yanchor="bottom", y=1.02,
            xanchor="center", x=0.5, font=dict(size=10)
        ),
        margin=dict(l=0, r=0, t=30, b=0),
        height=280,
        xaxis=dict(gridcolor="#111", showline=False),
        yaxis=dict(gridcolor="#111", showline=False, tickformat=",.0f"),
    )
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})


# ==============================================================================
# 7. APLICAÇÃO PRINCIPAL — TERMINAL L&L v3.0
# ==============================================================================
def main():
    now = datetime.now()

    # --- Barra de Controle (Filtro + Status) ---
    c_filter, c_spacer, c_status = st.columns([1, 2, 1])
    with c_filter:
        try:
            user = st.pills(
                "", ["Casal", "Luan", "Luana"],
                default="Casal", selection_mode="single",
                label_visibility="collapsed"
            )
        except Exception:
            user = st.radio(
                "", ["Casal", "Luan", "Luana"],
                horizontal=True, label_visibility="collapsed"
            )
    if not user:
        user = "Casal"
    with c_status:
        st.markdown(
            f'<div class="status-line">L&L TERMINAL v3.0 — {fmt_date(now)}</div>',
            unsafe_allow_html=True
        )

    # --- Navegação Mensal ---
    if "nav_month" not in st.session_state:
        st.session_state.nav_month = now.month
    if "nav_year" not in st.session_state:
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
        is_current = (st.session_state.nav_month == now.month and st.session_state.nav_year == now.year)
        label_suffix = " ●" if is_current else ""
        st.markdown(
            f'<div class="month-nav">{fmt_month_year(st.session_state.nav_month, st.session_state.nav_year)}{label_suffix}</div>',
            unsafe_allow_html=True
        )
    with nav_next:
        if st.button("▶", key="nav_next", use_container_width=True):
            if not (st.session_state.nav_month == now.month and st.session_state.nav_year == now.year):
                st.session_state.nav_month += 1
                if st.session_state.nav_month == 13:
                    st.session_state.nav_month = 1
                    st.session_state.nav_year += 1
                st.rerun()

    sel_mo = st.session_state.nav_month
    sel_yr = st.session_state.nav_year

    # --- Carregar Dados ---
    df_trans, df_assets = load_data()
    mx = compute_metrics(df_trans, df_assets, user, sel_mo, sel_yr)

    # ===== HERO: AUTONOMIA FINANCEIRA =====
    render_autonomia(mx["autonomia"], mx["sobrevivencia"])

    # ===== KPI STRIP COM DELTAS =====
    k1, k2, k3, k4 = st.columns([1.2, 1, 1, 0.8])
    with k1:
        render_kpi("Fluxo Mensal", fmt_brl(mx["disponivel"]),
                   "Entradas − Saídas − Aportes", mx["d_disponivel"])
    with k2:
        render_kpi("Investido", fmt_brl(mx["investido_mes"]),
                   f"Taxa de Aporte: {mx['taxa_aporte']:.1f}%", mx["d_investido"])
    with k3:
        render_kpi("Sobrevivência", fmt_brl(mx["sobrevivencia"]),
                   "Patrimônio líquido total")
    with k4:
        render_kpi("Renda", fmt_brl(mx["renda"]),
                   "Entradas do mês", mx["d_renda"])

    # ===== REGRA 50/30/20 =====
    st.markdown('<div class="t-panel" style="padding: 12px 16px;">', unsafe_allow_html=True)
    render_barra_regra(mx["nec_pct"], mx["des_pct"], mx["inv_pct"])
    d1, d2, d3 = st.columns(3)
    with d1:
        badge_desvio("Necessidades", mx["nec_pct"], mx["nec_delta"], 50)
    with d2:
        badge_desvio("Desejos", mx["des_pct"], mx["des_delta"], 30)
    with d3:
        badge_desvio("Investimento", mx["inv_pct"], mx["inv_delta"], 20)
    st.markdown('</div>', unsafe_allow_html=True)

    # ===== ABAS DE OPERAÇÃO =====
    tab_ls, tab_renda, tab_wealth, tab_pat, tab_hist = st.tabs([
        "LIFESTYLE", "RENDA", "WEALTH", "PATRIMÔNIO", "HISTÓRICO"
    ], key="main_tabs")

    # --- LIFESTYLE ---
    with tab_ls:
        col_form, col_intel = st.columns([1, 1])
        with col_form:
            render_intel("Consumo Mensal", f"Total: <strong>{fmt_brl(mx['lifestyle'])}</strong>")
            # Breakdown por categoria
            if mx["cat_breakdown"]:
                render_cat_breakdown(mx["cat_breakdown"])
            with st.form("f_lifestyle", clear_on_submit=True):
                d = st.date_input("Data", now, format="DD/MM/YYYY")
                desc = st.text_input("Descrição", placeholder="Ex: Mercado, Uber, Jantar")
                val = st.number_input("Valor (R$)", min_value=0.01, step=10.0)
                cat = st.selectbox("Categoria", [
                    "Moradia", "Alimentação", "Lazer", "Saúde",
                    "Transporte", "Assinaturas", "Educação", "Outros"
                ])
                resp = st.selectbox("Responsável", ["Casal", "Luan", "Luana"])
                if st.form_submit_button("REGISTRAR SAÍDA"):
                    if not desc:
                        st.toast("⚠ Descrição obrigatória")
                    elif val <= 0:
                        st.toast("⚠ Valor inválido")
                    else:
                        entry = {
                            "Data": d, "Descricao": desc, "Valor": val,
                            "Categoria": cat, "Tipo": "Saída", "Responsavel": resp
                        }
                        if save_entry(entry, "Transacoes"):
                            st.toast("✓ Registrado")
                            st.rerun()
        with col_intel:
            render_intel("Intel — Lifestyle", mx["insight_ls"])
            # Gráfico de Evolução 6 meses
            evo_data = compute_evolution(df_trans, user, sel_mo, sel_yr)
            render_evolution_chart(evo_data)

    # --- RENDA ---
    with tab_renda:
        col_form, col_intel = st.columns([1, 1])
        with col_form:
            render_intel("Entradas do Mês", f"Total: <strong>{fmt_brl(mx['renda'])}</strong>")
            with st.form("f_renda", clear_on_submit=True):
                d = st.date_input("Data", now, format="DD/MM/YYYY")
                desc = st.text_input("Fonte", placeholder="Ex: Salário, Freelance")
                val = st.number_input("Valor (R$)", min_value=0.01, step=100.0)
                cat = st.selectbox("Categoria", [
                    "Salário", "Dividendos", "Bônus", "Extra", "Reembolso"
                ])
                resp = st.selectbox("Titular", ["Luan", "Luana", "Casal"])
                if st.form_submit_button("REGISTRAR ENTRADA"):
                    if not desc:
                        st.toast("⚠ Fonte obrigatória")
                    elif val <= 0:
                        st.toast("⚠ Valor inválido")
                    else:
                        entry = {
                            "Data": d, "Descricao": desc, "Valor": val,
                            "Categoria": cat, "Tipo": "Entrada", "Responsavel": resp
                        }
                        if save_entry(entry, "Transacoes"):
                            st.toast("✓ Registrado")
                            st.rerun()
        with col_intel:
            render_intel("Intel — Renda", mx["insight_renda"])

    # --- WEALTH (Aportes) ---
    with tab_wealth:
        col_form, col_intel = st.columns([1, 1])
        with col_form:
            render_intel(
                "Aportes do Mês",
                f"Mês: <strong>{fmt_brl(mx['investido_mes'])}</strong><br>"
                f"Acumulado: <strong>{fmt_brl(mx['investido_total'])}</strong>"
            )
            with st.form("f_wealth", clear_on_submit=True):
                d = st.date_input("Data", now, format="DD/MM/YYYY")
                desc = st.text_input("Ativo / Corretora", placeholder="Ex: IVVB11, Bitcoin, CDB")
                val = st.number_input("Valor (R$)", min_value=0.01, step=100.0)
                resp = st.selectbox("Titular", ["Casal", "Luan", "Luana"])
                if st.form_submit_button("CONFIRMAR APORTE"):
                    if not desc:
                        st.toast("⚠ Descrição obrigatória")
                    elif val <= 0:
                        st.toast("⚠ Valor inválido")
                    else:
                        entry = {
                            "Data": d, "Descricao": desc, "Valor": val,
                            "Categoria": "Investimento", "Tipo": "Saída",
                            "Responsavel": resp
                        }
                        if save_entry(entry, "Transacoes"):
                            st.toast("✓ Aporte registrado")
                            st.rerun()
        with col_intel:
            render_intel(
                "Intel — Patrimônio",
                f"Sobrevivência: <strong>{fmt_brl(mx['sobrevivencia'])}</strong><br>"
                f"Autonomia: <strong>{mx['autonomia']:.1f} meses</strong>"
            )

    # --- PATRIMÔNIO (Saldos e Ativos) ---
    with tab_pat:
        col_form, col_list = st.columns([1, 1])
        with col_form:
            # Total por titular
            if not df_assets.empty and "Responsavel" in df_assets.columns:
                totais = df_assets.groupby("Responsavel")["Valor"].sum()
                partes = " | ".join([f"{r}: <strong>{fmt_brl(v)}</strong>" for r, v in totais.items()])
            else:
                partes = "Nenhum ativo registrado"
            render_intel("Patrimônio Base", f"Total: <strong>{fmt_brl(df_assets['Valor'].sum() if not df_assets.empty else 0)}</strong><br>{partes}")

            with st.form("f_patrimonio", clear_on_submit=True):
                item = st.text_input("Ativo / Conta", placeholder="Ex: Poupança Nubank, Apartamento")
                val = st.number_input("Valor (R$)", min_value=0.01, step=100.0)
                resp = st.selectbox("Titular", ["Casal", "Luan", "Luana"])
                if st.form_submit_button("ADICIONAR ATIVO"):
                    if not item:
                        st.toast("⚠ Nome do ativo obrigatório")
                    elif val <= 0:
                        st.toast("⚠ Valor inválido")
                    else:
                        entry = {"Item": item, "Valor": val, "Responsavel": resp}
                        if save_entry(entry, "Patrimonio"):
                            st.toast("✓ Ativo registrado")
                            st.rerun()
        with col_list:
            render_intel("Ativos Registrados", f"{len(df_assets)} itens no patrimônio base")
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
                            "Titular", options=["Casal", "Luan", "Luana"]
                        )
                    },
                    hide_index=True
                )
                if not df_assets.reset_index(drop=True).equals(edited_assets.reset_index(drop=True)):
                    if st.button("SALVAR PATRIMÔNIO"):
                        if update_sheet(edited_assets, "Patrimonio"):
                            st.toast("✓ Patrimônio atualizado")
                            st.rerun()
            else:
                render_intel("", "Adicione ativos usando o formulário ao lado.")

    # --- HISTÓRICO ---
    with tab_hist:
        try:
            df_hist_base = mx["df"].copy()
            if df_hist_base.empty:
                render_intel("Histórico", "Nenhuma transação registrada.")
            else:
                # Seletor de visualização
                view_mode = st.radio(
                    "Visualização",
                    ["Tudo", "Mês Selecionado"],
                    horizontal=True,
                    label_visibility="collapsed",
                    key="hist_view_mode"
                )

                df_hist = df_hist_base.copy()
                df_hist["Data"] = pd.to_datetime(df_hist["Data"], errors='coerce')

                if view_mode == "Mês Selecionado":
                    df_hist = df_hist[
                        (df_hist["Data"].dt.month == sel_mo) &
                        (df_hist["Data"].dt.year == sel_yr)
                    ]

                df_hist = df_hist.sort_values("Data", ascending=False)
                # Chave dinâmica para forçar atualização quando o filtro ou mês muda
                editor_key = f"hist_ed_{user}_{sel_mo}_{sel_yr}_{view_mode}"
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
                            "Tipo", options=["Entrada", "Saída"], required=True
                        ),
                        "Categoria": st.column_config.SelectboxColumn(
                            "Categoria",
                            options=[
                                "Moradia", "Alimentação", "Lazer", "Saúde",
                                "Transporte", "Investimento", "Salário",
                                "Outros", "Assinaturas", "Educação"
                            ],
                            required=True
                        ),
                        "Descricao": st.column_config.TextColumn("Descrição", required=True),
                        "Responsavel": st.column_config.SelectboxColumn(
                            "Responsável", options=["Casal", "Luan", "Luana"]
                        )
                    },
                    hide_index=True,
                    key=editor_key
                )
                if not df_hist.reset_index(drop=True).equals(edited.reset_index(drop=True)):
                    if st.button("SALVAR ALTERAÇÕES"):
                        if user == "Casal":
                            if update_sheet(edited, "Transacoes"):
                                st.toast("✓ Atualizado")
                                st.rerun()
                        else:
                            st.warning("Mude para 'Casal' para editar o histórico completo.")
        except Exception as e:
            st.error(f"ERRO_CARREGAR: {e}")

if __name__ == "__main__":
    main()
