"""Componentes Visuais — Funções de renderização UI.

Extraído de app_homolog.py (Fase 6). Todas as funções render_*
geram HTML via st.markdown(). Dependem de Streamlit.
"""
from __future__ import annotations

import time
from datetime import datetime

import pandas as pd
import streamlit as st
import plotly.graph_objects as go

from core.config import Config, CFG, UserConfig, MESES_PT, MESES_FULL
from core.models import MonthMetrics
from core.utils import sanitize, fmt_brl, fmt_month_year, generate_monthly_report, validate_transaction
from core.engine import filter_by_user, filter_by_month, _sparkline_html, compute_score
from io import BytesIO
import logging

logger = logging.getLogger(__name__)


def _chart_colors() -> dict:
    """Retorna cores de background/grid para gráficos Plotly baseado no tema ativo."""
    is_light = st.session_state.get("theme") == "light"
    return {
        "paper_bg": "#FAFAFA" if is_light else "#000000",
        "plot_bg": "#FAFAFA" if is_light else "#000000",
        "grid": "#E0E0E0" if is_light else "#111",
        "font_color": "#555" if is_light else "#888",
    }



def render_autonomia(val: float, sobrevivencia: float, user_config: UserConfig | None = None) -> None:
    """Renderiza hero de autonomia financeira."""
    ucfg = user_config or UserConfig()
    if val >= 999:
        display_text = "∞"
        color = "#00FFCC"
    else:
        display_text = f"{min(val, 999):.1f}"
        if val >= ucfg.autonomia_alvo:
            color = "#00FFCC"
        elif val >= ucfg.autonomia_warn:
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


def render_projection(proj: dict | None, mx: MonthMetrics) -> None:
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
    if mx.renda > 0:
        remaining = mx.renda - proj["projected_lifestyle"]
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
            <span>Gasto: {fmt_brl(mx.lifestyle)}</span>
            <span style="color:{proj_color};">→ {fmt_brl(proj['projected_lifestyle'])}</span>
            <span>Renda: {fmt_brl(mx.renda)}</span>
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


def render_regra_503020(mx: MonthMetrics) -> None:
    """Renderiza barra e badges da regra 50/30/20."""
    total = mx.nec_pct + mx.des_pct + mx.inv_pct
    if total == 0:
        n_w, d_w, i_w = 33, 33, 34
    else:
        n_w = max(1, int(mx.nec_pct / total * 100))
        d_w = max(1, int(mx.des_pct / total * 100))
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

    ucfg: UserConfig = mx.user_config
    b_nec = _badge("Necessidades", mx.nec_pct, mx.nec_delta, ucfg.meta_necessidades)
    b_des = _badge("Desejos", mx.des_pct, mx.des_delta, ucfg.meta_desejos)
    b_inv = _badge("Investimento", mx.inv_pct, mx.inv_delta, ucfg.meta_investimento)

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


def render_cat_breakdown(cat_dict: dict, sparklines: dict | None = None) -> None:
    """Renderiza barras de breakdown por categoria com sparklines opcionais (I4)."""
    if not cat_dict:
        return
    total = sum(cat_dict.values())
    if total == 0:
        return
    html = ""
    for cat, val in cat_dict.items():
        pct = (val / total) * 100
        spark_col = ""
        if sparklines and cat in sparklines:
            _spark = _sparkline_html(sparklines[cat])
            if _spark:
                spark_col = (
                    f'<span class="cat-spark" style="width:52px;flex-shrink:0;'
                    f'text-align:center;line-height:1;">{_spark}</span>'
                )
        html += (
            f'<div class="cat-bar-row">'
            f'<span class="cat-bar-label">{sanitize(str(cat))}</span>'
            f'{spark_col}'
            f'<div class="cat-bar-track">'
            f'<div class="cat-bar-fill" style="width:{pct:.0f}%;"></div>'
            f'</div>'
            f'<span class="cat-bar-value">{pct:.0f}%  {fmt_brl(val)}</span>'
            f'</div>'
        )
    st.markdown(html, unsafe_allow_html=True)


