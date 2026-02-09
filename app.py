import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from streamlit_gsheets import GSheetsConnection
from datetime import datetime, timedelta

# ==============================================================================
# 1. CONFIGURATION & SETUP
# ==============================================================================
st.set_page_config(
    page_title="Family Office",
    page_icon="🏛️",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Hardcoded Expected Income (Metas de Salário)
EXPECTED_INCOME = {
    "Luan": 10000.00,
    "Luana": 10000.00,
    "Casal": 20000.00
}

# Premium Dark Mode & Mobile Optimizations
st.markdown("""
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<style>
    /* Theme Colors: Slate 900 Bg, Emerald 400 Accents */
    :root {
        --bg-color: #0f172a;
        --card-bg: #1e293b;
        --text-primary: #f1f5f9;
        --text-secondary: #94a3b8;
        --accent: #34d399; /* Emerald 400 */
        --danger: #ef4444;
    }
    
    .stApp {
        background-color: var(--bg-color);
        color: var(--text-primary);
    }
    
    /* Remove default header/footer */
    #MainMenu {visibility: hidden;}
    header {visibility: hidden;}
    footer {visibility: hidden;}
    .block-container {padding-top: 2rem !important; padding-bottom: 5rem !important;}

    /* KPI Cards */
    .metric-container {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 20px;
    }
    .metric-card {
        background-color: var(--card-bg);
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 10px;
        flex: 1;
        text-align: center;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .metric-label {
        font-size: 0.70rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .metric-value {
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--accent);
        margin: 5px 0;
    }
    .metric-sub {
        font-size: 0.65rem;
        color: var(--text-secondary);
    }

    /* Inputs & Buttons */
    .stTextInput input, .stNumberInput input, .stSelectbox, .stDateInput input {
        background-color: #334155 !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
    }
    .stButton > button {
        background-color: var(--accent) !important;
        color: #0f172a !important;
        font-weight: 800 !important;
        border-radius: 8px !important;
        height: 52px !important;
        border: none !important;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    /* Tabs */
    .stTabs [data-baseweb="tab-list"] {
        gap: 4px;
        background-color: transparent;
    }
    .stTabs [data-baseweb="tab"] {
        background-color: var(--card-bg);
        border-radius: 6px;
        color: var(--text-secondary);
        border: 1px solid #334155;
        padding: 8px 10px;
        flex: 1;
        text-align: center;
    }
    .stTabs [data-baseweb="tab"][aria-selected="true"] {
        background-color: var(--accent);
        color: #0f172a;
        font-weight: bold;
        border-color: var(--accent);
    }
</style>
""", unsafe_allow_html=True)

# ==============================================================================
# 2. DATA MANAGEMENT (RESILIENT)
# ==============================================================================
def get_conn():
    return st.connection("gsheets", type=GSheetsConnection)

@st.cache_data(ttl=300)
def load_data():
    conn = get_conn()
    
    # 1. Load Transactions
    try:
        df_trans = conn.read(worksheet="Transacoes", ttl=0)
        df_trans = df_trans.dropna(how="all")
        if not df_trans.empty:
            df_trans["Data"] = pd.to_datetime(df_trans["Data"], errors='coerce')
            df_trans["Valor"] = pd.to_numeric(df_trans["Valor"], errors='coerce').fillna(0.0)
    except Exception:
        df_trans = pd.DataFrame(columns=["Data", "Descricao", "Valor", "Categoria", "Tipo", "Responsavel"])

    # 2. Load Assets (Patrimonio)
    try:
        df_assets = conn.read(worksheet="Patrimonio", ttl=0)
        df_assets = df_assets.dropna(how="all")
        if not df_assets.empty:
            df_assets["Valor"] = pd.to_numeric(df_assets["Valor"], errors='coerce').fillna(0.0)
    except Exception:
        df_assets = pd.DataFrame(columns=["Item", "Valor", "Responsavel"])

    return df_trans, df_assets

def save_entry(data, worksheet):
    """Generic save function."""
    conn = get_conn()
    try:
        try:
            df_curr = conn.read(worksheet=worksheet, ttl=0)
            df_curr = df_curr.dropna(how="all")
        except:
             df_curr = pd.DataFrame()
        
        df_new = pd.DataFrame([data])
        df_updated = pd.concat([df_curr, df_new], ignore_index=True)
        
        # Date formatting for Transacoes
        if "Data" in df_updated.columns:
            df_updated["Data"] = pd.to_datetime(df_updated["Data"]).dt.strftime("%Y-%m-%d")
            
        conn.update(worksheet=worksheet, data=df_updated)
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Erro ao salvar em '{worksheet}': {e}")
        return False

# ==============================================================================
# 3. METRICS ENGINE (DIGITAL FAMILY OFFICE)
# ==============================================================================
def calculate_kpis(df_trans, df_assets, responsible_filter):
    # Filter by Responsible
    if responsible_filter != "Casal":
        # Assets Filter
        if "Responsavel" in df_assets.columns:
            df_a = df_assets[df_assets["Responsavel"] == responsible_filter].copy()
        else:
            df_a = df_assets # If shared, show all? Or split? Assume shared for MVP.
        
        # Trans Filter
        if "Responsavel" in df_trans.columns:
            df_t = df_trans[df_trans["Responsavel"] == responsible_filter].copy()
        else:
            df_t = df_trans
            
        expected_inc = EXPECTED_INCOME.get(responsible_filter, 0.0)
    else:
        df_a = df_assets.copy()
        df_t = df_trans.copy()
        expected_inc = EXPECTED_INCOME.get("Casal", 0.0)

    today = datetime.now()
    
    # --- 1. Net Worth (Patrimônio Total) ---
    # Formula: (Sum Assets Tab) + (Cumulative Sum 'Saída' + 'Investimento')
    # Use filtering? Yes.
    base_assets = df_a["Valor"].sum()
    
    invested_flow = 0.0
    if not df_t.empty:
        invested_flow = df_t[
            (df_t["Tipo"] == "Saída") & 
            (df_t["Categoria"] == "Investimento")
        ]["Valor"].sum()
            
    net_worth = base_assets + invested_flow

    # --- 2. Monthly Stats ---
    income_month = 0.0
    savings_month = 0.0
    salary_month = 0.0
    
    if not df_t.empty:
        curr_month_mask = (df_t["Data"].dt.month == today.month) & (df_t["Data"].dt.year == today.year)
        df_month = df_t[curr_month_mask]
        
        # Income total
        income_month = df_month[df_month["Tipo"] == "Entrada"]["Valor"].sum()
        
        # Specific Salary for Goal Tracking
        salary_month = df_month[
            (df_month["Tipo"] == "Entrada") & 
            (df_month["Categoria"] == "Salário")
        ]["Valor"].sum()
        
        # Savings (Investments done this month)
        savings_month = df_month[
            (df_month["Tipo"] == "Saída") & 
            (df_month["Categoria"] == "Investimento")
        ]["Valor"].sum()
    
    savings_rate = (savings_month / income_month * 100) if income_month > 0 else 0.0

    return {
        "net_worth": net_worth,
        "savings_rate": savings_rate,
        "income_month": income_month,
        "salary_month": salary_month,
        "expected_income": expected_inc,
        "base_assets": base_assets,
        "df_t": df_t # filtered transactions
    }

# ==============================================================================
# 4. VIEW COMPONENTS & MAIN
# ==============================================================================
def main():
    # --- Top Bar with Filters ---
    st.markdown("### 🏛️ Digital Family Office")
    
    try:
        user_filter = st.pills("Visão:", ["Casal", "Luan", "Luana"], default="Casal")
    except:
        user_filter = st.radio("Visão:", ["Casal", "Luan", "Luana"], horizontal=True)
    
    if not user_filter: user_filter = "Casal"

    # Load & Calc
    df_trans, df_assets = load_data()
    kpis = calculate_kpis(df_trans, df_assets, user_filter)

    # --- KPI Dashboard ---
    st.markdown(f"""
    <div class="metric-container">
        <div class="metric-card">
            <div class="metric-label">Patrimônio Global</div>
            <div class="metric-value">R$ {kpis['net_worth']:,.0f}</div>
            <div class="metric-sub">Bens + Aportes Acumulados</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Renda Mensal (Atual)</div>
            <div class="metric-value">R$ {kpis['income_month']:,.0f}</div>
            <div class="metric-sub">Meta: R$ {kpis['expected_income']:,.0f}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Savings Rate</div>
            <div class="metric-value">{kpis['savings_rate']:.1f}%</div>
            <div class="metric-sub">Aportes / Renda</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # --- Tabs Layout ---
    tab1, tab2, tab3 = st.tabs(["📝 Lançamentos", "🏦 Configuração", "📊 Dashboard"])

    # TAB 1: NEW TRANSACTION
    with tab1:
        st.caption("Novo Registro Financeiro")
        with st.form("new_transaction", clear_on_submit=True):
            col_d, col_tipo = st.columns(2)
            data = col_d.date_input("Data", datetime.today())
            tipo = col_tipo.selectbox("Tipo", ["Saída", "Entrada"])
            
            desc = st.text_input("Descrição", placeholder="Ex: Salário, Aluguel...")
            
            col_val, col_cat = st.columns(2)
            valor = col_val.number_input("Valor (R$)", min_value=0.01, step=10.00)
            # Ensure 'Salário' is prominent
            cols_cats = ["Moradia", "Alimentação", "Lazer", "Saúde", "Transporte", "Investimento", "Salário", "Outros"]
            categoria = col_cat.selectbox("Categoria", cols_cats)
            
            resp_input = st.selectbox("Responsável", ["Casal", "Luan", "Luana"])
            
            if st.form_submit_button("💾 Registar"):
                if not desc:
                    st.warning("Preencha a descrição.")
                else:
                    entry = {
                        "Data": data, 
                        "Descricao": desc, 
                        "Valor": valor, 
                        "Categoria": categoria, 
                        "Tipo": tipo, 
                        "Responsavel": resp_input
                    }
                    if save_entry(entry, "Transacoes"):
                        st.success("Salvo!")
                        st.balloons()
                        st.rerun()

    # TAB 2: CONFIGURATION (ASSETS & SETUP)
    with tab2:
        st.markdown("#### Configuração Patrimonial")
        
        c_conf1, c_conf2 = st.columns(2)
        with c_conf1:
            st.info(f"**Metas de Salário Definidas (Código):**\n\n- Luan: R$ {EXPECTED_INCOME['Luan']:,.2f}\n- Luana: R$ {EXPECTED_INCOME['Luana']:,.2f}")
        
        with c_conf2:
            st.dataframe(df_assets, use_container_width=True, hide_index=True)

        with st.expander("➕ Adicionar Novo Bem (Saldo Inicial / Imóvel)"):
            with st.form("new_asset"):
                i_name = st.text_input("Item", placeholder="Ex: Apartamento, Saldo Inicial...")
                i_val = st.number_input("Valor (R$)", min_value=0.0)
                i_resp = st.selectbox("Titular", ["Casal", "Luan", "Luana"])
                if st.form_submit_button("Adicionar"):
                    if i_name and i_val > 0:
                        save_entry({"Item": i_name, "Valor": i_val, "Responsavel": i_resp}, "Patrimonio")
                        st.rerun()

    # TAB 3: DASHBOARD STATS
    with tab3:
        df_view = kpis["df_t"]
        
        # Row 1: Income vs Goal
        st.markdown("##### 🎯 Performance de Renda")
        target_income = kpis['expected_income']
        current_income = kpis['income_month']
        
        fig_gauge = go.Figure(go.Indicator(
            mode = "gauge+number+delta",
            value = current_income,
            domain = {'x': [0, 1], 'y': [0, 1]},
            title = {'text': "Renda do Mês (Real vs Meta)"},
            delta = {'reference': target_income},
            gauge = {
                'axis': {'range': [None, target_income * 1.5], 'tickwidth': 1, 'tickcolor': "white"},
                'bar': {'color': "#34d399"},
                'bgcolor': "rgba(0,0,0,0)",
                'borderwidth': 2,
                'bordercolor': "#333",
                'steps': [
                    {'range': [0, target_income], 'color': "#1e293b"},
                    {'range': [target_income, target_income*1.5], 'color': "#064e3b"}],
                'threshold': {
                    'line': {'color': "white", 'width': 4},
                    'thickness': 0.75,
                    'value': target_income}}))
        fig_gauge.update_layout(height=250, paper_bgcolor="rgba(0,0,0,0)", font={'color': "white", 'family': "Arial"})
        st.plotly_chart(fig_gauge, use_container_width=True)

        if not df_view.empty:
            st.markdown("##### 📈 Curva de Patrimônio Líquido")
            # Net Worth Evolution Logic
            df_inv = df_view[
                (df_view["Tipo"] == "Saída") & 
                (df_view["Categoria"] == "Investimento")
            ].sort_values("Data")
            
            if not df_inv.empty:
                # Base Assets are static (t=0), Investments are cumulative flow
                df_inv["Acumulado"] = df_inv["Valor"].cumsum() + kpis['base_assets']
                
                fig_area = px.area(df_inv, x="Data", y="Acumulado")
                fig_area.update_layout(
                    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                    font=dict(color="#94a3b8"), margin=dict(l=0,r=0,t=10,b=0), height=300
                )
                fig_area.update_traces(line_color="#34d399", fillcolor="rgba(52, 211, 153, 0.1)")
                st.plotly_chart(fig_area, use_container_width=True)
            else:
                st.caption("Sem histórico de investimentos.")
            
            st.markdown("##### 📋 Extrato Recente")
            st.dataframe(
                df_view.sort_values("Data", ascending=False).head(10),
                use_container_width=True, hide_index=True
            )

if __name__ == "__main__":
    main()
