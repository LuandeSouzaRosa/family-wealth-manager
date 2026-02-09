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
    page_title="Family Office v6",
    page_icon="🏛️",
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

@st.cache_data(ttl=60)
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
            raise ValueError("Empty DF")
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
        
    # 3. Load Config/Metas (Optional, for persistent goals)
    try:
        df_config = conn.read(worksheet="Config", ttl=0)
        df_config = df_config.dropna(how="all")
    except:
        df_config = pd.DataFrame(columns=["Chave", "Valor"])

    return df_trans, df_assets, df_config

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

def save_config(key, value):
    """Saves a key-value pair to Config sheet."""
    conn = get_conn()
    try:
        try:
            df_curr = conn.read(worksheet="Config", ttl=0)
        except:
            df_curr = pd.DataFrame(columns=["Chave", "Valor"])
            
        # Update or Append
        if key in df_curr["Chave"].values:
            df_curr.loc[df_curr["Chave"] == key, "Valor"] = value
        else:
            df_curr = pd.concat([df_curr, pd.DataFrame([{"Chave": key, "Valor": value}])], ignore_index=True)
            
        conn.update(worksheet="Config", data=df_curr)
        st.cache_data.clear()
        return True
    except Exception:
        return False

# ==============================================================================
# 3. METRICS ENGINE (DYNAMIC)
# ==============================================================================
def calculate_kpis(df_trans, df_assets, responsible_filter, selected_date, meta_renda):
    
    # --- FILTRATION ---
    # 1. By Responsible
    if responsible_filter != "Casal":
        if "Responsavel" in df_assets.columns:
            df_a = df_assets[df_assets["Responsavel"] == responsible_filter].copy()
        else:
            df_a = df_assets # Assume shared
        
        if "Responsavel" in df_trans.columns:
            df_t = df_trans[df_trans["Responsavel"] == responsible_filter].copy()
        else:
            df_t = df_trans
    else:
        df_a = df_assets.copy()
        df_t = df_trans.copy()

    # --- NET WORTH (HISTORICAL CUMULATIVE) ---
    # Net Worth at End of Selected Month = Base Assets + Cumulative Investments up to that date.
    
    # Selected Month End Date
    # If selected_date is a date object (e.g. 2026-02-01), allow whole month.
    # Actually, "Cumulative" usually means "Everything up to now".
    # But if "Historical Navigation", we should show the state AT THAT TIME.
    
    import calendar
    last_day = calendar.monthrange(selected_date.year, selected_date.month)[1]
    period_end = selected_date.replace(day=last_day, hour=23, minute=59, second=59)
    
    base_assets = df_a["Valor"].sum()
    
    invested_cumulative = 0.0
    if not df_t.empty:
        # Filter transactions happened ON or BEFORE period_end
        df_hist = df_t[df_t["Data"] <= period_end]
        
        invested_cumulative = df_hist[
            (df_hist["Tipo"] == "Saída") & 
            (df_hist["Categoria"] == "Investimento")
        ]["Valor"].sum()
            
    net_worth = base_assets + invested_cumulative

    # --- MONTHLY PERIOD STATS ---
    income_month = 0.0
    savings_month = 0.0
    
    if not df_t.empty:
        # Filter for Specific Month/Year selected
        df_period = df_t[
            (df_t["Data"].dt.month == selected_date.month) & 
            (df_t["Data"].dt.year == selected_date.year)
        ]
        
        income_month = df_period[df_period["Tipo"] == "Entrada"]["Valor"].sum()
        
        savings_month = df_period[
            (df_period["Tipo"] == "Saída") & 
            (df_period["Categoria"] == "Investimento")
        ]["Valor"].sum()
    
    savings_rate = (savings_month / income_month * 100) if income_month > 0 else 0.0
    
    # --- AVG INC (LAST 3M) For Reference ---
    # Calculated from today back 3 months, or from selected_date? Usually "Recent avg".
    avg_income_3m = 0.0
    if not df_t.empty:
        start_3m = datetime.now() - timedelta(days=90)
        df_3m = df_t[df_t["Data"] >= start_3m]
        avg_income_3m = df_3m[df_3m["Tipo"] == "Entrada"]["Valor"].sum() / 3

    return {
        "net_worth": net_worth,
        "savings_rate": savings_rate,
        "income_month": income_month,
        "base_assets": base_assets,
        "df_t_filtered": df_t, # All transactions filtered by User (for trends)
        "df_period": df_period if 'df_period' in locals() else pd.DataFrame(), # Only selected month
        "avg_income_3m": avg_income_3m
    }