def render_hist_summary(mx: MonthMetrics) -> None:
    """Renderiza resumo do histórico mensal."""
    entradas = mx.renda
    saidas = mx.lifestyle
    investido = mx.investido_mes
    saldo = mx.disponivel
    saldo_color = "#00FFCC" if saldo >= 0 else "#FF4444"
    st.markdown(f"""
    <div class="hist-summary">
        <div class="hist-summary-item">
            <div class="hist-dot" style="background:#00FFCC;"></div>
            <span style="color:#888;">Entradas</span>
            <span style="color:#F0F0F0;">{fmt_brl(entradas)}</span>
            <span style="color:#555;">({mx.month_entradas})</span>
        </div>
        <div class="hist-summary-item">
            <div class="hist-dot" style="background:#FF4444;"></div>
            <span style="color:#888;">Saídas</span>
            <span style="color:#F0F0F0;">{fmt_brl(saidas)}</span>
            <span style="color:#555;">({mx.month_saidas})</span>
        </div>
        <div class="hist-summary-item">
            <div class="hist-dot" style="background:#FFAA00;"></div>
            <span style="color:#888;">Investido</span>
            <span style="color:#F0F0F0;">{fmt_brl(investido)}</span>
            <span style="color:#555;">({mx.month_investimentos})</span>
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

    _cc = _chart_colors()
    fig.update_layout(
        barmode="stack",
        paper_bgcolor=_cc["paper_bg"],
        plot_bgcolor=_cc["plot_bg"],
        font=dict(family="JetBrains Mono, monospace", color=_cc["font_color"], size=11),
        legend=dict(
            orientation="h", yanchor="bottom", y=1.02,
            xanchor="center", x=0.5, font=dict(size=9)
        ),
        margin=dict(l=0, r=0, t=30, b=0),
        height=300,
        xaxis=dict(gridcolor=_cc["grid"], showline=False),
        yaxis=dict(gridcolor=_cc["grid"], showline=False, tickformat=",.0f"),
        hovermode="x unified",
        hoverlabel=dict(
            bgcolor="#0a0a0a", bordercolor="#1a1a1a",
            font=dict(family="JetBrains Mono, monospace", size=10, color="#F0F0F0"),
        ),
    )
    st.plotly_chart(fig, use_container_width=True, config={
        "displayModeBar": False,
        "scrollZoom": False,
        "doubleClick": False,
    })

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
    """Renderiza onboarding visual para mês sem dados (X4)."""
    steps = [
        ("01", "💰", "Registre sua Renda", "Aba RENDA — salário, freelance, dividendos"),
        ("02", "🔄", "Cadastre Fixos", "Aba FIXOS — aluguel, assinaturas, contas recorrentes"),
        ("03", "⚡", "Lance Gastos", "Lançamento Rápido acima — mercado, uber, restaurante"),
        ("04", "📊", "Acompanhe", "HISTÓRICO — edite, exporte e analise seus dados"),
    ]
    steps_html = ""
    for num, icon, title, desc in steps:
        steps_html += (
            f'<div style="display:flex;align-items:flex-start;gap:12px;'
            f'padding:12px 0;border-bottom:1px solid #0f0f0f;">'
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
            f'color:#00FFCC;min-width:24px;opacity:0.5;">{num}</div>'
            f'<div style="font-size:1.1rem;min-width:24px;">{icon}</div>'
            f'<div>'
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.72rem;'
            f'color:#F0F0F0;font-weight:600;">{title}</div>'
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.6rem;'
            f'color:#555;margin-top:2px;">{desc}</div>'
            f'</div>'
            f'</div>'
        )
    st.markdown(f"""
    <div style="background:#0a0a0a;border:1px solid #1a1a1a;padding:24px;
         margin:16px 0;max-width:500px;margin-left:auto;margin-right:auto;">
        <div style="font-family:JetBrains Mono,monospace;font-size:0.6rem;
             color:#00FFCC;text-transform:uppercase;letter-spacing:0.4em;
             margin-bottom:4px;opacity:0.5;">▮ Primeiros Passos</div>
        <div style="font-family:JetBrains Mono,monospace;font-size:0.85rem;
             color:#F0F0F0;margin-bottom:16px;">
            Nenhuma transação em <strong>{sanitize(month_label)}</strong>
        </div>
        {steps_html}
        <div style="font-family:JetBrains Mono,monospace;font-size:0.5rem;
             color:#333;margin-top:12px;text-align:center;">
            Dica: comece pelo ⚡ Lançamento Rápido acima</div>
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

def render_prev_comparison(mx: MonthMetrics, sel_mo: int, sel_yr: int) -> None:
    """Renderiza comparativo compacto com mês anterior."""
    has_prev = mx.prev_renda > 0 or mx.prev_lifestyle > 0 or mx.prev_investido > 0
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
        _row("Renda", mx.prev_renda, mx.renda, mx.d_renda)
        + _row("Gastos", mx.prev_lifestyle, mx.lifestyle, mx.d_lifestyle, invert=True)
        + _row("Investido", mx.prev_investido, mx.investido_mes, mx.d_investido)
        + _row("Saldo", mx.prev_disponivel, mx.disponivel, mx.d_disponivel)
    )

    html = (
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ vs Mês Anterior</div>'
        f'{header}{rows}'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_aporte_meta(mx: MonthMetrics) -> None:
    """Renderiza barra de progresso da meta de investimento."""
    if mx.renda <= 0:
        return
    ucfg: UserConfig = mx.user_config
    meta_valor = mx.renda * (ucfg.meta_investimento / 100)
    investido = mx.investido_mes
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
        f'<span>Meta Aporte ({ucfg.meta_investimento}%): {fmt_brl(meta_valor)}</span>'
        f'<span style="color:{color};">{pct:.0f}% — {status}</span>'
        f'</div>'
        f'<div style="width:100%;height:4px;background:#111;">'
        f'<div style="width:{fill_pct}%;height:100%;background:{color};'
        f'transition:width 0.4s ease;"></div>'
        f'</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_top_gastos(
    top5: list[dict], ticket_medio: float, split: dict,
    dia_mais_caro: int = 0, dia_mais_caro_val: float = 0.0,
    dia_mais_caro_count: int = 0,
) -> None:
    """Renderiza top 5 gastos + ticket médio + split casal + dia mais caro."""
    if not top5 and ticket_medio <= 0 and not split and dia_mais_caro <= 0:
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
    if dia_mais_caro > 0:
        meta_parts.append(
            f"Dia mais caro: {dia_mais_caro} ({fmt_brl(dia_mais_caro_val)} · {dia_mais_caro_count}tx)"
        )
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

