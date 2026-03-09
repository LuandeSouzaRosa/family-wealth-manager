"""Modelos de dados (dataclasses) do Family Wealth Manager.

Extraído do monolito app_homolog.py — MonthMetrics.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import pandas as pd

from core.config import UserConfig


@dataclass
class MonthMetrics:
    """Métricas financeiras computadas para um mês/usuário."""
    # --- Core ---
    renda: float = 0.0
    lifestyle: float = 0.0
    investido_mes: float = 0.0
    disponivel: float = 0.0
    sobrevivencia: float = 0.0
    investido_total: float = 0.0
    taxa_aporte: float = 0.0
    autonomia: float = 0.0

    # --- Regra 50/30/20 ---
    nec_pct: float = 0.0
    des_pct: float = 0.0
    inv_pct: float = 0.0
    nec_delta: float = 0.0
    des_delta: float = 0.0
    inv_delta: float = 0.0

    # --- Top gastos ---
    top_cat: str = "—"
    top_cat_val: float = 0.0
    top_gasto_desc: str = "—"
    top_gasto_val: float = 0.0
    top5_gastos: list = field(default_factory=list)
    ticket_medio: float = 0.0
    dia_mais_caro: int = 0
    dia_mais_caro_val: float = 0.0
    dia_mais_caro_count: int = 0

    # --- DataFrames ---
    df_user: pd.DataFrame = field(default_factory=pd.DataFrame)
    df_month: pd.DataFrame = field(default_factory=pd.DataFrame)

    # --- Insights ---
    insight_ls: str = ""
    insight_renda: str = ""

    # --- Deltas ---
    d_renda: float | None = None
    d_lifestyle: float | None = None
    d_investido: float | None = None
    d_disponivel: float | None = None
    prev_renda: float = 0.0
    prev_lifestyle: float = 0.0
    prev_investido: float = 0.0
    prev_disponivel: float = 0.0

    # --- Breakdowns ---
    cat_breakdown: dict = field(default_factory=dict)
    renda_breakdown: dict = field(default_factory=dict)
    split_gastos: dict = field(default_factory=dict)
    split_renda: dict = field(default_factory=dict)

    # --- Contadores ---
    month_tx_count: int = 0
    month_entradas: int = 0
    month_saidas: int = 0
    month_investimentos: int = 0

    # --- Status ---
    health: str = "neutral"
    budget_data: list = field(default_factory=list)
    user_config: UserConfig = field(default_factory=UserConfig)