# ==============================================================================
# 4. MAIN APPLICATION
# ==============================================================================
def main():
    # --- Top Bar with Filters ---
    st.markdown("### 🏛️ Digital Family Office")
    
    col_u, col_d = st.columns([1, 1])
    with col_u:
        try:
            user_filter = st.pills("Visão:", ["Casal", "Luan", "Luana"], default="Casal")
        except:
            user_filter = st.radio("Visão:", ["Casal", "Luan", "Luana"], horizontal=True)
            
    with col_d:
        # Month/Year Selector
        today = datetime.now()
        # Create a list of last 12 months for quick selection
        months = [today - pd.DateOffset(months=i) for i in range(12)]
        month_options = {d.strftime("%b/%Y"): d for d in months}
        selected_m_str = st.selectbox("Período:", list(month_options.keys()))
        selected_date = month_options[selected_m_str]

    if not user_filter: user_filter = "Casal"

    # Load & Calc
    df_trans, df_assets, df_config = load_data()
    
    # Get saved meta revenue or default
    meta_key = f"Meta_Renda_{user_filter}"
    saved_meta = 0.0
    if not df_config.empty and "Chave" in df_config.columns:
        row = df_config[df_config["Chave"] == meta_key]
        if not row.empty:
            saved_meta = float(row.iloc[0]["Valor"])
    
    kpis = calculate_kpis(df_trans, df_assets, user_filter, selected_date, saved_meta)

    # If no saved meta, use 3-month avg as suggestion
    if saved_meta == 0:
        display_meta = kpis['avg_income_3m'] if kpis['avg_income_3m'] > 0 else 10000.0
    else:
        display_meta = saved_meta

    # --- KPI Dashboard ---
    st.markdown(f"""
    <div class="metric-container">
        <div class="metric-card">
            <div class="metric-label">Patrimônio (Acumulado)</div>
            <div class="metric-value">R$ {kpis['net_worth']:,.0f}</div>
            <div class="metric-sub">Bens + Aportes até {selected_m_str}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Renda ({selected_m_str})</div>
            <div class="metric-value">R$ {kpis['income_month']:,.0f}</div>
            <div class="metric-sub">Meta: R$ {display_meta:,.0f}</div>
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

    # TAB 1: NEW TRANSACTION & LIST
    with tab1:
        st.markdown("#### Novo Registro Financeiro")
        with st.form("new_transaction", clear_on_submit=True):
            col_d, col_tipo = st.columns(2)
            data_in = col_d.date_input("Data", datetime.today())
            tipo = col_tipo.selectbox("Tipo", ["Saída", "Entrada"])
            
            desc = st.text_input("Descrição", placeholder="Ex: Salário, Aluguel...")
            
            col_val, col_cat = st.columns(2)
            valor = col_val.number_input("Valor (R$)", min_value=0.01, step=10.00)
            categoria = col_cat.selectbox("Categoria", ["Moradia", "Alimentação", "Lazer", "Saúde", "Transporte", "Investimento", "Salário", "Outros"])
            
            resp_input = st.selectbox("Responsável", ["Casal", "Luan", "Luana"])
            
            if st.form_submit_button("💾 Salvar"):
                if not desc:
                    st.warning("Preencha a descrição.")
                else:
                    entry = {
                        "Data": data_in, 
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
                        
        st.markdown(f"#### Histórico de {selected_m_str}")
        df_p = kpis['df_period']
        if not df_p.empty:
            st.dataframe(df_p.sort_values("Data", ascending=False), use_container_width=True, hide_index=True)
        else:
            st.info(f"Nenhum registro em {selected_m_str}.")

    # TAB 2: CONFIGURATION (ASSETS & GOALS)
    with tab2:
        st.markdown("#### Meta de Renda Mensal")
        col_meta, col_btn = st.columns([2,1])
        new_meta = col_meta.number_input(f"Definir Meta para {user_filter} (R$)", value=float(display_meta))
        if col_btn.button("Atualizar Meta"):
             if save_config(meta_key, new_meta):
                 st.success("Meta atualizada!")
                 st.rerun()

        st.divider()
        st.markdown("#### Patrimônio Inicial / Bens")
        st.dataframe(df_assets, use_container_width=True, hide_index=True)

        with st.expander("➕ Adicionar Novo Bem"):
            with st.form("new_asset"):
                i_name = st.text_input("Item", placeholder="Ex: Imóvel X")
                i_val = st.number_input("Valor (R$)", min_value=0.0)
                i_resp = st.selectbox("Titular", ["Casal", "Luan", "Luana"])
                if st.form_submit_button("Adicionar"):
                    if i_name and i_val > 0:
                        save_entry({"Item": i_name, "Valor": i_val, "Responsavel": i_resp}, "Patrimonio")
                        st.rerun()

    # TAB 3: DASHBOARD STATS
    with tab3:
        # Chart 1: Income vs Goal
        st.markdown("##### 🎯 Renda Real vs Meta")
        
        fig_gauge = go.Figure(go.Indicator(
            mode = "number+gauge+delta",
            value = kpis['income_month'],
            domain = {'x': [0, 1], 'y': [0, 1]},
            delta = {'reference': display_meta},
            gauge = {
                'axis': {'range': [None, display_meta * 1.5], 'tickwidth': 1},
                'bar': {'color': "#34d399"},
                'bgcolor': "rgba(0,0,0,0)",
                'bordercolor': "#333",
                'steps': [
                    {'range': [0, display_meta], 'color': "#1e293b"},
                    {'range': [display_meta, display_meta*1.5], 'color': "#064e3b"}]}))
        fig_gauge.update_layout(height=200, paper_bgcolor="rgba(0,0,0,0)", font={'color': "white"})
        st.plotly_chart(fig_gauge, use_container_width=True)

        # Chart 2: Net Worth Evolution
        st.markdown("##### 📈 Evolução Patrimonial (Histórico Completo)")
        full_hist = kpis['df_t_filtered']
        if not full_hist.empty:
            df_inv = full_hist[
                (full_hist["Tipo"] == "Saída") & 
                (full_hist["Categoria"] == "Investimento")
            ].sort_values("Data")
            
            if not df_inv.empty:
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

if __name__ == "__main__":
    main()