def render_divisao_casal(divisao: dict | None) -> None:
    """Renderiza card de divisão de despesas do casal com acerto."""
    if divisao is None:
        return

    pessoa_a, pessoa_b = divisao["pessoas"]

    # --- Acerto ---
    if divisao["equilibrado"]:
        acerto_html = (
            '<div style="color:#00FFCC; font-family:JetBrains Mono,monospace; '
            'font-size:0.75rem; font-weight:700; margin-top:12px; padding:10px; '
            'border:1px solid #00FFCC33; text-align:center;">'
            '✓ Despesas equilibradas</div>'
        )
    else:
        acerto_html = (
            f'<div style="color:#FFAA00; font-family:JetBrains Mono,monospace; '
            f'font-size:0.75rem; font-weight:700; margin-top:12px; padding:10px; '
            f'border:1px solid #FFAA0033; text-align:center;">'
            f'⟶ {sanitize(divisao["quem_deve"])} deve '
            f'{fmt_brl(divisao["diferenca"])} '
            f'a {sanitize(divisao["quem_recebe"])}'
            f'</div>'
        )

    # --- Cards por pessoa ---
    persons_html = ""
    for pessoa in [pessoa_a, pessoa_b]:
        ind = divisao["individual"][pessoa]
        justo = divisao["cota_justa"][pessoa]
        persons_html += (
            f'<div style="flex:1; min-width:130px;">'
            f'<div style="font-family:JetBrains Mono,monospace; font-size:0.55rem; '
            f'color:#555; text-transform:uppercase; letter-spacing:0.1em; '
            f'margin-bottom:6px;">{sanitize(pessoa)}</div>'

            f'<div style="font-family:JetBrains Mono,monospace; font-size:0.62rem; '
            f'color:#888; padding:3px 0;">'
            f'Individual: <span style="color:#F0F0F0;">{fmt_brl(ind)}</span></div>'

            f'<div style="font-family:JetBrains Mono,monospace; font-size:0.62rem; '
            f'color:#888; padding:3px 0;">'
            f'+ ½ casal: <span style="color:#F0F0F0;">'
            f'{fmt_brl(divisao["metade_compartilhado"])}</span></div>'

            f'<div style="font-family:JetBrains Mono,monospace; font-size:0.72rem; '
            f'color:#F0F0F0; font-weight:700; padding:6px 0 0 0; '
            f'border-top:1px solid #1a1a1a; margin-top:4px;">'
            f'Cota justa: {fmt_brl(justo)}</div>'
            f'</div>'
        )

    # --- Composição final ---
    html = (
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ Divisão de Despesas — Acerto Mensal</div>'

        f'<div style="display:flex; gap:24px; flex-wrap:wrap; margin-bottom:8px;">'
        f'{persons_html}'
        f'</div>'

        f'<div style="font-family:JetBrains Mono,monospace; font-size:0.58rem; '
        f'color:#444; padding:6px 0; border-top:1px solid #0f0f0f;">'
        f'Compartilhado (Casal): {fmt_brl(divisao["casal_compartilhado"])} '
        f'· Total geral: {fmt_brl(divisao["total_geral"])}'
        f'</div>'

        f'{acerto_html}'

        f'<div style="font-family:JetBrains Mono,monospace; font-size:0.48rem; '
        f'color:#222; margin-top:8px;">'
        f'Nota: gastos com responsável "Casal" são divididos 50/50. '
        f'Para rastreio preciso de quem pagou, use o responsável individual.</div>'

        f'</div>'
    )
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

    _palette = ["#00FFCC", "#FFAA00", "#F0F0F0", "#888888", "#555555", "#FF4444", "#4488FF", "#AA44FF"]
    cat_colors = {
        "Salário": "#00FFCC",
        "Dividendos": "#FFAA00",
        "Bônus": "#F0F0F0",
        "Extra": "#888888",
        "Reembolso": "#555555",
    }
    for i, cat in enumerate(sorted(all_cats)):
        if cat not in cat_colors:
            cat_colors[cat] = _palette[i % len(_palette)]

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

    _cc = _chart_colors()
    fig.update_layout(
        barmode="stack",
        paper_bgcolor=_cc["paper_bg"],
        plot_bgcolor=_cc["plot_bg"],
        font=dict(family="JetBrains Mono, monospace", color=_cc["font_color"], size=11),
        legend=dict(
            orientation="h", yanchor="bottom", y=1.02,
            xanchor="center", x=0.5, font=dict(size=9),
        ),
        margin=dict(l=0, r=0, t=30, b=0),
        height=280,
        xaxis=dict(gridcolor=_cc["grid"], showline=False),
        yaxis=dict(gridcolor=_cc["grid"], showline=False, tickformat=",.0f"),
        hovermode="x unified",
        hoverlabel=dict(
            bgcolor="#0a0a0a", bordercolor="#1a1a1a",
            font=dict(family="JetBrains Mono, monospace", size=10, color="#F0F0F0"),
        ),
    )
    st.plotly_chart(fig, use_container_width=True, config={
        "displayModeBar": False,
        "scrollZoom": False,
        "doubleClick": False,
    })

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

def render_patrimonio_chart(pat_data: list[dict]) -> None:
    """Gráfico de evolução patrimonial: área + barras de aportes."""
    if not pat_data:
        render_intel("Evolução Patrimonial", "Dados insuficientes para gráfico.")
        return

    labels = [d["label"] for d in pat_data]
    patrimonio = [d["patrimonio"] for d in pat_data]
    aportes = [d["aporte_mes"] for d in pat_data]

    fig = go.Figure()

    # Área: patrimônio total
    fig.add_trace(go.Scatter(
        name="Patrimônio",
        x=labels, y=patrimonio,
        mode="lines+markers",
        fill="tozeroy",
        line=dict(color="#00FFCC", width=2),
        marker=dict(size=5, color="#00FFCC"),
        fillcolor="rgba(0,255,204,0.08)",
    ))

    # Barras: aportes mensais
    fig.add_trace(go.Bar(
        name="Aporte/mês",
        x=labels, y=aportes,
        marker_color="rgba(255,170,0,0.6)",
    ))

    _cc = _chart_colors()
    fig.update_layout(
        paper_bgcolor=_cc["paper_bg"],
        plot_bgcolor=_cc["plot_bg"],
        font=dict(family="JetBrains Mono, monospace", color=_cc["font_color"], size=11),
        legend=dict(
            orientation="h", yanchor="bottom", y=1.02,
            xanchor="center", x=0.5, font=dict(size=9),
        ),
        margin=dict(l=0, r=0, t=30, b=0),
        height=280,
        xaxis=dict(gridcolor=_cc["grid"], showline=False),
        yaxis=dict(gridcolor=_cc["grid"], showline=False, tickformat=",.0f"),
        barmode="overlay",
        hovermode="x unified",
        hoverlabel=dict(
            bgcolor="#0a0a0a", bordercolor="#1a1a1a",
            font=dict(family="JetBrains Mono, monospace", size=10, color="#F0F0F0"),
        ),
    )
    st.plotly_chart(fig, use_container_width=True, config={
        "displayModeBar": False,
        "scrollZoom": False,
        "doubleClick": False,
    })

    # Variação
    if len(pat_data) >= 2:
        curr = pat_data[-1]["patrimonio"]
        prev = pat_data[-2]["patrimonio"]
        diff = curr - prev
        if diff > 0:
            var_text = f"▲ Patrimônio +{fmt_brl(diff)} vs mês anterior"
            var_color = "#00FFCC"
        elif diff < 0:
            var_text = f"▼ Patrimônio {fmt_brl(diff)} vs mês anterior"
            var_color = "#FF4444"
        else:
            var_text = "● Patrimônio estável vs mês anterior"
            var_color = "#555"
        st.markdown(
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.65rem;'
            f'color:{var_color};padding:4px 0;letter-spacing:0.05em;">'
            f'{var_text}</div>',
            unsafe_allow_html=True,
        )

