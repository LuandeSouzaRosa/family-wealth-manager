import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from streamlit_gsheets import GSheetsConnection
from datetime import datetime, timedelta

# ==============================================================================
# 1. CONFIGURATION & DESIGN SYSTEM (GLASSMORPHISM)
# ==============================================================================
st.set_page_config(
    page_title="Family Office",
    page_icon="🦅",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Premium Glassmorphism CSS
def local_css():
    st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
        
        /* Base Variables */
        :root {
            --bg-color: #0f172a; /* Slate 900 */
            --glass-bg: rgba(30, 41, 59, 0.7); /* Slate 800 semi-transparent */
            --glass-border: 1px solid rgba(255, 255, 255, 0.08);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-primary: #3b82f6; /* Blue 500 */
            --accent-success: #10b981; /* Emerald 500 */
            --radius-lg: 16px;
            --radius-md: 12px;
        }

        /* Global Reset */
        html, body, [class*="css"] {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
        }
        
        .stApp {
            background: radial-gradient(circle at top left, #1e293b, #0f172a);
        }

        /* Hide Streamlit Elements */
        #MainMenu, header, footer {visibility: hidden;}
        .block-container {
            padding-top: 1.5rem !important; 
            padding-bottom: 3rem !important;
            max-width: 1000px;
        }

        /* Glass Cards */
        .glass-card {
            background: var(--glass-bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: var(--glass-border);
            border-radius: var(--radius-lg);
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
        }

        /* KPI Typography */
        .kpi-label {
            font-size: 0.75rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 4px;
        }
        .kpi-value {
            font-size: 1.6rem;
            font-weight: 800;
            background: linear-gradient(90deg, #fff, #cbd5e1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .kpi-sub {
            font-size: 0.75rem;
            color: var(--accent-success);
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        /* Inputs Customization */
        .stTextInput input, .stNumberInput input, .stSelectbox, .stDateInput input {
            background-color: rgba(15, 23, 42, 0.6) !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            color: white !important;
            border-radius: var(--radius-md) !important;
            padding: 10px 12px !important;
        }
        .stTextInput input:focus, .stNumberInput input:focus {
            border-color: var(--accent-primary) !important;
            box-shadow: 0 0 0 1px var(--accent-primary) !important;
        }

        /* Tabs as Modern Nav */
        .stTabs [data-baseweb="tab-list"] {
            background-color: rgba(15, 23, 42, 0.5);
            padding: 4px;
            border-radius: var(--radius-lg);
            border: var(--glass-border);
            margin-bottom: 20px;
        }
        .stTabs [data-baseweb="tab"] {
            border-radius: var(--radius-md);
            color: var(--text-secondary);
            border: none;
            background: transparent;
            font-weight: 500;
            font-size: 0.9rem;
        }
        .stTabs [data-baseweb="tab"][aria-selected="true"] {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: white;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        /* Action Button */
        .stButton > button {
            background: linear-gradient(135deg, #10b981, #059669) !important;
            color: white !important;
            font-weight: 700 !important;
            border-radius: var(--radius-md) !important;
            border: none !important;
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3) !important;
            transition: transform 0.1s ease;
        }
        .stButton > button:active {
            transform: scale(0.98);
        }
    </style>
    """, unsafe_allow_html=True)

local_css()

# ==============================================================================
# 2. DATA LAYER (ROBUST & CACHED)
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
        df_trans = pd.DataFrame(columns=["Data", "Descricao", "Valor", "Categoria", "Tipo", "Responsavel"])

    try:
        df_assets = conn.read(worksheet="Patrimonio", ttl=0)
        df_assets = df_assets.dropna(how="all")
        if not df_assets.empty:
            df_assets["Valor"] = pd.to_numeric(df_assets["Valor"], errors='coerce').fillna(0.0)
    except:
        df_assets = pd.DataFrame(columns=["Item", "Valor", "Responsavel"])
        
    try:
        df_config = conn.read(worksheet="Config", ttl=0)
        df_config = df_config.dropna(how="all")
    except:
        df_config = pd.DataFrame(columns=["Chave", "Valor"])

    return df_trans, df_assets, df_config

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
        st.error(f"Save Error: {e}")
        return False

def save_config(key, value):
    conn = get_conn()
    try:
        try:
            df_curr = conn.read(worksheet="Config", ttl=0)
        except:
            df_curr = pd.DataFrame(columns=["Chave", "Valor"])
            
        if key in df_curr["Chave"].values:
            df_curr.loc[df_curr["Chave"] == key, "Valor"] = value
        else:
            df_curr = pd.concat([df_curr, pd.DataFrame([{"Chave": key, "Valor": value}])], ignore_index=True)
            
        conn.update(worksheet="Config", data=df_curr)
        st.cache_data.clear()
        return True
    except:
        return False

# ==============================================================================
# 3. ANALYTICS ENGINE
# ==============================================================================
def calculate_kpis(df_trans, df_assets, responsible_filter, selected_date, meta_renda):
    import calendar
    
    # Filter Responsibility
    if responsible_filter != "Casal":
        df_a = df_assets[df_assets["Responsavel"] == responsible_filter].copy() if "Responsavel" in df_assets.columns else df_assets
        df_t = df_trans[df_trans["Responsavel"] == responsible_filter].copy() if "Responsavel" in df_trans.columns else df_trans
    else:
        df_a = df_assets.copy()
        df_t = df_trans.copy()

    # Net Worth Date Boundary (End of selected month)
    last_day = calendar.monthrange(selected_date.year, selected_date.month)[1]
    period_end = selected_date.replace(day=last_day, hour=23, minute=59)
    
    base_assets = df_a["Valor"].sum()
    invested_cumulative = 0.0
    
    if not df_t.empty:
        # History up to selected date
        df_hist = df_t[df_t["Data"] <= period_end]
        invested_cumulative = df_hist[
            (df_hist["Tipo"] == "Saída") & (df_hist["Categoria"] == "Investimento")
        ]["Valor"].sum()
            
    net_worth = base_assets + invested_cumulative

    # Monthly Metrics
    income_month = 0.0
    savings_month = 0.0
    expenses_month = 0.0
    
    df_period = pd.DataFrame()
    if not df_t.empty:
        df_period = df_t[
            (df_t["Data"].dt.month == selected_date.month) & 
            (df_t["Data"].dt.year == selected_date.year)
        ]
        
        income_month = df_period[df_period["Tipo"] == "Entrada"]["Valor"].sum()
        savings_month = df_period[(df_period["Tipo"] == "Saída") & (df_period["Categoria"] == "Investimento")]["Valor"].sum()
        expenses_month = df_period[(df_period["Tipo"] == "Saída") & (df_period["Categoria"] != "Investimento")]["Valor"].sum()
    
    savings_rate = (savings_month / income_month * 100) if income_month > 0 else 0.0
    
    # Burn Rate (3M Avg)
    avg_burn = 0.0
    if not df_t.empty:
        start_3m = datetime.now() - timedelta(days=90)
        df_3m = df_t[(df_t["Data"] >= start_3m) & (df_t["Tipo"] == "Saída") & (df_t["Categoria"] != "Investimento")]
        avg_burn = df_3m["Valor"].sum() / 3
        
    runway = (net_worth / avg_burn) if avg_burn > 0 else 999.0

    return {
        "net_worth": net_worth,
        "savings_rate": savings_rate,
        "income_month": income_month,
        "expenses_month": expenses_month,
        "base_assets": base_assets,
        "df_t_period": df_period,
        "df_t_all": df_t, # for historical charts
        "runway": runway
    }

# ==============================================================================
# 4. COMPONENT RENDERING
# ==============================================================================
def render_kpi_card(label, value, sub_label):
    st.markdown(f"""
    <div class="glass-card" style="padding: 15px; text-align: center; margin-bottom: 0px;">
        <div class="kpi-label">{label}</div>
        <div class="kpi-value">{value}</div>
        <div class="kpi-sub" style="justify-content: center;">{sub_label}</div>
    </div>
    """, unsafe_allow_html=True)

def main():
    # --- Filter Header ---
    c_filter_1, c_filter_2 = st.columns([1, 1], gap="small")
    with c_filter_1:
        try:
            user_filter = st.pills("👤 Visão", ["Casal", "Luan", "Luana"], default="Casal")
        except:
            user_filter = st.radio("👤 Visão", ["Casal", "Luan", "Luana"], horizontal=True)
            
    with c_filter_2:
        today = datetime.now()
        months = [today - pd.DateOffset(months=i) for i in range(12)]
        month_options = {d.strftime("%b/%Y"): d for d in months}
        selected_m_str = st.selectbox("📅 Período", list(month_options.keys()))
        selected_date = month_options[selected_m_str]

    if not user_filter: user_filter = "Casal"

    # Data Loading
    df_trans, df_assets, df_config = load_data()
    
    # Meta Resolution
    meta_key = f"Meta_Renda_{user_filter}"
    saved_meta = 0.0
    if not df_config.empty:
         row = df_config[df_config["Chave"] == meta_key]
         if not row.empty: saved_meta = float(row.iloc[0]["Valor"])
    target_income = saved_meta if saved_meta > 0 else 10000.0
    
    # Calculate Config
    kpis = calculate_kpis(df_trans, df_assets, user_filter, selected_date, target_income)

    # --- KPI Overview ---
    c1, c2, c3 = st.columns(3, gap="small")
    with c1:
        render_kpi_card("Patrimônio", f"R$ {kpis['net_worth']/1000:.1f}k", "Total Acumulado")
    with c2:
        delta = kpis['income_month'] - target_income
        color = "#10b981" if delta >= 0 else "#ef4444"
        render_kpi_card("Renda Mês", f"R$ {kpis['income_month']:,.0f}", f"<span style='color:{color}'>Meta: {target_income/1000:.1f}k</span>")
    with c3:
        render_kpi_card("Savings Rate", f"{kpis['savings_rate']:.1f}%", f"Runway: {kpis['runway']:.1f}m")

    # --- Content Tabs ---
    tab_launch, tab_extract, tab_analytics, tab_settings = st.tabs(["📝 Lançamentos", "📜 Extrato", "📊 Analytics", "⚙️ Ajustes"])

    # 1. LANÇAMENTOS
    with tab_launch:
        with st.container():
            st.markdown('<div class="glass-card">', unsafe_allow_html=True)
            with st.form("new_transaction_form", clear_on_submit=True):
                st.caption("Novo Movimento")
                c_form_1, c_form_2 = st.columns(2)
                with c_form_1:
                    data_in = st.date_input("Data", datetime.today())
                    tipo = st.selectbox("Tipo", ["Saída", "Entrada"])
                    valor = st.number_input("Valor (R$)", min_value=0.01, step=10.0)
                with c_form_2:
                    desc = st.text_input("Descrição", placeholder="Ex: Mercado, Salário")
                    categoria = st.selectbox("Categoria", ["Moradia", "Alimentação", "Lazer", "Saúde", "Transporte", "Investimento", "Salário", "Outros"])
                    resp_input = st.selectbox("Responsável", ["Casal", "Luan", "Luana"])
                
                submitted = st.form_submit_button("💾 Salvar Registro", use_container_width=True)
                if submitted:
                    if not desc:
                        st.warning("Informe uma descrição.")
                    else:
                        entry = {"Data": data_in, "Descricao": desc, "Valor": valor, "Categoria": categoria, "Tipo": tipo, "Responsavel": resp_input}
                        if save_entry(entry, "Transacoes"):
                            st.success("Registrado!")
                            st.rerun()
            st.markdown('</div>', unsafe_allow_html=True)

    # 2. EXTRATO
    with tab_extract:
        df_p = kpis['df_t_period']
        if not df_p.empty:
            st.dataframe(
                df_p.sort_values("Data", ascending=False),
                use_container_width=True,
                hide_index=True,
                column_config={
                    "Data": st.column_config.DateColumn("Data", format="DD/MM"),
                    "Valor": st.column_config.NumberColumn("Valor", format="R$ %.2f"),
                    "Tipo": st.column_config.TextColumn("Tipo", width="small"),
                }
            )
        else:
            st.info(f"Sem movimentos em {selected_m_str}.")

    # 3. ANALYTICS
    with tab_analytics:
        # Spending Breakdown (Donut)
        if kpis['expenses_month'] > 0:
            df_exp = kpis['df_t_period'][
                (kpis['df_t_period']["Tipo"] == "Saída") & 
                (kpis['df_t_period']["Categoria"] != "Investimento")
            ]
            fig_pie = px.pie(df_exp, values="Valor", names="Categoria", hole=0.6, color_discrete_sequence=px.colors.sequential.Teal)
            fig_pie.update_layout(
                paper_bgcolor="rgba(0,0,0,0)", 
                plot_bgcolor="rgba(0,0,0,0)",
                showlegend=False,
                margin=dict(t=20, b=20, l=20, r=20),
                annotations=[dict(text=f"R$ {kpis['expenses_month']/1000:.1f}k", x=0.5, y=0.5, font_size=20, showarrow=False, font_color="white")]
            )
            st.markdown("##### 🍩 Distribuição de Gastos")
            st.plotly_chart(fig_pie, use_container_width=True)
        
        # Net Worth History (Area Spline)
        st.markdown("##### 📈 Curva de Patrimônio")
        df_all = kpis['df_t_all']
        if not df_all.empty:
            df_inv = df_all[(df_all["Tipo"] == "Saída") & (df_all["Categoria"] == "Investimento")].copy().sort_values("Data")
            if not df_inv.empty:
                df_inv["Acumulado"] = df_inv["Valor"].cumsum() + kpis['base_assets']
                fig_area = px.area(df_inv, x="Data", y="Acumulado")
                fig_area.update_layout(
                    paper_bgcolor="rgba(0,0,0,0)", 
                    plot_bgcolor="rgba(0,0,0,0)",
                    font=dict(color="#94a3b8"),
                    margin=dict(l=0, r=0, t=10, b=0),
                    xaxis=dict(showgrid=False),
                    yaxis=dict(showgrid=True, gridcolor="rgba(255,255,255,0.05)")
                )
                fig_area.update_traces(line_color="#3b82f6", fillcolor="rgba(59, 130, 246, 0.1)")
                st.plotly_chart(fig_area, use_container_width=True)

    # 4. AJUSTES
    with tab_settings:
        st.markdown("##### 🎯 Metas & Patrimônio Inicial")
        c_set_1, c_set_2 = st.columns(2)
        with c_set_1:
            new_meta = st.number_input(f"Meta Renda ({user_filter})", value=float(target_income))
            if st.button("Atualizar Meta"):
                save_config(meta_key, new_meta)
                st.rerun()
        
        with c_set_2:
            st.dataframe(df_assets, use_container_width=True, hide_index=True)
            
        with st.expander("➕ Adicionar Bem Durável"):
            with st.form("add_asset"):
                i_name = st.text_input("Nome do Bem")
                i_val = st.number_input("Valor Atual", min_value=0.0)
                i_resp = st.selectbox("Titular", ["Casal", "Luan", "Luana"])
                if st.form_submit_button("Adicionar"):
                    save_entry({"Item": i_name, "Valor": i_val, "Responsavel": i_resp}, "Patrimonio")
                    st.rerun()

if __name__ == "__main__":
    main()
