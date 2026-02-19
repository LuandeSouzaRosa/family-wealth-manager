from __future__ import annotations
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from streamlit_gsheets import GSheetsConnection
from datetime import datetime, timedelta, date
import calendar
import html as html_lib
from dataclasses import dataclass
from io import BytesIO
import time
import logging


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
    COLS_TRANSACAO: tuple = ("Data", "Descricao", "Valor", "Categoria", "Tipo", "Responsavel", "Origem")
    COLS_PATRIMONIO: tuple = ("Item", "Valor", "Responsavel")
    COLS_RECORRENTE: tuple = ("Descricao", "Valor", "Categoria", "Tipo", "Responsavel", "DiaVencimento", "Ativo")
    COLS_ORCAMENTO: tuple = ("Categoria", "Limite", "Responsavel")
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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ll_finance")

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

        /* ===== MOBILE (consolidado) ===== */
        @media (max-width: 768px) {
            .autonomia-number { font-size: 4rem; }
            .autonomia-hero { padding: 28px 16px 24px 16px; }
            .block-container { padding: 0.5rem 0.8rem !important; }
            .kpi-mono-value { font-size: 1.1rem; }
            .kpi-mono { padding: 10px 12px; margin-bottom: 4px; }
            .cat-bar-label { width: 70px; font-size: 0.6rem; }
            .cat-bar-value { width: 80px; font-size: 0.6rem; }
            .hist-summary { flex-direction: column; gap: 8px; font-size: 0.65rem; }
            .alert-item { font-size: 0.63rem; padding: 6px 10px; }
            .projection-main { font-size: 0.8rem; }
            .projection-box { padding: 12px; }
            .projection-labels { font-size: 0.58rem; }
            .budget-label { width: 70px; font-size: 0.6rem; }
            .budget-info { width: 140px; font-size: 0.6rem; }
            .budget-row { font-size: 0.63rem; }
            .budget-panel { padding: 10px 12px; }
            .score-panel { flex-direction: column; gap: 12px; }
            .score-value { font-size: 2rem; }
            .score-detail-label { width: 80px; font-size: 0.55rem; }
            .annual-strip { flex-direction: column; align-items: flex-start; gap: 8px; font-size: 0.6rem; }
            .annual-meta { margin-left: 0; width: 100%; }
            .annual-divider { display: none; }
            .intel-box { padding: 10px 12px; }
            .intel-body { font-size: 0.78rem; }
            .health-badge { font-size: 0.62rem; padding: 5px 10px; }
            .t-panel { padding: 14px; }
            .rec-card { font-size: 0.65rem; padding: 10px 12px; }
            .rec-card-left { min-width: 100px; }
            .rec-pending-count { font-size: 1.4rem; }
            .rec-pending-box { padding: 12px; }
            .stFormSubmitButton button {
                padding: 12px 16px !important;
                font-size: 0.75rem !important;
            }
            .stButton button {
                padding: 10px 14px !important;
            }
            .stTabs [data-baseweb="tab"] {
                font-size: 0.65rem;
                padding: 6px 10px 8px 10px;
                letter-spacing: 0.08em;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .autonomia-hero::after { animation: none; }
            .autonomia-hero { animation: none; }
            .autonomia-number { animation: none; }
        }

        /* ===== SCORE FINANCEIRO ===== */
        .score-panel {
            background: #0a0a0a;
            border: 1px solid #1a1a1a;
            border-radius: 0px;
            padding: 16px 20px;
            margin-bottom: 12px;
            display: flex;
            gap: 24px;
            align-items: center;
            flex-wrap: wrap;
            transition: border-color 0.3s ease;
        }
        .score-panel:hover { border-color: #00FFCC; }
        .score-left {
            text-align: center;
            min-width: 90px;
            flex-shrink: 0;
        }
        .score-label {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.55rem;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 0.25em;
            margin-bottom: 4px;
        }
        .score-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 2.5rem;
            font-weight: 700;
            line-height: 1.1;
        }
        .score-grade {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.65rem;
            letter-spacing: 0.1em;
            margin-top: 2px;
        }
        .score-right {
            flex: 1;
            min-width: 200px;
        }
        .score-detail-row {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.62rem;
        }
        .score-detail-label {
            width: 110px;
            color: #666;
            flex-shrink: 0;
        }
        .score-detail-track {
            flex: 1;
            height: 4px;
            background: #111;
            margin: 0 8px;
        }
        .score-detail-fill {
            height: 100%;
            transition: width 0.5s ease;
        }
        .score-detail-pts {
            width: 45px;
            color: #555;
            text-align: right;
            flex-shrink: 0;
        }

        /* ===== RESUMO ANUAL ===== */
        .annual-strip {
            display: flex;
            align-items: center;
            gap: 16px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.68rem;
            padding: 10px 16px;
            margin-bottom: 12px;
            border: 1px solid #1a1a1a;
            background: #0a0a0a;
            flex-wrap: wrap;
            transition: border-color 0.2s ease;
        }
        .annual-strip:hover { border-color: #00FFCC; }
        .annual-year {
            color: #00FFCC;
            font-weight: 700;
            font-size: 0.75rem;
            letter-spacing: 0.05em;
            flex-shrink: 0;
        }
        .annual-divider {
            width: 1px;
            height: 16px;
            background: #1a1a1a;
            flex-shrink: 0;
        }
        .annual-item {
            color: #888;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .annual-item strong {
            color: #F0F0F0;
        }
        .annual-meta {
            color: #444;
            font-size: 0.6rem;
            margin-left: auto;
        }

        /* ===== ORÇAMENTO ===== */
        .budget-row {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.7rem;
            padding: 6px 0;
        }
        .budget-label {
            width: 100px;
            color: #888;
            flex-shrink: 0;
        }
        .budget-track {
            flex: 1;
            height: 8px;
            background: #111;
            margin: 0 10px;
            position: relative;
        }
        .budget-fill {
            height: 100%;
            transition: width 0.4s ease;
            position: absolute;
            left: 0;
            top: 0;
        }
        .budget-limit-marker {
            position: absolute;
            top: -3px;
            width: 2px;
            height: 14px;
            background: #F0F0F0;
            opacity: 0.5;
        }
        .budget-info {
            width: 180px;
            color: #666;
            text-align: right;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
        }
        .budget-pct {
            font-weight: 700;
            min-width: 40px;
            text-align: right;
        }
        .budget-pct-ok { color: #00FFCC; }
        .budget-pct-warn { color: #FFAA00; }
        .budget-pct-over { color: #FF4444; }
        .budget-panel {
            background: #0a0a0a;
            border: 1px solid #1a1a1a;
            border-radius: 0px;
            padding: 14px 16px;
            margin-bottom: 12px;
            transition: border-color 0.2s ease;
        }
        .budget-panel:hover { border-color: #00FFCC; }
        .budget-header {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.6rem;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .budget-total {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.65rem;
            color: #444;
            padding-top: 8px;
            margin-top: 6px;
            border-top: 1px solid #111;
            display: flex;
            justify-content: space-between;
        }

        /* ===== RECORRENTES ===== */
        .rec-card {
            background: #0a0a0a;
            border: 1px solid #1a1a1a;
            border-left: 3px solid #FFAA00;
            padding: 12px 16px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.72rem;
            transition: border-color 0.2s ease, transform 0.15s ease;
            flex-wrap: wrap;
            gap: 8px;
        }
        .rec-card:hover {
            border-color: #00FFCC;
            transform: translateX(2px);
        }
        .rec-card-left {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 150px;
        }
        .rec-card-desc {
            color: #F0F0F0;
            font-weight: 600;
        }
        .rec-card-meta {
            color: #555;
            font-size: 0.6rem;
        }
        .rec-card-right {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .rec-card-valor {
            color: #F0F0F0;
            font-weight: 700;
        }
        .rec-card-badge {
            font-size: 0.55rem;
            padding: 2px 6px;
            letter-spacing: 0.05em;
        }
        .rec-badge-ativo {
            color: #00FFCC;
            border: 1px solid #00FFCC33;
        }
        .rec-badge-inativo {
            color: #555;
            border: 1px solid #333;
        }
        .rec-badge-entrada {
            color: #00FFCC;
            border: 1px solid #00FFCC22;
        }
        .rec-badge-saida {
            color: #FF4444;
            border: 1px solid #FF444422;
        }
        .rec-pending-box {
            background: #0a0a0a;
            border: 1px solid #FFAA00;
            padding: 16px;
            margin-bottom: 16px;
            text-align: center;
            font-family: 'JetBrains Mono', monospace;
        }
        .rec-pending-count {
            font-size: 1.8rem;
            font-weight: 700;
            color: #FFAA00;
            line-height: 1.2;
        }
        .rec-pending-label {
            font-size: 0.6rem;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            margin-top: 4px;
        }
        .rec-summary {
            display: flex;
            gap: 16px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.68rem;
            padding: 8px 0;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }
        .rec-summary-item {
            color: #888;
        }
        .rec-summary-item strong {
            color: #F0F0F0;
        }

        /* ===== EXPANDERS ===== */
        div[data-testid="stExpander"] {
            border: 1px solid #1a1a1a !important;
            border-radius: 0px !important;
            margin-bottom: 12px;
        }
        div[data-testid="stExpander"] details summary {
            font-family: 'JetBrains Mono', monospace !important;
            font-size: 0.75rem !important;
            letter-spacing: 0.05em;
        }
        div[data-testid="stExpander"] details summary:hover {
            color: #00FFCC !important;
        }
    </style>
    """, unsafe_allow_html=True)

# ==============================================================================
# 4. UTILITÁRIOS
# ==============================================================================

def sanitize(text: str) -> str:
    """Escapa HTML para prevenir injeção."""
    return html_lib.escape(str(text))


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
# 5. VALIDAÇÃO
# ==============================================================================

def validate_transaction(entry: dict) -> tuple[bool, str]:
    """Valida dados de uma transação antes de salvar."""
    # --- Descrição ---
    desc = entry.get("Descricao", "")
    if not desc or not str(desc).strip():
        return False, "Descrição obrigatória"
    if len(str(desc)) > CFG.MAX_DESC_LENGTH:
        return False, f"Descrição muito longa (máx {CFG.MAX_DESC_LENGTH})"

    # --- Valor ---
    val = entry.get("Valor")
    if not isinstance(val, (int, float)) or val <= 0:
        return False, "Valor deve ser maior que zero"

    # --- Tipo ---
    tipo = entry.get("Tipo")
    if tipo not in CFG.TIPOS:
        return False, "Tipo inválido"

    # --- Categoria [FIX B3] ---
    cat = entry.get("Categoria", "")
    if tipo == "Saída":
        cats_validas = set(CFG.CATEGORIAS_SAIDA) | {"Investimento"}
    else:
        cats_validas = set(CFG.CATEGORIAS_ENTRADA)
    if cat not in cats_validas:
        return False, f"Categoria '{cat}' inválida para tipo '{tipo}'"

    # --- Responsável ---
    if entry.get("Responsavel") not in CFG.RESPONSAVEIS:
        return False, "Responsável inválido"

    # --- Data [FIX B4] ---
    dt = entry.get("Data")
    if dt is not None:
        # Tratar NaT do pandas (vem do data_editor)
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
        # Não permite datas mais de 30 dias no futuro
        if dt_check > now + timedelta(days=30):
            return False, "Data muito distante no futuro"
        # Não permite datas antes de 2020
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
    if tipo == "Saída":
        cats_validas = set(CFG.CATEGORIAS_SAIDA) | {"Investimento"}
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


def check_duplicate(df_month: pd.DataFrame, desc: str, valor: float, data_ref) -> bool:
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


# ==============================================================================
# 6. CAMADA DE DADOS
# ==============================================================================

def get_conn() -> GSheetsConnection:
    """Retorna conexão com Google Sheets."""
    return st.connection("gsheets", type=GSheetsConnection)


def _normalize_strings(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """Normaliza strings de colunas categóricas."""
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
            df_trans = _normalize_strings(df_trans, ["Tipo", "Categoria", "Responsavel", "Descricao"])
            if "Origem" not in df_trans.columns:
                df_trans["Origem"] = "Manual"
            df_trans["Origem"] = df_trans["Origem"].fillna("Manual")
    except Exception as e:
        logger.error(f"load_data [Transacoes]: {e}")
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
            df_assets = _normalize_strings(df_assets, ["Item", "Responsavel"])
    except Exception as e:
        logger.error(f"load_data [Patrimonio]: {e}")
        df_assets = pd.DataFrame(columns=expected_pat)

    return df_trans, df_assets

def _parse_ativo(val) -> bool:
    """Converte valor para booleano (coluna Ativo)."""
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val)
    return str(val).strip().lower() in ("true", "1", "1.0", "sim", "s", "yes")


@st.cache_data(ttl=CFG.CACHE_TTL)
def load_recorrentes() -> pd.DataFrame:
    """Carrega transações recorrentes do Google Sheets."""
    conn = get_conn()
    expected = list(CFG.COLS_RECORRENTE)
    try:
        df = conn.read(worksheet="Recorrentes")
        df = df.dropna(how="all")
        missing = set(expected) - set(df.columns)
        for col in missing:
            df[col] = None
        if not df.empty:
            df["Valor"] = pd.to_numeric(df["Valor"], errors="coerce").fillna(0.0)
            df["DiaVencimento"] = pd.to_numeric(
                df["DiaVencimento"], errors="coerce"
            ).fillna(1).astype(int)
            df["Ativo"] = df["Ativo"].apply(_parse_ativo)
            df = _normalize_strings(df, ["Descricao", "Tipo", "Categoria", "Responsavel"])
    except Exception as e:
        logger.error(f"load_recorrentes: {e}")
        df = pd.DataFrame(columns=expected)
    return df

@st.cache_data(ttl=CFG.CACHE_TTL)
def load_orcamentos() -> pd.DataFrame:
    """Carrega orçamentos por categoria do Google Sheets."""
    conn = get_conn()
    expected = list(CFG.COLS_ORCAMENTO)
    try:
        df = conn.read(worksheet="Orcamentos")
        df = df.dropna(how="all")
        missing = set(expected) - set(df.columns)
        for col in missing:
            df[col] = None
        if not df.empty:
            df["Limite"] = pd.to_numeric(df["Limite"], errors="coerce").fillna(0.0)
            df = _normalize_strings(df, ["Categoria", "Responsavel"])
    except Exception as e:
        logger.error(f"load_orcamentos: {e}")
        df = pd.DataFrame(columns=expected)
    return df


def _serialize_for_sheet(df: pd.DataFrame) -> pd.DataFrame:
    """Serializa DataFrame para gravação na planilha."""
    df_out = df.copy()
    if "Data" in df_out.columns:
        df_out["Data"] = pd.to_datetime(
            df_out["Data"], errors="coerce"
        ).dt.strftime("%Y-%m-%d")
    if "Ativo" in df_out.columns:
        df_out["Ativo"] = df_out["Ativo"].apply(
            lambda x: "TRUE" if _parse_ativo(x) else "FALSE"
        )
    return df_out


def save_entry(data: dict, worksheet: str) -> bool:
    """Salva uma nova entrada na planilha com retry."""
    conn = get_conn()
    for attempt in range(CFG.SAVE_RETRIES):
        try:
            try:
                df_curr = conn.read(worksheet=worksheet)
                df_curr = df_curr.dropna(how="all")
            except Exception:
                df_curr = pd.DataFrame()
            df_new = pd.DataFrame([data])
            df_updated = pd.concat([df_curr, df_new], ignore_index=True)
            df_updated = _serialize_for_sheet(df_updated)
            conn.update(worksheet=worksheet, data=df_updated)
            st.cache_data.clear()
            logger.info(f"save_entry OK [{worksheet}]")
            return True
        except Exception as e:
            if attempt == CFG.SAVE_RETRIES - 1:
                logger.error(f"save_entry failed [{worksheet}]: {e}")
                st.error(f"Falha ao salvar após {CFG.SAVE_RETRIES} tentativas: {e}")
                st.cache_data.clear()
                return False
            time.sleep(0.5 * (attempt + 1))
    return False


def update_sheet(df_edited: pd.DataFrame, worksheet: str) -> bool:
    """Atualiza planilha inteira com DataFrame editado (com retry)."""
    conn = get_conn()
    for attempt in range(CFG.SAVE_RETRIES):
        try:
            df_to_save = _serialize_for_sheet(df_edited)
            conn.update(worksheet=worksheet, data=df_to_save)
            st.cache_data.clear()
            logger.info(f"update_sheet OK [{worksheet}]: {len(df_edited)} rows")
            return True
        except Exception as e:
            if attempt == CFG.SAVE_RETRIES - 1:
                logger.error(f"update_sheet failed [{worksheet}]: {e}")
                st.error(f"Erro ao atualizar após {CFG.SAVE_RETRIES} tentativas: {e}")
                st.cache_data.clear()
                return False
            time.sleep(0.5 * (attempt + 1))
    return False

# ==============================================================================
# 7. MOTOR ANALÍTICO
# ==============================================================================

def filter_by_user(df: pd.DataFrame, user_filter: str, include_shared: bool = False) -> pd.DataFrame:
    """Filtra DataFrame por responsável.

    include_shared=True inclui registros 'Casal' junto com o usuário individual.
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


def detect_pending_recorrentes(
    df_recorrentes: pd.DataFrame,
    df_trans: pd.DataFrame,
    user_filter: str,
    target_month: int,
    target_year: int,
) -> pd.DataFrame:
    """Detecta recorrentes ativas que ainda não foram geradas no mês.

    Compara recorrentes ativas vs transações com Origem='Recorrente'
    no mês/ano alvo, cruzando por Descricao + Categoria + Tipo.
    """
    if df_recorrentes.empty:
        return pd.DataFrame(columns=list(CFG.COLS_RECORRENTE))

    # Filtrar apenas ativas
    df_ativas = df_recorrentes[df_recorrentes["Ativo"].eq(True)].copy()
    if df_ativas.empty:
        return pd.DataFrame(columns=list(CFG.COLS_RECORRENTE))

    # Filtrar por responsável
    if user_filter != "Casal" and "Responsavel" in df_ativas.columns:
        df_ativas = df_ativas[df_ativas["Responsavel"] == user_filter].copy()

    if df_ativas.empty:
        return pd.DataFrame(columns=list(CFG.COLS_RECORRENTE))

    # Buscar transações recorrentes já geradas no mês
    df_t = filter_by_user(df_trans, user_filter)
    df_mo = filter_by_month(df_t, target_month, target_year) if not df_t.empty else pd.DataFrame()

    # Construir set de chaves incluindo Responsavel para evitar
    # falso positivo entre usuários com mesma descrição/categoria/tipo
    geradas_keys: set[tuple[str, str, str, str]] = set()
    if not df_mo.empty and "Origem" in df_mo.columns:
        df_geradas = df_mo[df_mo["Origem"] == "Recorrente"]
        for _, tr in df_geradas.iterrows():
            chave = (
                str(tr["Descricao"]).strip().lower(),
                str(tr["Categoria"]).strip(),
                str(tr["Tipo"]).strip(),
                str(tr["Responsavel"]).strip(),
            )
            geradas_keys.add(chave)

    # Identificar pendentes
    pendentes = []
    for _, rec in df_ativas.iterrows():
        chave_rec = (
            str(rec["Descricao"]).strip().lower(),
            str(rec["Categoria"]).strip(),
            str(rec["Tipo"]).strip(),
            str(rec["Responsavel"]).strip(),
        )
        if chave_rec not in geradas_keys:
            pendentes.append(rec)

    if not pendentes:
        return pd.DataFrame(columns=list(CFG.COLS_RECORRENTE))

    return pd.DataFrame(pendentes).reset_index(drop=True)


def compute_budget(
    df_orcamentos: pd.DataFrame,
    cat_breakdown: dict,
    user_filter: str,
) -> list[dict]:
    """Calcula status do orçamento por categoria.

    Retorna lista de dicts com categoria, limite, gasto, pct e status.
    """
    df_orc = filter_by_user(df_orcamentos, user_filter, include_shared=True)

    if df_orc.empty:
        return []

    results = []
    for _, row in df_orc.iterrows():
        cat = str(row.get("Categoria", "")).strip()
        limite = float(row.get("Limite", 0))
        if limite <= 0:
            continue

        gasto = cat_breakdown.get(cat, 0.0)
        pct = (gasto / limite) * 100 if limite > 0 else 0.0

        if pct >= 100:
            status = "over"
        elif pct >= 80:
            status = "warn"
        else:
            status = "ok"

        results.append({
            "categoria": cat,
            "limite": limite,
            "gasto": gasto,
            "pct": pct,
            "restante": max(0, limite - gasto),
            "excedente": max(0, gasto - limite),
            "status": status,
        })

    results.sort(key=lambda x: x["pct"], reverse=True)
    return results


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
            "Data": data_lancamento,
            "Descricao": str(rec["Descricao"]).strip(),
            "Valor": float(rec["Valor"]),
            "Categoria": str(rec["Categoria"]).strip(),
            "Tipo": str(rec["Tipo"]).strip(),
            "Responsavel": str(rec["Responsavel"]).strip(),
            "Origem": "Recorrente",
        }

        ok, err = validate_transaction(entry)
        if ok:
            if save_entry(entry, "Transacoes"):
                entries_ok += 1
                total_valor += float(rec["Valor"])
                if str(rec["Tipo"]).strip() == "Entrada":
                    n_entradas += 1
                else:
                    n_saidas += 1

    if entries_ok > 0:
        logger.info(f"generate_recorrentes: {entries_ok} geradas para {target_month}/{target_year}")
        return {
            "count": entries_ok,
            "entradas": n_entradas,
            "saidas": n_saidas,
            "total": total_valor,
        }
    return None

def compute_projection(
    mx: dict,
    sel_mo: int,
    sel_yr: int,
) -> dict | None:
    """Projeção linear de gastos para o fim do mês.

    Só calcula para o mês ATUAL (meses passados já encerraram).
    Retorna None se dados insuficientes.
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

    remaining_budget = max(0, mx["renda"] - mx["lifestyle"] - mx["investido_mes"])
    days_remaining = max(1, days_in_month - day_of_month)

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
        "remaining_budget": remaining_budget,
        "daily_budget": remaining_budget / days_remaining,
    }


def compute_alerts(
    mx: dict,
    sel_mo: int,
    sel_yr: int,
    projection: dict | None,
    n_pendentes: int = 0,
) -> list[dict]:
    """Engine de alertas inteligentes baseado em regras."""
    alerts: list[dict] = []
    now = datetime.now()
    is_current = (sel_mo == now.month and sel_yr == now.year)

    # --- Recorrentes pendentes ---
    if n_pendentes > 0:
        plural = "s" if n_pendentes > 1 else ""
        alerts.append({
            "level": "warn",
            "icon": "⟳",
            "msg": f"{n_pendentes} transação(ões) recorrente{plural} pendente{plural} — gere na aba FIXOS",
        })

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

    # --- Orçamento estourado ---
    budget_data = mx.get("budget_data", [])
    for b in budget_data:
        if b["status"] == "over":
            alerts.append({
                "level": "danger",
                "icon": "▮",
                "msg": (
                    f"{sanitize(b['categoria'])} estourou: "
                    f"{fmt_brl(b['gasto'])} / {fmt_brl(b['limite'])} "
                    f"(+{fmt_brl(b['excedente'])})"
                ),
            })
        elif b["status"] == "warn":
            alerts.append({
                "level": "warn",
                "icon": "▯",
                "msg": (
                    f"{sanitize(b['categoria'])} em {b['pct']:.0f}%: "
                    f"{fmt_brl(b['gasto'])} / {fmt_brl(b['limite'])} "
                    f"(resta {fmt_brl(b['restante'])})"
                ),
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
    df_a = filter_by_user(df_assets, user_filter, include_shared=True)

    # Garantir que 'Data' é datetime ANTES de filter_by_month
    if not df_t.empty and not pd.api.types.is_datetime64_any_dtype(df_t["Data"]):
        df_t["Data"] = pd.to_datetime(df_t["Data"], errors="coerce")
        df_t = df_t.dropna(subset=["Data"])

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
        "prev_renda": 0.0,
        "prev_lifestyle": 0.0,
        "prev_investido": 0.0,
        "prev_disponivel": 0.0,
        "top5_gastos": [],
        "ticket_medio": 0.0,
        "split_gastos": {},
        "split_renda": {},
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

    base_patrimonio = df_a["Valor"].sum() if not df_a.empty else 0.0
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

        # --- Top 5 Gastos ---
        top5_df = df_mo[
            (df_mo["Tipo"] == "Saída") &
            (df_mo["Categoria"] != "Investimento")
        ].nlargest(5, "Valor")
        m["top5_gastos"] = [
            {"desc": str(r["Descricao"]), "valor": float(r["Valor"]), "cat": str(r["Categoria"])}
            for _, r in top5_df.iterrows()
        ]

        # --- Split Casal ---
        if user_filter == "Casal":
            for resp_name in [r for r in CFG.RESPONSAVEIS if r != "Casal"]:
                resp_total = df_mo[
                    (df_mo["Tipo"] == "Saída") &
                    (df_mo["Categoria"] != "Investimento") &
                    (df_mo["Responsavel"] == resp_name)
                ]["Valor"].sum()
                if resp_total > 0:
                    m["split_gastos"][resp_name] = resp_total

            # --- Split Renda Casal ---
            for resp_name in [r for r in CFG.RESPONSAVEIS if r != "Casal"]:
                resp_renda = df_mo[
                    (df_mo["Tipo"] == "Entrada") &
                    (df_mo["Responsavel"] == resp_name)
                ]["Valor"].sum()
                if resp_renda > 0:
                    m["split_renda"][resp_name] = resp_renda

    # --- Ticket Médio ---
    m["ticket_medio"] = m["lifestyle"] / m["month_saidas"] if m["month_saidas"] > 0 else 0.0

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
        m["prev_renda"] = prev_renda
        m["prev_lifestyle"] = prev_lifestyle
        m["prev_investido"] = prev_investido
        m["prev_disponivel"] = prev_disponivel

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


def compute_score(mx: dict) -> dict:
    """Calcula score financeiro de 0-100 com breakdown."""
    details: list[tuple[str, float, int]] = []
    score = 0.0

    # 1. Aderência 50/30/20 (25 pts)
    if mx["renda"] > 0:
        avg_diff = (abs(mx["nec_delta"]) + abs(mx["des_delta"]) + abs(mx["inv_delta"])) / 3
        regra_pts = max(0.0, 25.0 - avg_diff)
        score += regra_pts
        details.append(("Regra 50/30/20", regra_pts, 25))
    else:
        details.append(("Regra 50/30/20", 0.0, 25))

    # 2. Taxa de Aporte (25 pts)
    if mx["renda"] > 0:
        aporte_pts = min(25.0, (mx["taxa_aporte"] / CFG.META_INVESTIMENTO) * 25)
        score += aporte_pts
        details.append(("Taxa de Aporte", aporte_pts, 25))
    else:
        details.append(("Taxa de Aporte", 0.0, 25))

    # 3. Autonomia (25 pts)
    autonomia = mx.get("autonomia", 0)
    if autonomia >= 999:
        auto_pts = 25.0
    else:
        auto_pts = min(25.0, (autonomia / CFG.AUTONOMIA_OK) * 25)
    score += auto_pts
    details.append(("Autonomia", auto_pts, 25))

    # 4. Saldo Mensal (25 pts)
    if mx["renda"] > 0:
        if mx["disponivel"] > 0:
            ratio = mx["disponivel"] / mx["renda"]
            saldo_pts = min(25.0, ratio * 100)
        else:
            saldo_pts = 0.0
        score += saldo_pts
        details.append(("Saldo Mensal", saldo_pts, 25))
    else:
        details.append(("Saldo Mensal", 0.0, 25))

    # Classificação
    score = min(100.0, max(0.0, score))
    if score >= 90:
        grade, color = "Excelente", "#00FFCC"
    elif score >= 70:
        grade, color = "Saudável", "#00FFCC"
    elif score >= 50:
        grade, color = "Atenção", "#FFAA00"
    else:
        grade, color = "Crítico", "#FF4444"

    return {
        "score": score,
        "grade": grade,
        "color": color,
        "details": details,
    }


def compute_annual_summary(
    df_trans: pd.DataFrame,
    user_filter: str,
    year: int,
) -> dict | None:
    """Calcula resumo anual para o strip compacto."""
    df = filter_by_user(df_trans, user_filter)
    if df.empty:
        return None

    df_year = df[df["Data"].dt.year == year]
    if df_year.empty:
        return None

    renda = df_year[df_year["Tipo"] == "Entrada"]["Valor"].sum()
    gastos = df_year[
        (df_year["Tipo"] == "Saída") &
        (df_year["Categoria"] != "Investimento")
    ]["Valor"].sum()
    investido = df_year[
        (df_year["Tipo"] == "Saída") &
        (df_year["Categoria"] == "Investimento")
    ]["Valor"].sum()
    saldo = renda - gastos - investido
    meses_ativos = df_year["Data"].dt.month.nunique()

    return {
        "year": year,
        "renda": renda,
        "gastos": gastos,
        "investido": investido,
        "saldo": saldo,
        "meses_ativos": meses_ativos,
        "media_gastos": gastos / max(1, meses_ativos),
        "media_renda": renda / max(1, meses_ativos),
        "taxa_aporte": (investido / renda * 100) if renda > 0 else 0.0,
    }


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


def compute_renda_evolution(
    df_trans: pd.DataFrame,
    user_filter: str,
    ref_month: int,
    ref_year: int,
    months_back: int = CFG.MESES_EVOLUCAO,
) -> list[dict]:
    """Calcula evolução mensal de renda com breakdown por fonte."""
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

    df_range = df[
        (df["Data"] >= start_date) &
        (df["Data"] <= ref_end) &
        (df["Tipo"] == "Entrada")
    ].copy()

    if df_range.empty:
        return []

    df_range["period"] = df_range["Data"].dt.to_period("M")

    pivot = df_range.pivot_table(
        values="Valor", index="period", columns="Categoria",
        aggfunc="sum", fill_value=0,
    )

    data = []
    for period in sorted(pivot.index):
        entry = {
            "label": f"{MESES_PT[period.month]}/{period.year}",
            "total": 0.0,
            "breakdown": {},
        }
        for cat in pivot.columns:
            val = float(pivot.loc[period, cat])
            if val > 0:
                entry["breakdown"][cat] = val
                entry["total"] += val
        data.append(entry)

    return data


# ==============================================================================
# 8. COMPONENTES VISUAIS
# ==============================================================================

def render_autonomia(val: float, sobrevivencia: float) -> None:
    """Renderiza hero de autonomia financeira."""
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
    """Renderiza mensagem de mês vazio com guia de ações."""
    st.markdown(f"""
    <div class="intel-box empty-month">
        <div class="intel-title">▮ Comece por aqui</div>
        <div class="intel-body">
            Nenhuma transação em <strong>{sanitize(month_label)}</strong>.<br><br>
            <strong>1.</strong> Registre sua renda na aba <strong>RENDA</strong><br>
            <strong>2.</strong> Cadastre gastos fixos na aba <strong>FIXOS</strong><br>
            <strong>3.</strong> Lance gastos pelo <strong>⚡ Lançamento Rápido</strong> acima<br>
            <strong>4.</strong> Acompanhe tudo no <strong>HISTÓRICO</strong>
        </div>
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

def render_prev_comparison(mx: dict, sel_mo: int, sel_yr: int) -> None:
    """Renderiza comparativo compacto com mês anterior."""
    has_prev = mx["prev_renda"] > 0 or mx["prev_lifestyle"] > 0 or mx["prev_investido"] > 0
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
        _row("Renda", mx["prev_renda"], mx["renda"], mx["d_renda"])
        + _row("Gastos", mx["prev_lifestyle"], mx["lifestyle"], mx["d_lifestyle"], invert=True)
        + _row("Investido", mx["prev_investido"], mx["investido_mes"], mx["d_investido"])
        + _row("Saldo", mx["prev_disponivel"], mx["disponivel"], mx["d_disponivel"])
    )

    html = (
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ vs Mês Anterior</div>'
        f'{header}{rows}'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_aporte_meta(mx: dict) -> None:
    """Renderiza barra de progresso da meta de investimento."""
    if mx["renda"] <= 0:
        return
    meta_valor = mx["renda"] * (CFG.META_INVESTIMENTO / 100)
    investido = mx["investido_mes"]
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
        f'<span>Meta Aporte ({CFG.META_INVESTIMENTO}%): {fmt_brl(meta_valor)}</span>'
        f'<span style="color:{color};">{pct:.0f}% — {status}</span>'
        f'</div>'
        f'<div style="width:100%;height:4px;background:#111;">'
        f'<div style="width:{fill_pct}%;height:100%;background:{color};'
        f'transition:width 0.4s ease;"></div>'
        f'</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_top_gastos(top5: list[dict], ticket_medio: float, split: dict) -> None:
    """Renderiza top 5 gastos + ticket médio + split casal."""
    if not top5 and ticket_medio <= 0 and not split:
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

def render_renda_chart(renda_data: list[dict]) -> None:
    """Gráfico de evolução de renda com breakdown por fonte."""
    if not renda_data:
        render_intel("Evolução de Renda", "Dados insuficientes para gráfico.")
        return

    labels = [d["label"] for d in renda_data]

    all_cats: set[str] = set()
    for d in renda_data:
        all_cats.update(d["breakdown"].keys())

    cat_colors = {
        "Salário": "#00FFCC",
        "Dividendos": "#FFAA00",
        "Bônus": "#F0F0F0",
        "Extra": "#888888",
        "Reembolso": "#555555",
    }

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

    fig.update_layout(
        barmode="stack",
        paper_bgcolor="#000000",
        plot_bgcolor="#000000",
        font=dict(family="JetBrains Mono, monospace", color="#888", size=11),
        legend=dict(
            orientation="h", yanchor="bottom", y=1.02,
            xanchor="center", x=0.5, font=dict(size=9),
        ),
        margin=dict(l=0, r=0, t=30, b=0),
        height=280,
        xaxis=dict(gridcolor="#111", showline=False),
        yaxis=dict(gridcolor="#111", showline=False, tickformat=",.0f"),
    )
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

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


# ==============================================================================
# 9. FORMULÁRIOS
# ==============================================================================

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
        if st.form_submit_button(submit_label):
            entry = {
                "Data": d, "Descricao": desc.strip(), "Valor": val,
                "Categoria": cat, "Tipo": tipo, "Responsavel": resp,
                "Origem": "Manual",
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
        if st.form_submit_button("CONFIRMAR APORTE"):
            entry = {
                "Data": d, "Descricao": desc.strip(), "Valor": val,
                "Categoria": "Investimento", "Tipo": "Saída", "Responsavel": resp,
                "Origem": "Manual",
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
        if tipo == "Saída":
            cat_options = list(CFG.CATEGORIAS_SAIDA) + ["Investimento"]
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
    mx: dict,
    user: str,  # [FIX B2] Removido df_trans_full (não era usado)
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

    search = st.text_input(
        "🔍 Buscar",
        placeholder="Filtrar visualização por descrição, categoria...",
        label_visibility="collapsed",
        key=f"hist_search_{user}_{sel_mo}_{sel_yr}",
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
                        edited["Origem"] = edited["Origem"].fillna("Manual")
                    else:
                        edited["Origem"] = "Manual"

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
    """Salva edições do histórico mensal na planilha completa."""
    st.cache_data.clear()
    time.sleep(0.3)  # Delay para consistência com GSheets
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
# 11. EDIÇÃO SEGURA
# ==============================================================================

def _save_filtered_sheet(
    df_full: pd.DataFrame,
    df_edited: pd.DataFrame,
    user: str,
    worksheet: str,
) -> bool:
    """Salva edição filtrada preservando registros de outros usuários."""
    if user != "Casal":
        df_others = df_full[
            ~df_full["Responsavel"].isin([user, "Casal"])
        ].copy()
        df_final = pd.concat([df_others, df_edited], ignore_index=True)
    else:
        df_final = df_edited.copy()
    return update_sheet(df_final, worksheet)


# ==============================================================================
# 12. APLICAÇÃO PRINCIPAL
# ==============================================================================

def main() -> None:
    inject_css()

    now = datetime.now()

    # --- Barra de Controle ---
    c_filter, _, c_status = st.columns([1, 2, 1])
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
            f'<div class="status-line">L&L TERMINAL v6.0 — {fmt_date(now)}</div>',
            unsafe_allow_html=True
        )

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

    # --- Carregar Dados e Métricas ---
    df_trans, df_assets = load_data()
    mx = compute_metrics(df_trans, df_assets, user, sel_mo, sel_yr)

    # --- Projeção (só mês atual) ---
    projection = compute_projection(mx, sel_mo, sel_yr)

    # --- Recorrentes ---
    df_recorrentes = load_recorrentes()
    pendentes = detect_pending_recorrentes(df_recorrentes, df_trans, user, sel_mo, sel_yr)

    # --- Orçamento ---
    df_orcamentos = load_orcamentos()
    budget_data = compute_budget(df_orcamentos, mx["cat_breakdown"], user)
    mx["budget_data"] = budget_data

    # --- Alertas ---
    alerts = compute_alerts(mx, sel_mo, sel_yr, projection, n_pendentes=len(pendentes))

    # --- Score Financeiro ---
    score_data = compute_score(mx)

    # --- Resumo Anual ---
    annual = compute_annual_summary(df_trans, user, sel_yr)

    month_label = fmt_month_year(sel_mo, sel_yr)
    has_data = mx["renda"] > 0 or mx["lifestyle"] > 0 or mx["investido_mes"] > 0

    # ===== HERO =====
    render_autonomia(mx["autonomia"], mx["sobrevivencia"])

    # ===== HEALTH + ALERTAS =====
    render_health_badge(mx["health"], month_label, mx["month_tx_count"])
    render_alerts(alerts)

    # ===== BANNER RECORRENTES PENDENTES =====
    render_pending_banner(pendentes, user, sel_mo, sel_yr)

    if not has_data:
        render_empty_month(month_label)
    else:
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
                "Reserva Total", fmt_brl(mx["sobrevivencia"]),
                "Patrimônio acumulado"
            )

        # ===== META DE APORTE =====
        render_aporte_meta(mx)

        # ===== ANÁLISE DETALHADA (colapsável) =====
        with st.expander("📊 Análise Detalhada", expanded=False):
            render_score(score_data)
            if user == "Casal":
                render_split_casal(mx.get("split_gastos", {}), mx.get("split_renda", {}))
            render_regra_503020(mx)
            render_prev_comparison(mx, sel_mo, sel_yr)
            render_annual_strip(annual)

    # ===== LANÇAMENTO RÁPIDO =====
    with st.expander("⚡ Lançamento Rápido"):
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
                q_cat = st.selectbox("Categoria", list(CFG.CATEGORIAS_SAIDA))
            with qc4:
                q_min = date(sel_yr, sel_mo, 1)
                q_max = date(sel_yr, sel_mo, calendar.monthrange(sel_yr, sel_mo)[1])
                q_date = st.date_input(
                    "Data", default_form_date(sel_mo, sel_yr),
                    min_value=q_min, max_value=q_max, format="DD/MM/YYYY"
                )
            qc5, _ = st.columns(2)
            with qc5:
                q_resp_opts = list(CFG.RESPONSAVEIS)
                q_resp_idx = q_resp_opts.index(user) if user in q_resp_opts else 0
                q_resp = st.selectbox("Responsável", q_resp_opts, index=q_resp_idx)
            if st.form_submit_button("REGISTRAR GASTO", use_container_width=True):
                entry = {
                    "Data": q_date,
                    "Descricao": q_desc.strip(),
                    "Valor": q_val,
                    "Categoria": q_cat,
                    "Tipo": "Saída",
                    "Responsavel": q_resp,
                    "Origem": "Manual",
                }
                ok, err = validate_transaction(entry)
                if not ok:
                    st.toast(f"⚠ {err}")
                else:
                    is_dup = check_duplicate(mx["df_month"], q_desc.strip(), q_val, q_date)
                    if save_entry(entry, "Transacoes"):
                        if is_dup:
                            st.toast(f"⚠ Possível duplicata: {q_desc.strip()} — {fmt_brl(q_val)}")
                        else:
                            st.toast(f"✓ {q_desc.strip()} — {fmt_brl(q_val)}")
                        st.rerun()

    # ===== ABAS =====
    tab_ls, tab_renda, tab_pat, tab_rec, tab_hist = st.tabs([
        "GASTOS", "RENDA", "PATRIMÔNIO", "FIXOS", "HISTÓRICO"
    ])

    with tab_ls:
        col_form, col_intel = st.columns([1, 1])
        with col_form:
            render_intel(
                "Consumo Mensal",
                f"Total: <strong>{fmt_brl(mx['lifestyle'])}</strong>"
            )
            if budget_data:
                render_budget_bars(budget_data)
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
                default_resp=user,
                df_month=mx["df_month"],
            )
            render_recent_context(mx["df_month"], "Saída")
        with col_intel:
            render_intel("Intel — Gastos", mx["insight_ls"])
            evo_data = compute_evolution(df_trans, user, sel_mo, sel_yr)
            render_evolution_chart(evo_data)

            # --- Radiografia ---
            render_top_gastos(
                mx.get("top5_gastos", []),
                mx.get("ticket_medio", 0),
                mx.get("split_gastos", {}),
            )

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
                default_resp=user,
                df_month=mx["df_month"],
            )
            render_recent_context(mx["df_month"], "Entrada")
        with col_intel:
            render_intel("Intel — Renda", mx["insight_renda"])
            renda_evo = compute_renda_evolution(df_trans, user, sel_mo, sel_yr)
            render_renda_chart(renda_evo)
            if mx["renda_breakdown"] and len(mx["renda_breakdown"]) > 1:
                principal = list(mx["renda_breakdown"].keys())[0]
                principal_val = list(mx["renda_breakdown"].values())[0]
                principal_pct = (principal_val / mx["renda"] * 100) if mx["renda"] > 0 else 0
                render_intel(
                    "Composição",
                    f"{len(mx['renda_breakdown'])} fontes de renda · "
                    f"Principal: <strong>{sanitize(principal)}</strong> ({principal_pct:.0f}%)"
                )

    with tab_pat:
        df_assets_view = filter_by_user(df_assets, user, include_shared=True)
        total_pat = df_assets_view["Valor"].sum() if not df_assets_view.empty else 0

        render_intel(
            "Patrimônio & Investimentos",
            f"Reserva Total: <strong>{fmt_brl(mx['sobrevivencia'])}</strong> · "
            f"Autonomia: <strong>{mx['autonomia']:.1f} meses</strong><br>"
            f"Investido (mês): <strong>{fmt_brl(mx['investido_mes'])}</strong> · "
            f"Acumulado: <strong>{fmt_brl(mx['investido_total'])}</strong> · "
            f"Base patrimonial: <strong>{fmt_brl(total_pat)}</strong>"
        )

        col_left, col_right = st.columns([1, 1])

        with col_left:
            render_intel(
                "📥 Registrar Aporte",
                "Investimentos, aportes mensais, compras de ativos"
            )
            wealth_form(sel_mo=sel_mo, sel_yr=sel_yr, default_resp=user, df_month=mx["df_month"])

            # Contexto: últimos aportes do mês
            df_inv_ctx = mx["df_month"][
                (mx["df_month"]["Tipo"] == "Saída") &
                (mx["df_month"]["Categoria"] == "Investimento")
            ] if not mx["df_month"].empty else pd.DataFrame()
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

        with col_right:
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
                    tipo_cls = "rec-badge-saida" if rec["Tipo"] == "Saída" else "rec-badge-entrada"
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
                    mask_ativo & (df_rec_view["Tipo"] == "Saída")
                ]["Valor"].sum()
                total_entradas_fix = df_rec_view[
                    mask_ativo & (df_rec_view["Tipo"] == "Entrada")
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

    with tab_hist:
        # [FIX B2] Removido df_trans da chamada
        _render_historico(mx, user, sel_mo, sel_yr)


# ==============================================================================
# BOOT
# ==============================================================================

if __name__ == "__main__":
    main()