def render_yoy(yoy: dict | None) -> None:
    """Renderiza comparação year-over-year."""
    if yoy is None:
        return

    month_name = MESES_FULL[yoy["month"]]

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
        f'<span style="width:100px;text-align:right;">{month_name[:3]}/{yoy["prev_year"]}</span>'
        f'<span style="width:100px;text-align:right;">{month_name[:3]}/{yoy["curr_year"]}</span>'
        f'<span style="width:50px;text-align:right;">Δ</span>'
        f'</div>'
    )

    rows = (
        _row("Renda", yoy["prev"]["renda"], yoy["curr"]["renda"], yoy["d_renda"])
        + _row("Gastos", yoy["prev"]["gastos"], yoy["curr"]["gastos"], yoy["d_gastos"], invert=True)
        + _row("Investido", yoy["prev"]["investido"], yoy["curr"]["investido"], yoy["d_investido"])
        + _row("Saldo", yoy["prev"]["saldo"], yoy["curr"]["saldo"], yoy["d_saldo"])
    )

    st.markdown(
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ {sanitize(month_name)} — Ano vs Ano</div>'
        f'{header}{rows}'
        f'</div>',
        unsafe_allow_html=True,
    )

def render_cashflow_forecast(forecast: list[dict] | None) -> None:
    """Renderiza tabela de forecast de cashflow para próximos meses."""
    if not forecast:
        return

    n = len(forecast)

    # Header
    header_cells = ""
    for f in forecast:
        header_cells += (
            f'<span style="flex:1;text-align:right;color:#F0F0F0;'
            f'font-weight:600;">{f["label"]}</span>'
        )

    def make_row(label: str, key: str, color: str) -> str:
        cells = ""
        for fc in forecast:
            cells += (
                f'<span style="flex:1;text-align:right;color:{color};">'
                f'{fmt_brl(fc[key])}</span>'
            )
        return (
            f'<div style="display:flex;gap:8px;padding:4px 0;'
            f'font-family:JetBrains Mono,monospace;font-size:0.62rem;">'
            f'<span style="width:90px;color:#555;">{label}</span>'
            f'{cells}</div>'
        )

    # Saldo row (cor por célula)
    saldo_cells = ""
    for f in forecast:
        s_color = "#00FFCC" if f["saldo"] >= 0 else "#FF4444"
        saldo_cells += (
            f'<span style="flex:1;text-align:right;color:{s_color};'
            f'font-weight:700;">{fmt_brl(f["saldo"])}</span>'
        )
    saldo_row = (
        f'<div style="display:flex;gap:8px;padding:6px 0;'
        f'border-top:1px solid #1a1a1a;'
        f'font-family:JetBrains Mono,monospace;font-size:0.62rem;margin-top:4px;">'
        f'<span style="width:90px;color:#555;font-weight:700;">Saldo</span>'
        f'{saldo_cells}</div>'
    )

    # Acumulado row
    acum_cells = ""
    for f in forecast:
        a_color = "#00FFCC" if f["saldo_acumulado"] >= 0 else "#FF4444"
        acum_cells += (
            f'<span style="flex:1;text-align:right;color:{a_color};">'
            f'{fmt_brl(f["saldo_acumulado"])}</span>'
        )
    acum_row = (
        f'<div style="display:flex;gap:8px;padding:2px 0;'
        f'font-family:JetBrains Mono,monospace;font-size:0.55rem;">'
        f'<span style="width:90px;color:#444;">Acumulado</span>'
        f'{acum_cells}</div>'
    )

    # Insight
    any_deficit = any(f["deficit"] for f in forecast)
    if any_deficit:
        nota_color = "#FF4444"
        nota_text = "⚠ Projeção indica meses com déficit — revise gastos ou aumente renda"
    else:
        avg_saldo = sum(f["saldo"] for f in forecast) / n
        nota_color = "#00FFCC"
        nota_text = f"Saldo médio projetado: {fmt_brl(avg_saldo)}/mês"

    # Composição fixa/variável
    f0 = forecast[0]
    comp_parts: list[str] = []
    if f0["renda_fixa"] > 0:
        comp_parts.append(f"Renda fixa: {fmt_brl(f0['renda_fixa'])}")
    if f0["renda_variavel"] > 0:
        comp_parts.append(f"Renda var: {fmt_brl(f0['renda_variavel'])}")
    if f0["gastos_fixos"] > 0:
        comp_parts.append(f"Fixos: {fmt_brl(f0['gastos_fixos'])}")
    if f0["gastos_variaveis"] > 0:
        comp_parts.append(f"Variáveis: {fmt_brl(f0['gastos_variaveis'])}")
    comp_text = " · ".join(comp_parts) if comp_parts else ""

    html = (
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ Forecast Cashflow — {n} meses</div>'
        f'<div style="display:flex;gap:8px;padding:4px 0 8px 0;'
        f'font-family:JetBrains Mono,monospace;font-size:0.55rem;'
        f'border-bottom:1px solid #111;margin-bottom:4px;">'
        f'<span style="width:90px;color:#444;">Projeção</span>'
        f'{header_cells}</div>'
        f'{make_row("Renda", "renda", "#00FFCC")}'
        f'{make_row("Gastos", "gastos", "#FF4444")}'
        f'{make_row("Investido", "investimento", "#FFAA00")}'
        f'{saldo_row}'
        f'{acum_row}'
        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.58rem;'
        f'color:{nota_color};margin-top:10px;">{nota_text}</div>'
    )

    if comp_text:
        html += (
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.5rem;'
            f'color:#333;margin-top:4px;">{comp_text}</div>'
        )

    html += (
        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.48rem;'
        f'color:#222;margin-top:4px;">Base: recorrentes ativas + média variável (3 meses)</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_weekday_pattern(pattern: dict | None) -> None:
    """Renderiza padrão de gastos por dia da semana."""
    if not pattern or not pattern.get("dias"):
        return
    max_val = pattern["max_val"]
    if max_val == 0:
        return

    html = '<div class="intel-box">'
    html += '<div class="intel-title">◆ Padrão por Dia da Semana</div>'

    for d in pattern["dias"]:
        pct = (d["total"] / max_val * 100) if max_val > 0 else 0
        count_text = f'{d["count"]}tx' if d["count"] > 0 else "—"
        val_text = fmt_brl(d["total"]) if d["total"] > 0 else "—"
        if pct >= 80:
            bar_color = "#FF4444"
        elif pct >= 50:
            bar_color = "#FFAA00"
        elif pct > 0:
            bar_color = "#00FFCC"
        else:
            bar_color = "#111"
        html += (
            f'<div class="cat-bar-row">'
            f'<span class="cat-bar-label" style="width:36px;">{d["dia"]}</span>'
            f'<div class="cat-bar-track">'
            f'<div class="cat-bar-fill" style="width:{pct:.0f}%;background:{bar_color};"></div>'
            f'</div>'
            f'<span class="cat-bar-value" style="width:130px;">{count_text} · {val_text}</span>'
            f'</div>'
        )

    if "mais_caro" in pattern and "mais_leve" in pattern:
        mc = pattern["mais_caro"]
        ml = pattern["mais_leve"]
        html += (
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.58rem;'
            f'color:#555;padding-top:6px;border-top:1px solid #111;">'
            f'Mais pesado: <span style="color:#FF4444;">{mc["dia"]}</span> '
            f'({fmt_brl(mc["total"])}) · '
            f'Mais leve: <span style="color:#00FFCC;">{ml["dia"]}</span> '
            f'({fmt_brl(ml["total"])})'
            f'</div>'
        )

    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)


