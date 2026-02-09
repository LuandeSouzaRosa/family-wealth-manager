import streamlit as st
import pandas as pd
from streamlit_gsheets import GSheetsConnection
from datetime import datetime, timedelta

# ==============================================================================
# 1. SYSTEM BOOT — TERMINAL CONFIGURATION
# ==============================================================================
st.set_page_config(
    page_title="L&L — Terminal",
    page_icon="▮",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ==============================================================================
# 2. DESIGN SYSTEM — ANTIGRAVITY ENGINE
# ==============================================================================
# Palette: Void Black / Emerald Signal / Off-White Technical
# Geometry: Sharp 0px (Terminal) | 24px+ (Shared Goals)
# Typography: JetBrains Mono (Data) + Inter (Labels)
# Bans: No purple. No gradients. No rounded cards. No default Streamlit.

def inject_css():
    st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');

        /* ===== KILL STREAMLIT DEFAULTS ===== */
        #MainMenu, footer, header { visibility: hidden; }
        .stDeployButton { display: none; }
        div[data-testid="stDecoration"] { display: none; }
        
        /* WebApp Standalone Mode */
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

        /* ===== TERMINAL PANELS ===== */
        .t-panel {
            background: #0a0a0a;
            border: 1px solid #1a1a1a;
            border-radius: 0px;
            padding: 20px;
            margin-bottom: 12px;
            transition: border-color 0.3s ease;
        }
        .t-panel:hover {
            border-color: #00FFCC;
        }

        /* ===== HERO RUNWAY ===== */
        .runway-hero {
            background: #000000;
            border: 2px solid #00FFCC;
            border-radius: 0px;
            padding: 40px 32px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .runway-hero::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 2px;
            background: #00FFCC;
            box-shadow: 0 0 20px #00FFCC, 0 0 60px rgba(0,255,204,0.3);
        }
        .runway-number {
            font-family: 'JetBrains Mono', monospace;
            font-size: 5rem;
            font-weight: 700;
            color: #00FFCC;
            line-height: 1;
            letter-spacing: -0.03em;
            text-shadow: 0 0 40px rgba(0,255,204,0.2);
        }
        .runway-unit {
            font-family: 'Inter', sans-serif;
            font-size: 1rem;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 0.3em;
            margin-top: 8px;
        }
        .runway-label {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.7rem;
            color: #00FFCC;
            text-transform: uppercase;
            letter-spacing: 0.5em;
            margin-bottom: 12px;
            opacity: 0.6;
        }

        /* ===== KPI STRIP ===== */
        .kpi-mono {
            font-family: 'JetBrains Mono', monospace;
            border-left: 3px solid #1a1a1a;
            padding: 12px 16px;
            margin-bottom: 8px;
            transition: border-color 0.2s ease, background 0.2s ease;
        }
        .kpi-mono:hover {
            border-left-color: #00FFCC;
            background: rgba(0,255,204,0.02);
        }
        .kpi-mono-label {
            font-size: 0.65rem;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 0.15em;
        }
        .kpi-mono-value {
            font-size: 1.4rem;
            font-weight: 700;
            color: #F0F0F0;
            margin-top: 2px;
        }
        .kpi-mono-sub {
            font-size: 0.7rem;
            color: #444;
            margin-top: 2px;
        }

        /* ===== 50/30/20 BAR ===== */
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

        /* ===== DEVIATION INDICATOR ===== */
        .deviation {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            padding: 4px 8px;
            border-radius: 0px;
            display: inline-block;
            margin: 2px 4px 2px 0;
        }
        .dev-ok { color: #00FFCC; border: 1px solid #00FFCC22; }
        .dev-warn { color: #FFAA00; border: 1px solid #FFAA0022; }
        .dev-danger { color: #FF4444; border: 1px solid #FF444422; }

        /* ===== SUMMARY BOX ===== */
        .intel-box {
            background: #0a0a0a;
            border: 1px solid #1a1a1a;
            border-left: 3px solid #00FFCC;
            border-radius: 0px;
            padding: 14px 16px;
            margin-bottom: 12px;
        }
        .intel-title {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.65rem;
            color: #00FFCC;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            margin-bottom: 6px;
        }
        .intel-body {
            font-size: 0.85rem;
            color: #999;
            line-height: 1.5;
        }

        /* ===== INPUT OVERRIDE ===== */
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

        /* ===== TABS (Terminal) ===== */
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
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            border: none;
            border-bottom: 2px solid transparent;
            padding: 8px 16px 10px 16px;
            transition: color 0.2s ease, border-color 0.2s ease;
        }
        .stTabs [data-baseweb="tab"]:hover {
            color: #F0F0F0;
        }
        .stTabs [data-baseweb="tab"][aria-selected="true"] {
            color: #00FFCC;
            border-bottom: 2px solid #00FFCC;
        }

        /* ===== FORM SUBMIT BUTTONS ===== */
        .stFormSubmitButton button {
            background: transparent !important;
            border: 1px solid #00FFCC !important;
            border-radius: 0px !important;
            color: #00FFCC !important;
            font-family: 'JetBrains Mono', monospace !important;
            text-transform: uppercase !important;
            letter-spacing: 0.1em !important;
            transition: background 0.2s ease, color 0.2s ease !important;
        }
        .stFormSubmitButton button:hover {
            background: #00FFCC !important;
            color: #000000 !important;
        }

        /* ===== REGULAR BUTTONS ===== */
        .stButton button {
            background: transparent !important;
            border: 1px solid #333 !important;
            border-radius: 0px !important;
            color: #F0F0F0 !important;
            font-family: 'JetBrains Mono', monospace !important;
            transition: border-color 0.2s ease !important;
        }
        .stButton button:hover {
            border-color: #00FFCC !important;
        }

        /* ===== DATAFRAME ===== */
        .stDataFrame {
            border: 1px solid #1a1a1a;
            border-radius: 0px !important;
        }

        /* ===== SHARED GOAL CARDS (Organic 24px+) ===== */
        .goal-card {
            background: #0a0a0a;
            border: 1px solid #222;
            border-radius: 24px;
            padding: 20px 24px;
            margin-bottom: 12px;
        }

        /* ===== STATUS LINE ===== */
        .status-line {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.65rem;
            color: #333;
            text-align: right;
            padding: 8px 0;
            letter-spacing: 0.05em;
        }

        /* ===== MOBILE OPTIMIZE ===== */
        @media (max-width: 768px) {
            .runway-number { font-size: 3.5rem; }
            .runway-hero { padding: 24px 16px; }
            .block-container { padding: 0.5rem 0.8rem !important; }
        }
    </style>
    """, unsafe_allow_html=True)

inject_css()

# ==============================================================================
# 3. LOCALIZATION (PT-BR)
# ==============================================================================
def fmt_brl(val):
    return f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def fmt_date(dt):
    m = {1:"Jan",2:"Fev",3:"Mar",4:"Abr",5:"Mai",6:"Jun",7:"Jul",8:"Ago",9:"Set",10:"Out",11:"Nov",12:"Dez"}
    return f"{dt.day:02d} {m[dt.month]} {dt.year}"

# ==============================================================================
# 4. DATA LAYER
# ==============================================================================
def get_conn():
    return st.connection("gsheets", type=GSheetsConnection)

@st.cache_data(ttl=60)
def load_data():
    conn = get_conn()
    try:
        df_trans = conn.read(worksheet="Transacoes", ttl=0)
        df_trans = df_trans.dropna(how="all")
        if not df_trans.empty:
            df_trans["Data"] = pd.to_datetime(df_trans["Data"], errors='coerce')
            df_trans["Valor"] = pd.to_numeric(df_trans["Valor"], errors='coerce').fillna(0.0)
    except:
        df_trans = pd.DataFrame(columns=["Data","Descricao","Valor","Categoria","Tipo","Responsavel"])
    try:
        df_assets = conn.read(worksheet="Patrimonio", ttl=0)
        df_assets = df_assets.dropna(how="all")
        if not df_assets.empty:
            df_assets["Valor"] = pd.to_numeric(df_assets["Valor"], errors='coerce').fillna(0.0)
    except:
        df_assets = pd.DataFrame(columns=["Item","Valor","Responsavel"])
    return df_trans, df_assets

def save_entry(data, worksheet):
    conn = get_conn()
    try:
        try:
            df_curr = conn.read(worksheet=worksheet, ttl=0)
        except:
            df_curr = pd.DataFrame()
        df_new = pd.DataFrame([data])
        df_updated = pd.concat([df_curr, df_new], ignore_index=True)
        if "Data" in df_updated.columns:
            df_updated["Data"] = pd.to_datetime(df_updated["Data"]).dt.strftime("%Y-%m-%d")
        conn.update(worksheet=worksheet, data=df_updated)
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"SAVE_ERR: {e}")
        return False

def update_sheet(df_edited, worksheet):
    conn = get_conn()
    try:
        if "Data" in df_edited.columns:
            df_edited["Data"] = pd.to_datetime(df_edited["Data"]).dt.strftime("%Y-%m-%d")
        conn.update(worksheet=worksheet, data=df_edited)
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"UPDATE_ERR: {e}")
        return False

# ==============================================================================
# 5. ANALYTICS ENGINE — ELITE METRICS
# ==============================================================================
NEEDS_CATS = ["Moradia", "Alimentação", "Saúde", "Transporte"]
WANTS_CATS = ["Lazer", "Assinaturas", "Educação", "Outros"]

def compute_metrics(df_trans, df_assets, user_filter):
    # --- Filter ---
    if user_filter != "Casal":
        df_t = df_trans[df_trans["Responsavel"] == user_filter].copy() if "Responsavel" in df_trans.columns else df_trans.copy()
        df_a = df_assets[df_assets["Responsavel"] == user_filter].copy() if "Responsavel" in df_assets.columns else df_assets.copy()
    else:
        df_t = df_trans.copy()
        df_a = df_assets.copy()

    # --- Defaults ---
    now = datetime.now()
    mo, yr = now.month, now.year
    
    m = {
        "income": 0.0, "lifestyle": 0.0, "invested_mo": 0.0,
        "available": 0.0, "net_worth": 0.0, "all_invested": 0.0,
        "savings_rate": 0.0, "runway": 0.0,
        "needs_pct": 0.0, "wants_pct": 0.0, "savings_pct": 0.0,
        "needs_delta": 0.0, "wants_delta": 0.0, "savings_delta": 0.0,
        "top_cat": "—", "top_cat_val": 0.0,
        "top_expense_desc": "—", "top_expense_val": 0.0,
        "df": df_t, "insight_ls": "", "insight_inc": ""
    }

    if df_t.empty:
        m["insight_ls"] = "Nenhum dado registrado."
        m["insight_inc"] = "Nenhum dado registrado."
        return m

    # --- Monthly slice ---
    df_mo = df_t[(df_t["Data"].dt.month == mo) & (df_t["Data"].dt.year == yr)]

    if not df_mo.empty:
        m["income"] = df_mo[df_mo["Tipo"] == "Entrada"]["Valor"].sum()
        
        expenses = df_mo[(df_mo["Tipo"] == "Saída") & (df_mo["Categoria"] != "Investimento")]
        m["lifestyle"] = expenses["Valor"].sum()
        
        m["invested_mo"] = df_mo[(df_mo["Tipo"] == "Saída") & (df_mo["Categoria"] == "Investimento")]["Valor"].sum()

    # --- Available ---
    m["available"] = m["income"] - m["lifestyle"] - m["invested_mo"]

    # --- Net Worth (All Time) ---
    base_assets = df_a["Valor"].sum()
    m["all_invested"] = df_t[(df_t["Tipo"] == "Saída") & (df_t["Categoria"] == "Investimento")]["Valor"].sum()
    m["net_worth"] = base_assets + m["all_invested"]

    # --- Savings Rate ---
    m["savings_rate"] = (m["invested_mo"] / m["income"] * 100) if m["income"] > 0 else 0.0

    # --- Runway (Net Worth / 3mo Avg Burn) ---
    start_3m = now - timedelta(days=90)
    df_burn = df_t[(df_t["Data"] >= start_3m) & (df_t["Tipo"] == "Saída") & (df_t["Categoria"] != "Investimento")]
    if not df_burn.empty:
        days_span = max(1, (now - df_burn["Data"].min()).days)
        months_span = max(1, min(3, days_span / 30))
        avg_burn = df_burn["Valor"].sum() / months_span
        m["runway"] = (m["net_worth"] / avg_burn) if avg_burn > 0 else 999.0
    else:
        m["runway"] = 999.0

    # --- 50/30/20 Rule ---
    if m["income"] > 0 and not df_mo.empty:
        expenses_mo = df_mo[(df_mo["Tipo"] == "Saída") & (df_mo["Categoria"] != "Investimento")]
        needs_val = expenses_mo[expenses_mo["Categoria"].isin(NEEDS_CATS)]["Valor"].sum()
        wants_val = expenses_mo[expenses_mo["Categoria"].isin(WANTS_CATS)]["Valor"].sum()
        
        m["needs_pct"] = (needs_val / m["income"]) * 100
        m["wants_pct"] = (wants_val / m["income"]) * 100
        m["savings_pct"] = (m["invested_mo"] / m["income"]) * 100
        
        m["needs_delta"] = m["needs_pct"] - 50
        m["wants_delta"] = m["wants_pct"] - 30
        m["savings_delta"] = m["savings_pct"] - 20

    # --- Top Expense Intelligence ---
    if not df_mo.empty:
        cat_grp = df_mo[(df_mo["Tipo"] == "Saída") & (df_mo["Categoria"] != "Investimento")].groupby("Categoria")["Valor"].sum()
        if not cat_grp.empty:
            m["top_cat"] = cat_grp.idxmax()
            m["top_cat_val"] = cat_grp.max()
        
        top_row = df_mo[(df_mo["Tipo"] == "Saída") & (df_mo["Categoria"] != "Investimento")].nlargest(1, "Valor")
        if not top_row.empty:
            m["top_expense_desc"] = top_row["Descricao"].values[0]
            m["top_expense_val"] = top_row["Valor"].values[0]

    # --- Insights ---
    if m["lifestyle"] > 0:
        m["insight_ls"] = f"Impacto: <strong>{m['top_cat']}</strong> ({fmt_brl(m['top_cat_val'])})<br>Maior gasto: <em>{m['top_expense_desc']}</em> ({fmt_brl(m['top_expense_val'])})"
    else:
        m["insight_ls"] = "Sem registros de consumo este mês."
    
    if m["income"] > 0:
        m["insight_inc"] = f"Gerado: <strong>{fmt_brl(m['income'])}</strong> este mês. Continue construindo."
    else:
        m["insight_inc"] = "Nenhuma entrada registrada."

    return m

# ==============================================================================
# 6. VISUAL COMPONENTS
# ==============================================================================
def render_runway(val):
    # Clamp for display
    display_val = min(val, 999)
    color = "#00FFCC" if val >= 12 else "#FFAA00" if val >= 6 else "#FF4444"
    st.markdown(f"""
    <div class="runway-hero">
        <div class="runway-label">▮ Liberdade Financeira</div>
        <div class="runway-number" style="color: {color};">{display_val:.1f}</div>
        <div class="runway-unit">meses de autonomia</div>
    </div>
    """, unsafe_allow_html=True)

def render_kpi(label, value, sub=""):
    st.markdown(f"""
    <div class="kpi-mono">
        <div class="kpi-mono-label">{label}</div>
        <div class="kpi-mono-value">{value}</div>
        <div class="kpi-mono-sub">{sub}</div>
    </div>
    """, unsafe_allow_html=True)

def render_intel(title, body):
    st.markdown(f"""
    <div class="intel-box">
        <div class="intel-title">{title}</div>
        <div class="intel-body">{body}</div>
    </div>
    """, unsafe_allow_html=True)

def render_rule_bar(needs, wants, savings):
    total = needs + wants + savings
    if total == 0:
        n_w, w_w, s_w = 33, 33, 34
    else:
        n_w = max(1, int(needs / total * 100))
        w_w = max(1, int(wants / total * 100))
        s_w = max(1, 100 - n_w - w_w)
    st.markdown(f"""
    <div class="rule-bar-container">
        <div class="rule-bar-seg" style="width:{n_w}%; background:#F0F0F0;"></div>
        <div class="rule-bar-seg" style="width:{w_w}%; background:#FFAA00;"></div>
        <div class="rule-bar-seg" style="width:{s_w}%; background:#00FFCC;"></div>
    </div>
    """, unsafe_allow_html=True)

def deviation_badge(label, pct, delta, target):
    cls = "dev-ok" if abs(delta) <= 5 else "dev-warn" if abs(delta) <= 15 else "dev-danger"
    sign = "+" if delta > 0 else ""
    st.markdown(f'<span class="deviation {cls}">{label} {pct:.0f}% (meta {target}% | {sign}{delta:.0f}pp)</span>', unsafe_allow_html=True)

# ==============================================================================
# 7. MAIN APPLICATION
# ==============================================================================
def main():
    # --- Control Strip ---
    c_filter, c_spacer, c_status = st.columns([1, 2, 1])
    with c_filter:
        try:
            user = st.pills("", ["Casal", "Luan", "Luana"], default="Casal", selection_mode="single", label_visibility="collapsed")
        except:
            user = st.radio("", ["Casal", "Luan", "Luana"], horizontal=True, label_visibility="collapsed")
    if not user:
        user = "Casal"
    with c_status:
        st.markdown(f'<div class="status-line">L&L TERMINAL v2.0 — {fmt_date(datetime.now())}</div>', unsafe_allow_html=True)

    # --- Load ---
    df_trans, df_assets = load_data()
    mx = compute_metrics(df_trans, df_assets, user)

    # ===== HERO: ASYMMETRIC LAYOUT (90/10 Visual Weight) =====
    # Runway takes center stage
    col_hero, col_strip = st.columns([3, 1])
    
    with col_hero:
        render_runway(mx["runway"])
    
    with col_strip:
        render_kpi("Disponível", fmt_brl(mx["available"]), "Fluxo livre do mês")
        render_kpi("Investido", fmt_brl(mx["invested_mo"]), f"Taxa: {mx['savings_rate']:.1f}%")
        render_kpi("Patrimônio", fmt_brl(mx["net_worth"]), "Base + Aportes")

    # ===== 50/30/20 DEVIATION =====
    st.markdown('<div class="t-panel" style="padding: 12px 16px;">', unsafe_allow_html=True)
    render_rule_bar(mx["needs_pct"], mx["wants_pct"], mx["savings_pct"])
    dev_cols = st.columns(3)
    with dev_cols[0]:
        deviation_badge("Necessidades", mx["needs_pct"], mx["needs_delta"], 50)
    with dev_cols[1]:
        deviation_badge("Desejos", mx["wants_pct"], mx["wants_delta"], 30)
    with dev_cols[2]:
        deviation_badge("Investimento", mx["savings_pct"], mx["savings_delta"], 20)
    st.markdown('</div>', unsafe_allow_html=True)

    # ===== OPERATION TABS =====
    tab_ls, tab_inc, tab_wlth, tab_hist = st.tabs([
        "LIFESTYLE", "RENDA", "WEALTH", "HISTÓRICO"
    ])

    # --- LIFESTYLE ---
    with tab_ls:
        col_form, col_intel = st.columns([1, 1])
        with col_form:
            render_intel("Consumo Mensal", f"Total: <strong>{fmt_brl(mx['lifestyle'])}</strong>")
            with st.form("f_lifestyle", clear_on_submit=True):
                d = st.date_input("Data", datetime.now(), format="DD/MM/YYYY")
                desc = st.text_input("Descrição", placeholder="Ex: Mercado, Uber, Jantar")
                val = st.number_input("Valor (R$)", min_value=0.01, step=10.0)
                cat = st.selectbox("Categoria", ["Moradia","Alimentação","Lazer","Saúde","Transporte","Assinaturas","Educação","Outros"])
                resp = st.selectbox("Responsável", ["Casal","Luan","Luana"])
                if st.form_submit_button("REGISTRAR SAÍDA"):
                    if not desc:
                        st.toast("⚠ Descrição obrigatória")
                    elif val <= 0:
                        st.toast("⚠ Valor inválido")
                    else:
                        if save_entry({"Data":d,"Descricao":desc,"Valor":val,"Categoria":cat,"Tipo":"Saída","Responsavel":resp}, "Transacoes"):
                            st.toast("✓ Registrado")
                            st.rerun()
        with col_intel:
            render_intel("Intel — Lifestyle", mx["insight_ls"])

    # --- RENDA ---
    with tab_inc:
        col_form, col_intel = st.columns([1, 1])
        with col_form:
            render_intel("Entradas do Mês", f"Total: <strong>{fmt_brl(mx['income'])}</strong>")
            with st.form("f_income", clear_on_submit=True):
                d = st.date_input("Data", datetime.now(), format="DD/MM/YYYY")
                desc = st.text_input("Fonte", placeholder="Ex: Salário, Freelance")
                val = st.number_input("Valor (R$)", min_value=0.01, step=100.0)
                cat = st.selectbox("Categoria", ["Salário","Dividendos","Bônus","Extra","Reembolso"])
                resp = st.selectbox("Titular", ["Luan","Luana","Casal"])
                if st.form_submit_button("REGISTRAR ENTRADA"):
                    if not desc:
                        st.toast("⚠ Fonte obrigatória")
                    elif val <= 0:
                        st.toast("⚠ Valor inválido")
                    else:
                        if save_entry({"Data":d,"Descricao":desc,"Valor":val,"Categoria":cat,"Tipo":"Entrada","Responsavel":resp}, "Transacoes"):
                            st.toast("✓ Registrado")
                            st.rerun()
        with col_intel:
            render_intel("Intel — Renda", mx["insight_inc"])

    # --- WEALTH ---
    with tab_wlth:
        col_form, col_intel = st.columns([1, 1])
        with col_form:
            render_intel("Aportes do Mês", f"Mês: <strong>{fmt_brl(mx['invested_mo'])}</strong><br>Acumulado: <strong>{fmt_brl(mx['all_invested'])}</strong>")
            with st.form("f_wealth", clear_on_submit=True):
                d = st.date_input("Data", datetime.now(), format="DD/MM/YYYY")
                desc = st.text_input("Ativo / Corretora", placeholder="Ex: IVVB11, Bitcoin, CDB")
                val = st.number_input("Valor (R$)", min_value=0.01, step=100.0)
                resp = st.selectbox("Titular", ["Casal","Luan","Luana"])
                if st.form_submit_button("CONFIRMAR APORTE"):
                    if not desc:
                        st.toast("⚠ Descrição obrigatória")
                    elif val <= 0:
                        st.toast("⚠ Valor inválido")
                    else:
                        if save_entry({"Data":d,"Descricao":desc,"Valor":val,"Categoria":"Investimento","Tipo":"Saída","Responsavel":resp}, "Transacoes"):
                            st.toast("✓ Aporte registrado")
                            st.rerun()
        with col_intel:
            render_intel("Intel — Patrimônio", f"Net Worth: <strong>{fmt_brl(mx['net_worth'])}</strong><br>Runway: <strong>{mx['runway']:.1f} meses</strong>")

    # --- HISTÓRICO ---
    with tab_hist:
        try:
            df_hist = mx["df"].sort_values("Data", ascending=False)
            edited = st.data_editor(
                df_hist,
                use_container_width=True,
                num_rows="dynamic",
                column_config={
                    "Data": st.column_config.DateColumn("Data", format="DD/MM/YYYY", required=True),
                    "Valor": st.column_config.NumberColumn("Valor", format="R$ %.2f", required=True, min_value=0.0),
                    "Tipo": st.column_config.SelectboxColumn("Tipo", options=["Entrada","Saída"], required=True),
                    "Categoria": st.column_config.SelectboxColumn("Categoria", options=["Moradia","Alimentação","Lazer","Saúde","Transporte","Investimento","Salário","Outros","Assinaturas","Educação"], required=True),
                    "Descricao": st.column_config.TextColumn("Descrição", required=True),
                    "Responsavel": st.column_config.SelectboxColumn("Responsável", options=["Casal","Luan","Luana"])
                },
                hide_index=True
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
            st.error(f"LOAD_ERR: {e}")

if __name__ == "__main__":
    main()
