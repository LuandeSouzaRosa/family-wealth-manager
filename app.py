import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from streamlit_gsheets import GSheetsConnection
from datetime import datetime, timedelta

# ==============================================================================
# 1. CONFIGURATION & ZEN DESIGN SYSTEM
# ==============================================================================
st.set_page_config(
    page_title="Zen Family Office",
    page_icon="🦅",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Zen Premium Dark CSS
def local_css():
    st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
        
        /* Base Variables */
        :root {
            --bg-color: #0f172a; /* Slate 900 */
            --glass-bg: rgba(30, 41, 59, 0.4); /* Ultra-subtle glass */
            --glass-border: 1px solid rgba(255, 255, 255, 0.05);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-primary: #3b82f6; 
            --accent-wealth: #8b5cf6; /* Violet for Wealth */
            --accent-income: #10b981; /* Emerald for Income */
            --accent-lifestyle: #f43f5e; /* Rose for Lifestyle */
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
            background: radial-gradient(circle at 50% 10%, #1e293b, #0f172a);
        }

        /* Helpers */
        .block-container {
            padding-top: 2rem !important; 
            max-width: 1200px;
        }

        /* Glass Cards */
        .glass-card {
            background: var(--glass-bg);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: var(--glass-border);
            border-radius: var(--radius-lg);
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        /* KPI Style */
        .kpi-label {
            font-size: 0.8rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 6px;
        }
        .kpi-value {
            font-size: 1.8rem;
            font-weight: 700;
            color: #fff;
        }
        .kpi-sub {
            font-size: 0.8rem;
            color: var(--text-secondary);
            margin-top: 4px;
        }

        /* Input Styling */
        .stTextInput input, .stNumberInput input, .stSelectbox, .stDateInput input {
            background-color: rgba(15, 23, 42, 0.6) !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
            color: white !important;
            border-radius: var(--radius-md) !important;
        }
        
        /* Tabs */
        .stTabs [data-baseweb="tab-list"] {
            background-color: transparent;
            gap: 24px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            margin-bottom: 30px;
        }
        .stTabs [data-baseweb="tab"] {
            background: transparent;
            color: var(--text-secondary);
            font-weight: 600;
            font-size: 1rem;
            border: none;
            padding-bottom: 12px;
        }
        .stTabs [data-baseweb="tab"][aria-selected="true"] {
            color: white;
            border-bottom: 2px solid var(--accent-primary);
        }
        
        /* Custom Button Gradients */
        .btn-lifestyle button { background: linear-gradient(135deg, #f43f5e, #e11d48) !important; border:none; color:white; }
        .btn-income button { background: linear-gradient(135deg, #10b981, #059669) !important; border:none; color:white; }
        .btn-wealth button { background: linear-gradient(135deg, #8b5cf6, #7c3aed) !important; border:none; color:white; }

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
        # Ensure ISO Date
        if "Data" in df_updated.columns:
            df_updated["Data"] = pd.to_datetime(df_updated["Data"]).dt.strftime("%Y-%m-%d")
            
        conn.update(worksheet=worksheet, data=df_updated)
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Erro ao salvar: {e}")
        return False

def update_data_editor(df_edited, worksheet):
    conn = get_conn()
    try:
        if "Data" in df_edited.columns:
            df_edited["Data"] = pd.to_datetime(df_edited["Data"]).dt.strftime("%Y-%m-%d")
        conn.update(worksheet=worksheet, data=df_edited)
        st.cache_data.clear()
        return True
    except Exception as e:
        st.error(f"Save Error: {e}")
        return False

# ==============================================================================
# 3. ZEN ANALYTICS ENGINE
# ==============================================================================
def calculate_zen_kpis(df_trans, df_assets, responsible_filter):
    # Filter Responsibility
    if responsible_filter != "Casal":
        df_t = df_trans[df_trans["Responsavel"] == responsible_filter].copy() if "Responsavel" in df_trans.columns else df_trans
        df_a = df_assets[df_assets["Responsavel"] == responsible_filter].copy() if "Responsavel" in df_assets.columns else df_assets
    else:
        df_t = df_trans.copy()
        df_a = df_assets.copy()

    # 1. Total Income (Renda)
    total_income = df_t[df_t["Tipo"] == "Entrada"]["Valor"].sum()
    
    # 2. Total Lifestyle (Gastos de Consumo)
    # Exclude "Investimento" from Style expenses
    total_lifestyle = df_t[
        (df_t["Tipo"] == "Saída") & 
        (df_t["Categoria"] != "Investimento")
    ]["Valor"].sum()
    
    # 3. Total Wealth Contributions (Aportes)
    total_invested = df_t[
        (df_t["Tipo"] == "Saída") & 
        (df_t["Categoria"] == "Investimento")
    ]["Valor"].sum()
    
    # 4. Disponível Real (Cash Flow Available)
    # Income - Lifestyle - Investments (Investments assume cash leaving the 'available' bucket)
    real_available = total_income - total_lifestyle - total_invested
    
    # 5. Net Worth (Patrimonio)
    # Static Assets + Cumulative Investments
    initial_assets = df_a["Valor"].sum()
    net_worth = initial_assets + total_invested
    
    # 6. Savings Rate
    # (Invested / Income) * 100
    savings_rate = (total_invested / total_income * 100) if total_income > 0 else 0.0

    return {
        "real_available": real_available,
        "total_invested": total_invested,
        "net_worth": net_worth,
        "savings_rate": savings_rate,
        "total_income": total_income,
        "total_lifestyle": total_lifestyle,
        "df_filtered": df_t
    }

# ==============================================================================
# 4. COMPONENT RENDERING
# ==============================================================================
def render_kpi(label, value, sub=None, color=None):
    col_style = f"color: {color};" if color else ""
    st.markdown(f"""
    <div class="glass-card" style="padding: 20px; text-align: left;">
        <div class="kpi-label">{label}</div>
        <div class="kpi-value" style="{col_style}">{value}</div>
        <div class="kpi-sub">{sub if sub else '&nbsp;'}</div>
    </div>
    """, unsafe_allow_html=True)

def main():
    # --- Top Nav ---
    c_nav, c_spacer = st.columns([1, 2])
    with c_nav:
        try:
            user_filter = st.pills("Perfil", ["Casal", "Luan", "Luana"], default="Casal")
        except:
            user_filter = st.radio("Perfil", ["Casal", "Luan", "Luana"], horizontal=True)
            
    if not user_filter: user_filter = "Casal"
    
    # Load & Calc
    df_trans, df_assets = load_data()
    kpis = calculate_zen_kpis(df_trans, df_assets, user_filter)

    # --- Dashboard Overview ---
    c1, c2, c3, c4 = st.columns(4, gap="medium")
    with c1:
        render_kpi("Disponível Real", f"R$ {kpis['real_available']:,.2f}", "Fluxo Livre", "#3b82f6")
    with c2:
        render_kpi("Investido Total", f"R$ {kpis['total_invested']:,.2f}", "Aportes Acumulados", "#8b5cf6")
    with c3:
        render_kpi("Net Worth", f"R$ {kpis['net_worth']/1000:.1f}k", "Patrimônio Global", "#fff")
    with c4:
        render_kpi("Savings Rate", f"{kpis['savings_rate']:.1f}%", f"Lifestyle: R$ {kpis['total_lifestyle']/1000:.1f}k", "#10b981")

    st.markdown("---")

    # --- Zen Tabs ---
    tab_lifestyle, tab_income, tab_wealth, tab_history = st.tabs([
        "💸 Lifestyle", "💰 Renda", "📈 Wealth", "📜 Histórico"
    ])

    # 1. LIFESTYLE (GASTOS)
    with tab_lifestyle:
        c_form, c_info = st.columns([1, 1])
        with c_form:
            st.markdown('<div class="glass-card btn-lifestyle">', unsafe_allow_html=True)
            st.subheader("Registrar Consumo")
            with st.form("form_lifestyle", clear_on_submit=True):
                date_in = st.date_input("Data", datetime.now())
                desc = st.text_input("Descrição", placeholder="Ex: Jantar, Uber, Mercado")
                val = st.number_input("Valor (R$)", min_value=0.01, step=10.0)
                # Whitelisted Categories
                cat = st.selectbox("Categoria", [
                    "Moradia", "Alimentação", "Lazer", "Saúde", "Transporte", "Assinaturas", "Outros"
                ])
                resp = st.selectbox("Responsável", ["Casal", "Luan", "Luana"])
                
                if st.form_submit_button("💸 Registrar Saída"):
                    if not desc:
                        st.toast("⚠️ Descrição obrigatória")
                    else:
                        payload = {
                            "Data": date_in, "Descricao": desc, "Valor": val,
                            "Categoria": cat, "Tipo": "Saída", "Responsavel": resp
                        }
                        if save_entry(payload, "Transacoes"):
                            st.toast("✅ Gasto registrado!")
                            st.rerun()
            st.markdown('</div>', unsafe_allow_html=True)
            
        with c_info:
            st.info("💡 **Lifestyle**: Gastos de consumo que não geram retorno financeiro. Mantenha sob controle para aumentar sua Savings Rate.")

    # 2. RENDA (ENTRADAS)
    with tab_income:
        c_form, c_info = st.columns([1, 1])
        with c_form:
            st.markdown('<div class="glass-card btn-income">', unsafe_allow_html=True)
            st.subheader("Registrar Entrada")
            with st.form("form_income", clear_on_submit=True):
                date_in = st.date_input("Data", datetime.now())
                desc = st.text_input("Fonte", placeholder="Ex: Salário, Freelance")
                val = st.number_input("Valor (R$)", min_value=0.01, step=100.0)
                cat = st.selectbox("Categoria", ["Salário", "Dividendos", "Bônus", "Extra", "Reembolso"])
                resp = st.selectbox("Titular", ["Luan", "Luana", "Casal"])
                
                if st.form_submit_button("💰 Registrar Renda"):
                    if not desc:
                        st.toast("⚠️ Fonte obrigatória")
                    else:
                        payload = {
                            "Data": date_in, "Descricao": desc, "Valor": val,
                            "Categoria": cat, "Tipo": "Entrada", "Responsavel": resp
                        }
                        if save_entry(payload, "Transacoes"):
                            st.toast("✅ Entrada registrada!")
                            st.rerun()
            st.markdown('</div>', unsafe_allow_html=True)

    # 3. WEALTH (INVESTIMENTOS)
    with tab_wealth:
        c_form, c_info = st.columns([1, 1])
        with c_form:
            st.markdown('<div class="glass-card btn-wealth">', unsafe_allow_html=True)
            st.subheader("Registrar Aporte")
            with st.form("form_wealth", clear_on_submit=True):
                date_in = st.date_input("Data", datetime.now())
                desc = st.text_input("Ativo / Corretora", placeholder="Ex: IVVB11, Bitcoin, CDB")
                val = st.number_input("Valor Aportado (R$)", min_value=0.01, step=100.0)
                resp = st.selectbox("Titular", ["Casal", "Luan", "Luana"])
                
                if st.form_submit_button("📈 Confirmar Aporte"):
                    if not desc:
                        st.toast("⚠️ Descrição obrigatória")
                    else:
                        # Force Category = Investimento, Type = Saída
                        payload = {
                            "Data": date_in, "Descricao": desc, "Valor": val,
                            "Categoria": "Investimento", "Tipo": "Saída", "Responsavel": resp
                        }
                        if save_entry(payload, "Transacoes"):
                            st.toast("✅ Aporte registrado! Net Worth atualizado.")
                            st.rerun()
            st.markdown('</div>', unsafe_allow_html=True)
            
        with c_info:
            st.info("🚀 **Wealth**: Dinheiro que sai do 'Disponível' mas permanece no seu Patrimônio. Aumenta seu Net Worth.")

    # 4. HISTÓRICO (DATA EDITOR)
    with tab_history:
        st.subheader("📜 Livro Razão")
        
        # Filter by Date Range
        try:
            df_hist = kpis['df_filtered'].sort_values("Data", ascending=False)
            
            edited_df = st.data_editor(
                df_hist,
                use_container_width=True,
                num_rows="dynamic",
                column_config={
                    "Data": st.column_config.DateColumn("Data", format="DD/MM/YYYY"),
                    "Valor": st.column_config.NumberColumn("Valor", format="R$ %.2f"),
                    "Tipo": st.column_config.SelectboxColumn("Tipo", options=["Entrada", "Saída"]),
                    "Categoria": st.column_config.SelectboxColumn("Categoria", options=[
                        "Moradia", "Alimentação", "Lazer", "Saúde", "Transporte", 
                        "Investimento", "Salário", "Outros", "Assinaturas"
                    ]),
                },
                hide_index=True
            )
            
            # Save Changes Button
            if st.button("💾 Salvar Alterações no Histórico"):
                # We need to update the GSheet with this new dataframe
                # Note: This replaces the filtered view data into the main sheet. 
                # In a real production app with massive data, we'd handle ID-based updates.
                # For this scale, replacing the dataset (or appending limits) is okay but risky if multi-user.
                # Here we will assume the user knows what they are doing with the filter active.
                # Ideally, we reload all data, update the matching rows, and save back.
                # For simplicity in this specific request (Streamlit + GSheets generic):
                
                # Check for differences
                if not df_hist.equals(edited_df):
                    # In this specific simple implementation, we might just re-save the whole 'Transacoes' 
                    # if the filter was 'Casal' (which implies all data). 
                    # If filter was specific, we can't easily merge back without IDs.
                    # FORCE SAFEGUARD: Only allow full save if filter is Casal (All Data view roughly)
                    if user_filter == "Casal":
                        if update_data_editor(edited_df, "Transacoes"):
                            st.success("Histórico atualizado com sucesso!")
                            st.rerun()
                    else:
                        st.warning("⚠️ Para editar o histórico completo e salvar, mude o perfil para 'Casal'.")
        except Exception as e:
            st.error(f"Erro ao carregar histórico: {e}")

if __name__ == "__main__":
    main()
