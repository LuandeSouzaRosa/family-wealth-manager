import streamlit as st
import pandas as pd
import plotly.express as px
from streamlit_gsheets import GSheetsConnection
from datetime import datetime, timedelta

# ==============================================================================
# 1. CONFIGURATION & SETUP
# ==============================================================================
st.set_page_config(
    page_title="Family Wealth Manager",
    page_icon="🦅",
    layout="wide",
    initial_sidebar_state="collapsed"
)

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
    .block-container {padding-top: 1rem !important; padding-bottom: 3rem !important;}

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
        font-size: 0.75rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .metric-value {
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--accent);
        margin-top: 5px;
    }
    .metric-sub {
        font-size: 0.65rem;
        color: var(--text-secondary);
        margin-top: 2px;
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
        height: 48px !important;
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
        padding: 5px 10px;
        flex: 1;
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
        else:
             df_trans = pd.DataFrame(columns=["Data", "Descricao", "Valor", "Categoria", "Tipo", "Responsavel"])
    except Exception:
        df_trans = pd.DataFrame(columns=["Data", "Descricao", "Valor", "Categoria", "Tipo", "Responsavel"])

    # 2. Load Assets (Patrimonio Inicial / Bens)
    try:
        df_assets = conn.read(worksheet="Patrimonio", ttl=0)
        df_assets = df_assets.dropna(how="all")
        if not df_assets.empty:
            df_assets["Valor"] = pd.to_numeric(df_assets["Valor"], errors='coerce').fillna(0.0)
        else:
             # Create base structure if empty
             df_assets = pd.DataFrame(columns=["Item", "Valor", "Responsavel"])
    except Exception:
        # Fallback if tab missing
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
            # Normalize to string YYYY-MM-DD
            df_updated["Data"] = pd.to_datetime(df_updated["Data"]).dt.strftime("%Y-%m-%d")
            
        conn.update(worksheet=worksheet, data=df_updated)
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Erro ao salvar em '{worksheet}': {e}")
        return False

# ==============================================================================
# 3. METRICS ENGINE
# ==============================================================================
def calculate_kpis(df_trans, df_assets, responsible_filter):
    # Filter by Responsible
    if responsible_filter != "Casal":
        # Check if 'Responsavel' column exists in Assets before filtering
        if "Responsavel" in df_assets.columns:
            df_a = df_assets[df_assets["Responsavel"] == responsible_filter].copy()
        else:
            df_a = df_assets # Assume assets are shared if no column
        
        if "Responsavel" in df_trans.columns:
            df_t = df_trans[df_trans["Responsavel"] == responsible_filter].copy()
        else:
            df_t = df_trans
    else:
        df_a = df_assets.copy()
        df_t = df_trans.copy()

    today = datetime.now()
    
    # --- 1. Net Worth (Patrimônio Total) ---
    # Formula: (Sum Assets Tab) + (Sum 'Investimento' Transactions)
    base_assets = df_a["Valor"].sum()
    
    invested_flow = 0.0
    if not df_t.empty:
        invested_flow = df_t[
            (df_t["Tipo"] == "Saída") & 
            (df_t["Categoria"] == "Investimento")
        ]["Valor"].sum()
            
    net_worth = base_assets + invested_flow

    # --- 2. Monthly Metrics (Income, Savings Rate) ---
    income_month = 0.0
    savings_month = 0.0
    
    if not df_t.empty:
        curr_month_mask = (df_t["Data"].dt.month == today.month) & (df_t["Data"].dt.year == today.year)
        df_month = df_t[curr_month_mask]
        
        # Income: Tipo 'Entrada'
        income_month = df_month[df_month["Tipo"] == "Entrada"]["Valor"].sum()
        
        # Savings: Tipo 'Saída' but Categoria 'Investimento'
        savings_month = df_month[
            (df_month["Tipo"] == "Saída") & 
            (df_month["Categoria"] == "Investimento")
        ]["Valor"].sum()
    
    savings_rate = (savings_month / income_month * 100) if income_month > 0 else 0.0

    # --- 3. Runway ---
    # (Net Worth / Avg Expenses Last 3 Months)
    avg_burn = 0.0
    if not df_t.empty:
        start_date = today - timedelta(days=90)
        df_3m = df_t[df_t["Data"] >= start_date]
        
        # Burn Rate = Expenses (Excluding Investments)
        expenses_3m = df_3m[
            (df_3m["Tipo"] == "Saída") & 
            (df_3m["Categoria"] != "Investimento")
        ]["Valor"].sum()
        
        avg_burn = expenses_3m / 3
        
    runway = (net_worth / avg_burn) if avg_burn > 0 else 999.0

    return {
        "net_worth": net_worth,
        "savings_rate": savings_rate,
        "runway": runway,
        "base_assets": base_assets,
        "df_t": df_t # Return filtered df for charts
    }

# ==============================================================================
# 4. MAIN APPLICATION
# ==============================================================================
def main():
    # --- Header & Filter ---
    c1, c2 = st.columns([1, 1])
    with c1:
        st.markdown("### 🦅 Family Wealth")
    with c2:
        # Use st.pills if available (Streamlit > 1.40), else radio
        try:
            user_filter = st.pills("Visão:", ["Casal", "Luan", "Luana"], selection_mode="single", default="Casal")
        except:
             user_filter = st.radio("Visão", ["Casal", "Luan", "Luana"], horizontal=True, label_visibility="collapsed")

    # Load Data
    df_trans, df_assets = load_data()
    
    # Calc Metrics
    # Handling None in user_filter (st.pills can return None if deselected)
    if not user_filter: user_filter = "Casal"
    
    kpis = calculate_kpis(df_trans, df_assets, user_filter)

    # --- KPI Dashboard ---
    st.markdown(f"""
    <div class="metric-container">
        <div class="metric-card">
            <div class="metric-label">Patrimônio</div>
            <div class="metric-value">R$ {kpis['net_worth']:,.0f}</div>
            <div class="metric-sub">Total Acumulado</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Savings Rate</div>
            <div class="metric-value">{kpis['savings_rate']:.0f}%</div>
            <div class="metric-sub">Meta: >30%</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Runway</div>
            <div class="metric-value">{kpis['runway']:.1f} <span style="font-size:0.8rem">meses</span></div>
            <div class="metric-sub">Liberdade</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # --- Tabs Layout ---
    tab1, tab2, tab3 = st.tabs(["Lançamentos", "Patrimônio Inicial", "Dashboard"])

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
            categoria = col_cat.selectbox("Categoria", [
                "Moradia", "Alimentação", "Lazer", "Saúde", "Transporte", 
                "Investimento", "Salário", "Outros"
            ])
            
            resp_input = st.selectbox("Responsável", ["Casal", "Luan", "Luana"])
            
            if st.form_submit_button("💾 Salvar", use_container_width=True):
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

    # TAB 2: INITIAL ASSETS
    with tab2:
        st.markdown("#### Bens e Saldos Iniciais")
        st.caption("Cadastre saldos de contas, imóveis, veículos. Use 'Lançamentos' para os aportes mensais.")
        
        with st.expander("➕ Adicionar Novo Item"):
            with st.form("new_asset", clear_on_submit=True):
                col1, col2 = st.columns(2)
                item_name = col1.text_input("Item / Ativo", placeholder="Ex: Nubank Inicial")
                item_value = col2.number_input("Valor (R$)", min_value=0.0)
                item_resp = st.selectbox("Pertence a:", ["Casal", "Luan", "Luana"])
                
                if st.form_submit_button("Adicionar"):
                    if item_name and item_value > 0:
                        entry = {"Item": item_name, "Valor": item_value, "Responsavel": item_resp}
                        if save_entry(entry, "Patrimonio"):
                            st.success("Adicionado!")
                            st.rerun()
        
        if not df_assets.empty:
            st.dataframe(
                df_assets, 
                use_container_width=True, 
                hide_index=True,
                column_config={"Valor": st.column_config.NumberColumn("Valor", format="R$ %.2f")}
            )
        else:
            st.info("Nenhum patrimônio cadastrado.")

    # TAB 3: DASHBOARD
    with tab3:
        df_view = kpis["df_t"]
        if not df_view.empty:
            st.markdown("##### 📈 Evolução do Patrimônio")
            
            df_inv = df_view[
                (df_view["Tipo"] == "Saída") & 
                (df_view["Categoria"] == "Investimento")
            ].sort_values("Data")
            
            if not df_inv.empty:
                df_inv["Acumulado"] = df_inv["Valor"].cumsum() + kpis['base_assets']
                
                fig = px.area(df_inv, x="Data", y="Acumulado", height=250)
                fig.update_layout(
                    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                    font=dict(color="#94a3b8"),
                    margin=dict(l=0,r=0,t=10,b=0),
                    yaxis=dict(showgrid=True, gridcolor="#334155")
                )
                fig.update_traces(line_color="#34d399", fillcolor="rgba(52, 211, 153, 0.1)")
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.caption("Sem dados de investimento para o gráfico.")
            
            st.markdown("##### 📋 Extrato Recente")
            st.dataframe(
                df_view.sort_values("Data", ascending=False).head(10),
                use_container_width=True,
                hide_index=True,
                column_config={
                    "Data": st.column_config.DateColumn("Data", format="DD/MM/YYYY"),
                    "Valor": st.column_config.NumberColumn("Valor", format="R$ %.2f")
                }
            )
        else:
            st.caption("Sem transações.")

if __name__ == "__main__":
    main()