def render_tag_summary(tag_data: list[dict]) -> None:
    """Renderiza resumo analítico por tags."""
    if not tag_data:
        return

    html = '<div class="intel-box">'
    html += '<div class="intel-title">◆ Análise por Tags (6 meses)</div>'

    for t in tag_data:
        tag = sanitize(t["tag"])
        gastos_text = fmt_brl(t["gastos"]) if t["gastos"] > 0 else ""
        entradas_text = f' +{fmt_brl(t["entradas"])}' if t["entradas"] > 0 else ""
        html += (
            f'<div style="display:flex;justify-content:space-between;align-items:center;'
            f'padding:4px 0;font-family:JetBrains Mono,monospace;font-size:0.62rem;'
            f'border-bottom:1px solid #0f0f0f;">'
            f'<span style="color:#00FFCC;min-width:80px;">#{tag}</span>'
            f'<span style="color:#555;flex:1;text-align:center;">'
            f'{t["n_transacoes"]}tx · {t["n_meses"]}m</span>'
            f'<span style="color:#F0F0F0;min-width:90px;text-align:right;">'
            f'{gastos_text}{entradas_text}</span>'
            f'</div>'
        )

    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)


def render_savings_rate(savings_data: list[dict]) -> None:
    """Renderiza taxa de poupança em barras HTML compactas."""
    if not savings_data:
        return

    max_abs = max((abs(d["rate"]) for d in savings_data if d["has_data"]), default=1)
    if max_abs == 0:
        max_abs = 1

    html = '<div class="intel-box">'
    html += '<div class="intel-title">◆ Taxa de Poupança</div>'

    for d in savings_data:
        if not d["has_data"]:
            html += (
                f'<div class="cat-bar-row">'
                f'<span class="cat-bar-label" style="width:60px;">{d["label"]}</span>'
                f'<div class="cat-bar-track"></div>'
                f'<span class="cat-bar-value" style="width:60px;color:#333;">—</span>'
                f'</div>'
            )
            continue
        rate = d["rate"]
        pct = min(100, abs(rate) / max_abs * 100) if max_abs > 0 else 0
        color = "#00FFCC" if rate >= 20 else ("#FFAA00" if rate >= 0 else "#FF4444")
        sign = "+" if rate > 0 else ""
        html += (
            f'<div class="cat-bar-row">'
            f'<span class="cat-bar-label" style="width:60px;">{d["label"]}</span>'
            f'<div class="cat-bar-track">'
            f'<div class="cat-bar-fill" style="width:{pct:.0f}%;background:{color};"></div>'
            f'</div>'
            f'<span class="cat-bar-value" style="width:60px;color:{color};">'
            f'{sign}{rate:.0f}%</span>'
            f'</div>'
        )

    active = [d for d in savings_data if d["has_data"]]
    if active:
        avg = sum(d["rate"] for d in active) / len(active)
        avg_color = "#00FFCC" if avg >= 20 else ("#FFAA00" if avg >= 0 else "#FF4444")
        html += (
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.58rem;'
            f'color:#555;padding-top:6px;border-top:1px solid #111;">'
            f'Média: <span style="color:{avg_color};">{avg:.0f}%</span> · '
            f'(Renda − Gastos) ÷ Renda'
            f'</div>'
        )

    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)


def render_consistency(consistency: dict | None, user_config: UserConfig | None = None) -> None:
    """Renderiza índice de consistência financeira."""
    if not consistency:
        return

    ucfg = user_config or UserConfig()
    c = consistency

    overall = c["overall_pct"]
    if overall >= 80:
        overall_color, grade = "#00FFCC", "Excelente"
    elif overall >= 60:
        overall_color, grade = "#00FFCC", "Bom"
    elif overall >= 40:
        overall_color, grade = "#FFAA00", "Regular"
    else:
        overall_color, grade = "#FF4444", "Fraco"

    html = (
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ Consistência ({c["months_analyzed"]} meses)</div>'
        f'<div style="display:flex;gap:16px;flex-wrap:wrap;">'

        f'<div style="text-align:center;min-width:70px;">'
        f'<div style="font-family:JetBrains Mono,monospace;font-size:1.6rem;'
        f'font-weight:700;color:{overall_color};">{overall:.0f}%</div>'
        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.5rem;'
        f'color:#555;text-transform:uppercase;letter-spacing:0.1em;">{grade}</div>'
        f'</div>'

        f'<div style="flex:1;min-width:150px;">'

        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.62rem;'
        f'color:#888;padding:3px 0;display:flex;justify-content:space-between;">'
        f'<span>Meta aporte ({ucfg.meta_investimento}%)</span>'
        f'<span style="color:{"#00FFCC" if c["aporte_pct"] >= 60 else "#FFAA00"};">'
        f'{c["aporte_ok"]}/{c["months_analyzed"]} ({c["aporte_pct"]:.0f}%)</span>'
        f'</div>'

        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.62rem;'
        f'color:#888;padding:3px 0;display:flex;justify-content:space-between;">'
        f'<span>Saldo positivo</span>'
        f'<span style="color:{"#00FFCC" if c["saldo_pct"] >= 60 else "#FFAA00"};">'
        f'{c["saldo_ok"]}/{c["months_analyzed"]} ({c["saldo_pct"]:.0f}%)</span>'
        f'</div>'

        f'</div>'
        f'</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_anomalies(anomalies: list[dict]) -> None:
    """Renderiza alertas de gastos anômalos (I2)."""
    if not anomalies:
        return

    html = '<div class="intel-box" style="border-left-color:#FF4444;">'
    html += '<div class="intel-title" style="color:#FF4444;">◆ Anomalias Detectadas</div>'

    for a in anomalies:
        cat = sanitize(a["categoria"])
        ratio = a["ratio"]
        color = "#FF4444" if ratio >= 3 else "#FFAA00"
        icon = "▲▲" if ratio >= 3 else "▲"
        html += (
            f'<div style="display:flex;justify-content:space-between;align-items:center;'
            f'padding:6px 0;font-family:JetBrains Mono,monospace;font-size:0.62rem;'
            f'border-bottom:1px solid #0f0f0f;">'
            f'<span style="color:{color};min-width:20px;">{icon}</span>'
            f'<span style="color:#F0F0F0;flex:1;">{cat}</span>'
            f'<span style="color:{color};min-width:90px;text-align:right;font-weight:700;">'
            f'{fmt_brl(a["valor_atual"])}</span>'
            f'<span style="color:#555;min-width:130px;text-align:right;">'
            f'{a["ratio"]:.1f}x da média ({fmt_brl(a["media_historica"])})</span>'
            f'</div>'
        )

    html += (
        f'<div style="font-family:JetBrains Mono,monospace;font-size:0.5rem;'
        f'color:#333;margin-top:6px;">Comparação: média 3 meses · Threshold: 2x</div>'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)


def render_calendar_heatmap(heatmap: dict | None) -> None:
    """Renderiza heatmap calendário de gastos diários (V5)."""
    if not heatmap:
        return

    month_name = MESES_FULL[heatmap["month"]]
    days_in_month = heatmap["days_in_month"]
    first_wd = heatmap["first_weekday"]
    daily = heatmap["daily"]
    max_val = heatmap["max_val"]

    def _color(val: float) -> str:
        if val == 0 or max_val == 0:
            return "#0a0a0a"
        ratio = val / max_val
        if ratio < 0.25:
            return "#0a2a1a"
        if ratio < 0.5:
            return "#0d3d26"
        if ratio < 0.75:
            return "#115533"
        return "#00FFCC"

    dias_semana = ["S", "T", "Q", "Q", "S", "S", "D"]
    header = "".join(
        f'<div style="width:34px;text-align:center;font-family:JetBrains Mono,monospace;'
        f'font-size:0.45rem;color:#444;">{d}</div>'
        for d in dias_semana
    )

    cells = ""
    for _ in range(first_wd):
        cells += '<div style="width:34px;height:34px;"></div>'

    for day in range(1, days_in_month + 1):
        val = daily.get(day, 0)
        bg = _color(val)
        border = "1px solid #00FFCC" if val == max_val and max_val > 0 else "1px solid #111"
        day_color = "#F0F0F0" if val > 0 else "#333"
        cells += (
            f'<div style="width:34px;height:34px;background:{bg};border:{border};'
            f'display:flex;align-items:center;justify-content:center;'
            f'font-family:JetBrains Mono,monospace;font-size:0.5rem;'
            f'color:{day_color};">{day}</div>'
        )

    legend = (
        f'<div style="display:flex;gap:8px;margin-top:8px;font-family:JetBrains Mono,monospace;'
        f'font-size:0.45rem;color:#555;align-items:center;flex-wrap:wrap;">'
        f'<span style="display:flex;align-items:center;gap:2px;">'
        f'<span style="width:8px;height:8px;background:#0a0a0a;border:1px solid #111;"></span>R$0</span>'
        f'<span style="display:flex;align-items:center;gap:2px;">'
        f'<span style="width:8px;height:8px;background:#0a2a1a;"></span>Leve</span>'
        f'<span style="display:flex;align-items:center;gap:2px;">'
        f'<span style="width:8px;height:8px;background:#0d3d26;"></span>Médio</span>'
        f'<span style="display:flex;align-items:center;gap:2px;">'
        f'<span style="width:8px;height:8px;background:#115533;"></span>Alto</span>'
        f'<span style="display:flex;align-items:center;gap:2px;">'
        f'<span style="width:8px;height:8px;background:#00FFCC;"></span>Pico</span>'
        f'</div>'
    )

    stats = ""
    if heatmap["dia_pesado"] > 0:
        stats = (
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
            f'color:#555;padding-top:6px;border-top:1px solid #111;margin-top:8px;">'
            f'Mais pesado: <span style="color:#FF4444;">dia {heatmap["dia_pesado"]}</span> '
            f'({fmt_brl(heatmap["dia_pesado_val"])} · {heatmap["dia_pesado_count"]}tx) · '
            f'Sem gasto: <span style="color:#00FFCC;">{heatmap["dias_sem_gasto"]}d</span> · '
            f'Média: {fmt_brl(heatmap["media_diaria"])}/dia'
            f'</div>'
        )

    html = (
        f'<div class="intel-box">'
        f'<div class="intel-title">◆ Mapa de Gastos — {sanitize(month_name)} {heatmap["year"]}</div>'
        f'<div style="display:flex;gap:2px;margin-bottom:4px;">{header}</div>'
        f'<div style="display:flex;flex-wrap:wrap;gap:2px;">{cells}</div>'
        f'{legend}{stats}'
        f'</div>'
    )
    st.markdown(html, unsafe_allow_html=True)

def render_transaction_cards(df: pd.DataFrame, max_items: int = 25) -> None:
    """Renderiza transações como cards compactos mobile-friendly (V6)."""
    if df.empty:
        st.caption("Nenhuma transação para exibir.")
        return

    df_sorted = df.copy()
    df_sorted["Data"] = pd.to_datetime(df_sorted["Data"], errors="coerce")
    df_sorted = df_sorted.sort_values("Data", ascending=False).head(max_items)

    html = '<div class="tx-cards-container">'
    for _, row in df_sorted.iterrows():
        tipo = str(row.get("Tipo", ""))
        val = float(row.get("Valor", 0))
        desc = sanitize(str(row.get("Descricao", "")))[:40]
        cat = sanitize(str(row.get("Categoria", "")))
        resp = sanitize(str(row.get("Responsavel", "")))
        tag = str(row.get("Tag", "")).strip()
        dt = row.get("Data")

        if isinstance(dt, pd.Timestamp) and not pd.isna(dt):
            date_str = dt.strftime("%d/%m")
        else:
            date_str = "—"

        if tipo == CFG.TIPO_ENTRADA:
            val_color = "#00FFCC"
            val_prefix = "+"
            badge_cls = "tx-badge-entrada"
            badge_text = "entrada"
        elif str(row.get("Categoria", "")) == CFG.CAT_INVESTIMENTO:
            val_color = "#FFAA00"
            val_prefix = ""
            badge_cls = "tx-badge-investimento"
            badge_text = "investimento"
        else:
            val_color = "#FF4444"
            val_prefix = "-"
            badge_cls = "tx-badge-saida"
            badge_text = "saída"

        tag_html = (
            f' <span style="color:#00FFCC;opacity:0.5;">#{sanitize(tag)}</span>'
            if tag else ""
        )

        html += (
            f'<div class="tx-card">'
            f'<div class="tx-card-left">'
            f'<div class="tx-card-desc">{desc}</div>'
            f'<div class="tx-card-meta">'
            f'{cat} · {resp} · {date_str}{tag_html}</div>'
            f'</div>'
            f'<div class="tx-card-right">'
            f'<div class="tx-card-valor" style="color:{val_color};">'
            f'{val_prefix}{fmt_brl(val)}</div>'
            f'<div class="tx-card-badge {badge_cls}">{badge_text}</div>'
            f'</div>'
            f'</div>'
        )
    html += '</div>'

    if len(df) > max_items:
        html += (
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.5rem;'
            f'color:#333;text-align:center;padding:8px 0;">'
            f'Exibindo {max_items} de {len(df)} transações</div>'
        )

    st.markdown(html, unsafe_allow_html=True)

def render_metas(metas_progress: list[dict]) -> None:
    """Renderiza cards de metas financeiras com progresso (G1)."""
    if not metas_progress:
        render_intel("Metas", "Nenhuma meta ativa. Crie uma usando o formulário ao lado.")
        return

    for m in metas_progress:
        pct = m["pct"]
        if m["status"] == "achieved":
            color, status_text = "#00FFCC", "✓ Atingida"
        elif m["status"] == "overdue":
            color, status_text = "#FF4444", "⚠ Prazo vencido"
        else:
            color = "#00FFCC" if pct >= 50 else "#FFAA00"
            status_text = f"{pct:.0f}%"

        prazo_info = ""
        if m["months_remaining"] is not None:
            if m["monthly_needed"] and m["monthly_needed"] > 0:
                prazo_info = (
                    f' · {m["months_remaining"]}m restantes '
                    f'· precisa {fmt_brl(m["monthly_needed"])}/mês'
                )
            else:
                prazo_info = f' · {m["months_remaining"]}m restantes'
        elif m["prazo"]:
            prazo_info = f' · Prazo: {m["prazo"]}'

        html = (
            f'<div class="intel-box">'
            f'<div style="display:flex;justify-content:space-between;align-items:center;">'
            f'<div class="intel-title" style="margin-bottom:0;">'
            f'{sanitize(m["nome"])}</div>'
            f'<span style="font-family:JetBrains Mono,monospace;font-size:0.6rem;'
            f'color:{color};font-weight:700;">{status_text}</span>'
            f'</div>'
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.8rem;'
            f'color:#F0F0F0;margin:8px 0 4px 0;">'
            f'{fmt_brl(m["atual"])} / {fmt_brl(m["alvo"])}'
            f'</div>'
            f'<div style="width:100%;height:6px;background:#111;margin-bottom:4px;">'
            f'<div style="width:{min(100, pct):.0f}%;height:100%;background:{color};'
            f'transition:width 0.4s ease;"></div>'
            f'</div>'
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.55rem;'
            f'color:#555;">'
            f'Restante: {fmt_brl(m["restante"])}{prazo_info}'
            f'</div>'
            f'</div>'
        )
        st.markdown(html, unsafe_allow_html=True)


def render_challenges(challenges: list[dict]) -> None:
    """Renderiza micro-desafios do mês (G3)."""
    if not challenges:
        return
    html = '<div class="intel-box">'
    html += '<div class="intel-title">◆ Desafios do Mês</div>'
    for c in challenges:
        if c["done"]:
            check = "✓"
            check_style = "color:#00FFCC;font-weight:700;"
        else:
            check = f'{c["progress"]:.0f}%'
            check_style = "color:#FFAA00;font-weight:700;" if c["progress"] >= 50 else "color:#FF4444;font-weight:700;"
        fill_color = "#00FFCC" if c["done"] else "#FFAA00"
        html += (
            f'<div style="padding:8px 0;border-bottom:1px solid #0f0f0f;">'
            f'<div style="display:flex;align-items:center;gap:8px;'
            f'font-family:JetBrains Mono,monospace;font-size:0.62rem;">'
            f'<span style="font-size:0.9rem;">{c["icon"]}</span>'
            f'<div style="flex:1;">'
            f'<div style="color:#F0F0F0;">{c["title"]}</div>'
            f'<div style="color:#555;font-size:0.55rem;">{c["desc"]}</div>'
            f'</div>'
            f'<span style="{check_style}">{check}</span>'
            f'</div>'
            f'<div style="width:100%;height:3px;background:#111;margin-top:4px;">'
            f'<div style="width:{c["progress"]:.0f}%;height:100%;background:{fill_color};'
            f'transition:width 0.4s ease;"></div>'
            f'</div>'
            f'</div>'
        )
    html += '</div>'
    st.markdown(html, unsafe_allow_html=True)


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
    mx: MonthMetrics,
    user: str,
    sel_mo: int,
    sel_yr: int,
    on_save_historico=None,
) -> None:
    """Renderiza aba de histórico com busca, export e edição."""
    df_hist = mx.df_month.copy()
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

    # --- Relatório Completo ---
    try:
        score_data = compute_score(mx)
        report_buf = generate_monthly_report(
            mx, mx.budget_data,
            score_data,
            sel_mo, sel_yr, user,
        )
        if report_buf:
            st.download_button(
                "📊 RELATÓRIO COMPLETO (Excel)",
                report_buf.getvalue(),
                f"relatorio_{sel_mo:02d}_{sel_yr}_{user}.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
                key=f"report_{user}_{sel_mo}_{sel_yr}",
            )
    except Exception as e:
        logger.warning(f"Report generation failed: {e}")

    search = st.text_input(
        "🔍 Buscar",
        placeholder="Filtrar visualização por descrição, categoria...",
        label_visibility="collapsed",
        key=f"hist_search_{user}_{sel_mo}_{sel_yr}",
    )

    df_display = df_hist.copy()
    if search and search.strip():
        search_lower = search.strip().lower()
        tag_mask = df_display["Tag"].str.lower().str.contains(search_lower, na=False) if "Tag" in df_display.columns else False
        mask = (
            df_display["Descricao"].str.lower().str.contains(search_lower, na=False) |
            df_display["Categoria"].str.lower().str.contains(search_lower, na=False) |
            df_display["Tipo"].str.lower().str.contains(search_lower, na=False) |
            df_display["Responsavel"].str.lower().str.contains(search_lower, na=False) |
            tag_mask
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

    # --- Toggle Tabela/Cards (V6) ---
    _hist_vc1, _hist_vc2 = st.columns([1, 3])
    with _hist_vc1:
        _hist_view = st.radio(
            "Vista", ["Tabela", "Cards"],
            horizontal=True, label_visibility="collapsed",
            key=f"hist_view_{user}_{sel_mo}_{sel_yr}",
        )

    if _hist_view == "Cards":
        _show_all_cards = len(df_display) > 25 and st.checkbox(
            f"Mostrar todas ({len(df_display)})",
            key=f"cards_all_{user}_{sel_mo}_{sel_yr}",
        )
        # Assuming render_transaction_cards is defined elsewhere in this module
        # If not, you will need to import it. It's actually in views.py line 1500+
        render_transaction_cards(
            df_display,
            max_items=len(df_display) if _show_all_cards else 25,
        )
        st.caption("💡 Para editar/excluir, mude para visualização Tabela.")
        return

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
            "Tag": st.column_config.TextColumn("Tag", max_chars=50),
            "Id": None,  # Oculta coluna Id do editor
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
                        edited["Origem"] = edited["Origem"].fillna(CFG.ORIGEM_MANUAL)
                    else:
                        edited["Origem"] = CFG.ORIGEM_MANUAL

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
                    elif on_save_historico:
                        on_save_historico(edited, user, sel_mo, sel_yr)
        with c_discard:
            if st.button("✗ DESCARTAR", key=f"discard_hist_{user}_{sel_mo}_{sel_yr}", use_container_width=True):
                st.rerun()


def _render_login() -> tuple[str, str, bool]:
    """Renderiza tela de login no tema do terminal. Retorna (username, password, submitted)."""
    st.markdown('''
    <div style="text-align:center; padding:80px 20px 20px 20px;">
        <div style="font-family:'JetBrains Mono',monospace; font-size:0.6rem;
             color:#00FFCC; text-transform:uppercase; letter-spacing:0.6em;
             margin-bottom:12px; opacity:0.5;">▮ L&L Finance Terminal</div>
        <div style="font-family:'JetBrains Mono',monospace; font-size:2.5rem;
             color:#F0F0F0; margin-bottom:8px; letter-spacing:-0.02em;">Autenticação</div>
        <div style="font-family:'JetBrains Mono',monospace; font-size:0.65rem;
             color:#333; letter-spacing:0.05em;">Acesso restrito</div>
    </div>
    ''', unsafe_allow_html=True)

    username, password, submitted = "", "", False
    _, col_center, _ = st.columns([1, 1, 1])
    with col_center:
        with st.form("login_form"):
            username = st.text_input(
                "Usuário", placeholder="seu nome",
                label_visibility="collapsed",
            )
            password = st.text_input(
                "Senha", type="password", placeholder="senha",
                label_visibility="collapsed",
            )
            submitted = st.form_submit_button("ENTRAR", use_container_width=True)

        st.markdown(
            f'<div style="font-family:JetBrains Mono,monospace;font-size:0.5rem;'
            f'color:#1a1a1a;text-align:center;margin-top:24px;">v{CFG.VERSION}</div>',
            unsafe_allow_html=True,
        )
    return username, password, submitted
