"""Motor Analítico — Funções puras de cálculo financeiro.

Extraído de app_homolog.py (Fase 5). Todas as funções aqui são puras
(sem dependência de Streamlit) e operam sobre DataFrames/dataclasses.
"""
from __future__ import annotations

import calendar
from datetime import datetime, timedelta, date
from io import BytesIO

import pandas as pd

from core.config import Config, CFG, UserConfig, MESES_PT
from core.models import MonthMetrics
from core.utils import (
    sanitize, generate_id, fmt_brl, end_of_month, calc_delta,
)


# ===========================================================================
# Filtros
# ===========================================================================

def filter_by_user(
    df: pd.DataFrame, user_filter: str, include_shared: bool = False,
) -> pd.DataFrame:
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


# ===========================================================================
# Recorrentes & Orçamento
# ===========================================================================

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

    df_ativas = df_recorrentes[df_recorrentes["Ativo"].eq(True)].copy()
    if df_ativas.empty:
        return pd.DataFrame(columns=list(CFG.COLS_RECORRENTE))

    if user_filter != "Casal" and "Responsavel" in df_ativas.columns:
        df_ativas = df_ativas[df_ativas["Responsavel"] == user_filter].copy()

    if df_ativas.empty:
        return pd.DataFrame(columns=list(CFG.COLS_RECORRENTE))

    df_t = filter_by_user(df_trans, user_filter)
    df_mo = filter_by_month(df_t, target_month, target_year) if not df_t.empty else pd.DataFrame()

    geradas_keys: set[tuple[str, str, str, str]] = set()
    if not df_mo.empty and "Origem" in df_mo.columns:
        df_geradas = df_mo[df_mo["Origem"] == CFG.ORIGEM_RECORRENTE]
        for _, tr in df_geradas.iterrows():
            chave = (
                str(tr["Descricao"]).strip().lower(),
                str(tr["Categoria"]).strip(),
                str(tr["Tipo"]).strip(),
                str(tr["Responsavel"]).strip(),
            )
            geradas_keys.add(chave)

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


# ===========================================================================
# Projeção & Alertas
# ===========================================================================

def compute_projection(
    mx: MonthMetrics,
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

    if day_of_month < 3 or mx.lifestyle == 0:
        return None

    daily_rate = mx.lifestyle / day_of_month
    projected_lifestyle = daily_rate * days_in_month
    projected_investido = mx.investido_mes
    projected_available = mx.renda - projected_lifestyle - projected_investido
    progress_pct = (day_of_month / days_in_month) * 100
    renda_consumed_pct = (mx.lifestyle / mx.renda * 100) if mx.renda > 0 else 0
    renda_projected_pct = (projected_lifestyle / mx.renda * 100) if mx.renda > 0 else 0

    remaining_budget = max(0, mx.renda - mx.lifestyle - mx.investido_mes)
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
    mx: MonthMetrics,
    sel_mo: int,
    sel_yr: int,
    projection: dict | None,
    n_pendentes: int = 0,
) -> list[dict]:
    """Engine de alertas inteligentes baseado em regras."""
    alerts: list[dict] = []
    now = datetime.now()
    is_current = (sel_mo == now.month and sel_yr == now.year)

    if n_pendentes > 0:
        plural = "s" if n_pendentes > 1 else ""
        alerts.append({
            "level": "warn",
            "icon": "⟳",
            "msg": f"{n_pendentes} transação(ões) recorrente{plural} pendente{plural} — gere na aba FIXOS",
        })

    if mx.disponivel > 0 and mx.investido_mes > 0 and mx.renda > 0:
        alerts.append({
            "level": "ok",
            "icon": "✦",
            "msg": f"Mês positivo — {mx.taxa_aporte:.0f}% investido, saldo de {fmt_brl(mx.disponivel)}",
        })

    if mx.renda > 0 and mx.lifestyle > mx.renda:
        pct = (mx.lifestyle / mx.renda) * 100
        alerts.append({
            "level": "danger",
            "icon": "▲",
            "msg": f"Gastos em {pct:.0f}% da renda — mês no vermelho",
        })
    elif mx.renda > 0 and mx.lifestyle > mx.renda * 0.8:
        pct = (mx.lifestyle / mx.renda) * 100
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

    if mx.cat_breakdown and mx.lifestyle > 0:
        for cat, val in mx.cat_breakdown.items():
            pct = (val / mx.lifestyle) * 100
            if pct > 40:
                alerts.append({
                    "level": "warn",
                    "icon": "◈",
                    "msg": f"{sanitize(str(cat))} concentra {pct:.0f}% dos gastos ({fmt_brl(val)})",
                })
                break

    if mx.d_lifestyle is not None and mx.d_lifestyle != float("inf") and mx.d_lifestyle > 30:
        alerts.append({
            "level": "warn",
            "icon": "▲",
            "msg": f"Gastos {mx.d_lifestyle:.0f}% acima do mês anterior",
        })

    if is_current and now.day >= 5 and mx.renda == 0:
        alerts.append({
            "level": "info",
            "icon": "○",
            "msg": "Nenhuma entrada registrada este mês",
        })

    if mx.renda > 0 and mx.investido_mes == 0:
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

    budget_data = mx.budget_data
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


# ===========================================================================
# Métricas Principais
# ===========================================================================

def compute_metrics(
    df_trans: pd.DataFrame,
    df_assets: pd.DataFrame,
    user_filter: str,
    target_month: int,
    target_year: int,
    user_config: UserConfig | None = None,
) -> MonthMetrics:
    """Calcula todas as métricas financeiras para o mês/usuário."""
    ucfg = user_config or UserConfig()

    df_t = filter_by_user(df_trans, user_filter)
    df_a = filter_by_user(df_assets, user_filter, include_shared=True)

    # Garantir que 'Data' é datetime ANTES de filter_by_month
    if not df_t.empty and not pd.api.types.is_datetime64_any_dtype(df_t["Data"]):
        df_t["Data"] = pd.to_datetime(df_t["Data"], errors="coerce")
        df_t = df_t.dropna(subset=["Data"])

    df_mo = filter_by_month(df_t, target_month, target_year)

    m = MonthMetrics(
        df_user=df_t,
        df_month=df_mo,
        month_tx_count=len(df_mo),
        user_config=ucfg,
    )

    if df_t.empty:
        m.insight_ls = "Nenhum dado registrado."
        m.insight_renda = "Nenhum dado registrado."
        return m

    if not df_mo.empty:
        m.renda = df_mo[df_mo["Tipo"] == CFG.TIPO_ENTRADA]["Valor"].sum()
        despesas = df_mo[
            (df_mo["Tipo"] == CFG.TIPO_SAIDA) &
            (df_mo["Categoria"] != CFG.CAT_INVESTIMENTO)
        ]
        m.lifestyle = despesas["Valor"].sum()
        m.investido_mes = df_mo[
            (df_mo["Tipo"] == CFG.TIPO_SAIDA) &
            (df_mo["Categoria"] == CFG.CAT_INVESTIMENTO)
        ]["Valor"].sum()
        m.month_entradas = len(df_mo[df_mo["Tipo"] == CFG.TIPO_ENTRADA])
        m.month_saidas = len(despesas)
        m.month_investimentos = len(df_mo[
            (df_mo["Tipo"] == CFG.TIPO_SAIDA) &
            (df_mo["Categoria"] == CFG.CAT_INVESTIMENTO)
        ])

    m.disponivel = m.renda - m.lifestyle - m.investido_mes

    base_patrimonio = df_a["Valor"].sum() if not df_a.empty else 0.0
    m.investido_total = df_t[
        (df_t["Tipo"] == CFG.TIPO_SAIDA) &
        (df_t["Categoria"] == CFG.CAT_INVESTIMENTO)
    ]["Valor"].sum()
    m.sobrevivencia = base_patrimonio + m.investido_total

    m.taxa_aporte = (m.investido_mes / m.renda * 100) if m.renda > 0 else 0.0

    # --- Autonomia ---
    ref_date = end_of_month(target_year, target_month)
    inicio_3m = ref_date - timedelta(days=90)
    df_burn = df_t[
        (df_t["Data"] >= inicio_3m) &
        (df_t["Data"] <= ref_date) &
        (df_t["Tipo"] == CFG.TIPO_SAIDA) &
        (df_t["Categoria"] != CFG.CAT_INVESTIMENTO)
    ]
    if not df_burn.empty:
        dias = max(1, (ref_date - df_burn["Data"].min()).days)
        meses = max(1, min(3, dias / 30))
        media_gastos = df_burn["Valor"].sum() / meses
        m.autonomia = (m.sobrevivencia / media_gastos) if media_gastos > 0 else 999.0
    else:
        m.autonomia = 999.0

    # --- Regra 50/30/20 ---
    if m.renda > 0 and not df_mo.empty:
        despesas_mo = df_mo[
            (df_mo["Tipo"] == CFG.TIPO_SAIDA) &
            (df_mo["Categoria"] != CFG.CAT_INVESTIMENTO)
        ]
        val_nec = despesas_mo[despesas_mo["Categoria"].isin(CFG.NECESSIDADES)]["Valor"].sum()
        val_des = despesas_mo[despesas_mo["Categoria"].isin(CFG.DESEJOS)]["Valor"].sum()
        m.nec_pct = (val_nec / m.renda) * 100
        m.des_pct = (val_des / m.renda) * 100
        m.inv_pct = (m.investido_mes / m.renda) * 100
        m.nec_delta = m.nec_pct - ucfg.meta_necessidades
        m.des_delta = m.des_pct - ucfg.meta_desejos
        m.inv_delta = m.inv_pct - ucfg.meta_investimento

    # --- Breakdown ---
    if not df_mo.empty:
        cat_grp = df_mo[
            (df_mo["Tipo"] == CFG.TIPO_SAIDA) &
            (df_mo["Categoria"] != CFG.CAT_INVESTIMENTO)
        ].groupby("Categoria")["Valor"].sum()

        if not cat_grp.empty:
            m.top_cat = cat_grp.idxmax()
            m.top_cat_val = cat_grp.max()
            m.cat_breakdown = cat_grp.sort_values(ascending=False).to_dict()

        top_row = df_mo[
            (df_mo["Tipo"] == CFG.TIPO_SAIDA) &
            (df_mo["Categoria"] != CFG.CAT_INVESTIMENTO)
        ].nlargest(1, "Valor")
        if not top_row.empty:
            m.top_gasto_desc = str(top_row["Descricao"].values[0])
            m.top_gasto_val = float(top_row["Valor"].values[0])

        renda_grp = df_mo[df_mo["Tipo"] == CFG.TIPO_ENTRADA].groupby("Categoria")["Valor"].sum()
        if not renda_grp.empty:
            m.renda_breakdown = renda_grp.sort_values(ascending=False).to_dict()

        # --- Top 5 Gastos ---
        top5_df = df_mo[
            (df_mo["Tipo"] == CFG.TIPO_SAIDA) &
            (df_mo["Categoria"] != CFG.CAT_INVESTIMENTO)
        ].nlargest(5, "Valor")
        m.top5_gastos = [
            {"desc": str(r["Descricao"]), "valor": float(r["Valor"]), "cat": str(r["Categoria"])}
            for _, r in top5_df.iterrows()
        ]

        # --- Split Casal ---
        if user_filter == "Casal":
            for resp_name in CFG.RESPONSAVEIS:
                resp_total = df_mo[
                    (df_mo["Tipo"] == CFG.TIPO_SAIDA) &
                    (df_mo["Categoria"] != CFG.CAT_INVESTIMENTO) &
                    (df_mo["Responsavel"] == resp_name)
                ]["Valor"].sum()
                if resp_total > 0:
                    m.split_gastos[resp_name] = resp_total

            # --- Split Renda Casal ---
            for resp_name in CFG.RESPONSAVEIS:
                resp_renda = df_mo[
                    (df_mo["Tipo"] == CFG.TIPO_ENTRADA) &
                    (df_mo["Responsavel"] == resp_name)
                ]["Valor"].sum()
                if resp_renda > 0:
                    m.split_renda[resp_name] = resp_renda

    # --- Ticket Médio ---
    m.ticket_medio = m.lifestyle / m.month_saidas if m.month_saidas > 0 else 0.0

    # --- Dia mais caro ---
    if not df_mo.empty:
        _despesas_dia = df_mo[
            (df_mo["Tipo"] == CFG.TIPO_SAIDA) &
            (df_mo["Categoria"] != CFG.CAT_INVESTIMENTO)
        ].copy()
        if not _despesas_dia.empty:
            _despesas_dia["_dia"] = _despesas_dia["Data"].dt.day
            _dia_agg = _despesas_dia.groupby("_dia")["Valor"].agg(["sum", "count"])
            _idx_max = _dia_agg["sum"].idxmax()
            m.dia_mais_caro = int(_idx_max)
            m.dia_mais_caro_val = float(_dia_agg.loc[_idx_max, "sum"])
            m.dia_mais_caro_count = int(_dia_agg.loc[_idx_max, "count"])

    # --- Health ---
    m.health = _compute_health(m)

    # --- Comparativo ---
    prev_mo = target_month - 1 if target_month > 1 else 12
    prev_yr = target_year if target_month > 1 else target_year - 1
    df_prev = filter_by_month(df_t, prev_mo, prev_yr)

    if not df_prev.empty:
        prev_renda = df_prev[df_prev["Tipo"] == CFG.TIPO_ENTRADA]["Valor"].sum()
        prev_lifestyle = df_prev[
            (df_prev["Tipo"] == CFG.TIPO_SAIDA) &
            (df_prev["Categoria"] != CFG.CAT_INVESTIMENTO)
        ]["Valor"].sum()
        prev_investido = df_prev[
            (df_prev["Tipo"] == CFG.TIPO_SAIDA) &
            (df_prev["Categoria"] == CFG.CAT_INVESTIMENTO)
        ]["Valor"].sum()
        prev_disponivel = prev_renda - prev_lifestyle - prev_investido
        m.d_renda = calc_delta(m.renda, prev_renda)
        m.d_lifestyle = calc_delta(m.lifestyle, prev_lifestyle)
        m.d_investido = calc_delta(m.investido_mes, prev_investido)
        m.d_disponivel = calc_delta(m.disponivel, prev_disponivel)
        m.prev_renda = prev_renda
        m.prev_lifestyle = prev_lifestyle
        m.prev_investido = prev_investido
        m.prev_disponivel = prev_disponivel

    # --- Insights ---
    if m.lifestyle > 0:
        m.insight_ls = (
            f"Impacto: <strong>{sanitize(m.top_cat)}</strong> "
            f"({fmt_brl(m.top_cat_val)})<br>"
            f"Maior gasto: <em>{sanitize(m.top_gasto_desc)}</em> "
            f"({fmt_brl(m.top_gasto_val)})"
        )
    else:
        m.insight_ls = "Sem registros de consumo este mês."

    if m.renda > 0:
        m.insight_renda = f"Gerado: <strong>{fmt_brl(m.renda)}</strong> este mês."
    else:
        m.insight_renda = "Nenhuma entrada registrada."

    return m


def _compute_health(m: MonthMetrics) -> str:
    """Classifica saúde financeira do mês."""
    if m.renda == 0:
        return "neutral"
    score = 0
    if m.disponivel > 0:
        score += 1
    if m.investido_mes > 0:
        score += 1
    if m.renda > 0 and (m.lifestyle / m.renda) < 0.8:
        score += 1
    if abs(m.nec_delta) <= 15 and abs(m.des_delta) <= 15:
        score += 1
    if score >= 4:
        return "excellent"
    elif score >= 3:
        return "good"
    elif score >= 2:
        return "warning"
    return "danger"


def compute_score(mx: MonthMetrics) -> dict:
    """Calcula score financeiro de 0-100 com breakdown."""
    ucfg: UserConfig = mx.user_config
    details: list[tuple[str, float, int]] = []
    score = 0.0

    # 1. Aderência 50/30/20 (25 pts)
    if mx.renda > 0:
        avg_diff = (abs(mx.nec_delta) + abs(mx.des_delta) + abs(mx.inv_delta)) / 3
        regra_pts = max(0.0, 25.0 - avg_diff)
        score += regra_pts
        details.append(("Regra 50/30/20", regra_pts, 25))
    else:
        details.append(("Regra 50/30/20", 0.0, 25))

    # 2. Taxa de Aporte (25 pts)
    if mx.renda > 0:
        aporte_pts = min(25.0, (mx.taxa_aporte / ucfg.meta_investimento) * 25)
        score += aporte_pts
        details.append(("Taxa de Aporte", aporte_pts, 25))
    else:
        details.append(("Taxa de Aporte", 0.0, 25))

    # 3. Autonomia (25 pts)
    autonomia = mx.autonomia
    if autonomia >= 999:
        auto_pts = 25.0
    else:
        auto_pts = min(25.0, (autonomia / ucfg.autonomia_alvo) * 25)
    score += auto_pts
    details.append(("Autonomia", auto_pts, 25))

    # 4. Saldo Mensal (25 pts)
    if mx.renda > 0:
        if mx.disponivel > 0:
            ratio = mx.disponivel / mx.renda
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

    renda = df_year[df_year["Tipo"] == CFG.TIPO_ENTRADA]["Valor"].sum()
    gastos = df_year[
        (df_year["Tipo"] == CFG.TIPO_SAIDA) &
        (df_year["Categoria"] != CFG.CAT_INVESTIMENTO)
    ]["Valor"].sum()
    investido = df_year[
        (df_year["Tipo"] == CFG.TIPO_SAIDA) &
        (df_year["Categoria"] == CFG.CAT_INVESTIMENTO)
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

    df_saidas = df_range[df_range["Tipo"] == CFG.TIPO_SAIDA].copy()

    def classify(cat: str) -> str:
        if cat in CFG.NECESSIDADES:
            return "necessidades"
        if cat == CFG.CAT_INVESTIMENTO:
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

    df_entradas = df_range[df_range["Tipo"] == CFG.TIPO_ENTRADA].copy()
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
        (df["Tipo"] == CFG.TIPO_ENTRADA)
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

def compute_yoy(
    df_trans: pd.DataFrame,
    user_filter: str,
    month: int,
    year: int,
) -> dict | None:
    """Compara o mesmo mês no ano atual vs ano anterior."""
    df = filter_by_user(df_trans, user_filter)
    if df.empty:
        return None

    prev_year = year - 1

    def _month_data(y: int) -> dict:
        df_m = filter_by_month(df, month, y)
        if df_m.empty:
            return {"renda": 0, "gastos": 0, "investido": 0, "saldo": 0, "tx_count": 0}
        renda = df_m[df_m["Tipo"] == CFG.TIPO_ENTRADA]["Valor"].sum()
        gastos = df_m[
            (df_m["Tipo"] == CFG.TIPO_SAIDA) &
            (df_m["Categoria"] != CFG.CAT_INVESTIMENTO)
        ]["Valor"].sum()
        investido = df_m[
            (df_m["Tipo"] == CFG.TIPO_SAIDA) &
            (df_m["Categoria"] == CFG.CAT_INVESTIMENTO)
        ]["Valor"].sum()
        return {
            "renda": renda,
            "gastos": gastos,
            "investido": investido,
            "saldo": renda - gastos - investido,
            "tx_count": len(df_m),
        }

    curr = _month_data(year)
    prev = _month_data(prev_year)

    if prev["tx_count"] == 0:
        return None

    return {
        "month": month,
        "curr_year": year,
        "prev_year": prev_year,
        "curr": curr,
        "prev": prev,
        "d_renda": calc_delta(curr["renda"], prev["renda"]),
        "d_gastos": calc_delta(curr["gastos"], prev["gastos"]),
        "d_investido": calc_delta(curr["investido"], prev["investido"]),
        "d_saldo": calc_delta(curr["saldo"], prev["saldo"]),
    }

def compute_patrimonio_evolution(
    df_trans: pd.DataFrame,
    df_assets: pd.DataFrame,
    user_filter: str,
    ref_month: int,
    ref_year: int,
    months_back: int = CFG.MESES_EVOLUCAO,
) -> list[dict]:
    """Calcula evolução patrimonial mês a mês.

    Patrimônio em cada mês = Base patrimonial (ativos estáticos)
    + Investimentos acumulados até aquele mês.
    Não requer coluna Data no Patrimônio — usa dados já existentes.
    """
    df = filter_by_user(df_trans, user_filter)
    df_a = filter_by_user(df_assets, user_filter, include_shared=True)
    base_pat = df_a["Valor"].sum() if not df_a.empty else 0.0

    if df.empty and base_pat == 0:
        return []

    # Construir lista de períodos
    periods = []
    mo, yr = ref_month, ref_year
    for _ in range(months_back - 1):
        mo -= 1
        if mo == 0:
            mo, yr = 12, yr - 1
    for _ in range(months_back):
        periods.append((mo, yr))
        mo += 1
        if mo > 12:
            mo, yr = 1, yr + 1

    # Investimentos acumulados
    df_inv = df[
        (df["Tipo"] == CFG.TIPO_SAIDA) &
        (df["Categoria"] == CFG.CAT_INVESTIMENTO)
    ].copy() if not df.empty else pd.DataFrame()

    data = []
    for p_mo, p_yr in periods:
        eom = end_of_month(p_yr, p_mo)
        if not df_inv.empty:
            inv_acum = df_inv[df_inv["Data"] <= eom]["Valor"].sum()
        else:
            inv_acum = 0.0

        patrimonio_total = base_pat + inv_acum

        # Gastos do mês (para calcular variação)
        df_mes = filter_by_month(df, p_mo, p_yr) if not df.empty else pd.DataFrame()
        inv_mes = 0.0
        if not df_mes.empty:
            inv_mes = df_mes[
                (df_mes["Tipo"] == CFG.TIPO_SAIDA) &
                (df_mes["Categoria"] == CFG.CAT_INVESTIMENTO)
            ]["Valor"].sum()

        data.append({
            "label": f"{MESES_PT[p_mo]}/{p_yr}",
            "patrimonio": patrimonio_total,
            "base": base_pat,
            "investido_acum": inv_acum,
            "aporte_mes": inv_mes,
        })

    return data

def compute_cashflow_forecast(
    df_trans: pd.DataFrame,
    df_recorrentes: pd.DataFrame,
    user_filter: str,
    ref_month: int,
    ref_year: int,
    months_ahead: int = 3,
) -> list[dict] | None:
    """Forecast de cashflow para os próximos N meses.

    Combina recorrentes ativas (baseline fixa) com média de gastos
    variáveis dos últimos 3 meses para projetar saldo futuro.
    """
    df = filter_by_user(df_trans, user_filter)

    # --- Recorrentes ativas (baseline fixa) ---
    df_rec = filter_by_user(df_recorrentes, user_filter, include_shared=True)
    renda_fixa = 0.0
    gastos_fixos = 0.0
    inv_fixo = 0.0

    if not df_rec.empty:
        df_ativas = df_rec[df_rec["Ativo"].eq(True)]
        renda_fixa = df_ativas[
            df_ativas["Tipo"] == CFG.TIPO_ENTRADA
        ]["Valor"].sum()
        gastos_fixos = df_ativas[
            (df_ativas["Tipo"] == CFG.TIPO_SAIDA) &
            (df_ativas["Categoria"] != CFG.CAT_INVESTIMENTO)
        ]["Valor"].sum()
        inv_fixo = df_ativas[
            (df_ativas["Tipo"] == CFG.TIPO_SAIDA) &
            (df_ativas["Categoria"] == CFG.CAT_INVESTIMENTO)
        ]["Valor"].sum()

    # --- Média variável dos últimos 3 meses ---
    renda_var_total = 0.0
    gastos_var_total = 0.0
    inv_var_total = 0.0
    months_with_data = 0

    mo, yr = ref_month, ref_year
    for _ in range(3):
        df_m = filter_by_month(df, mo, yr)
        if not df_m.empty:
            months_with_data += 1
            renda_mes = df_m[
                df_m["Tipo"] == CFG.TIPO_ENTRADA
            ]["Valor"].sum()
            gastos_mes = df_m[
                (df_m["Tipo"] == CFG.TIPO_SAIDA) &
                (df_m["Categoria"] != CFG.CAT_INVESTIMENTO)
            ]["Valor"].sum()
            inv_mes = df_m[
                (df_m["Tipo"] == CFG.TIPO_SAIDA) &
                (df_m["Categoria"] == CFG.CAT_INVESTIMENTO)
            ]["Valor"].sum()
            renda_var_total += max(0, renda_mes - renda_fixa)
            gastos_var_total += max(0, gastos_mes - gastos_fixos)
            inv_var_total += max(0, inv_mes - inv_fixo)
        mo -= 1
        if mo == 0:
            mo, yr = 12, yr - 1

    if months_with_data == 0 and renda_fixa == 0 and gastos_fixos == 0 and inv_fixo == 0:
        return None

    divisor = max(1, months_with_data)
    avg_renda_var = renda_var_total / divisor
    avg_gastos_var = gastos_var_total / divisor
    avg_inv_var = inv_var_total / divisor

    # --- Projetar próximos N meses ---
    forecast: list[dict] = []
    saldo_acum = 0.0
    mo, yr = ref_month, ref_year

    for _ in range(months_ahead):
        mo += 1
        if mo > 12:
            mo, yr = 1, yr + 1

        renda_proj = renda_fixa + avg_renda_var
        gastos_proj = gastos_fixos + avg_gastos_var
        inv_proj = inv_fixo + avg_inv_var
        saldo = renda_proj - gastos_proj - inv_proj
        saldo_acum += saldo

        forecast.append({
            "label": f"{MESES_PT[mo]}/{yr}",
            "renda": renda_proj,
            "gastos": gastos_proj,
            "investimento": inv_proj,
            "saldo": saldo,
            "saldo_acumulado": saldo_acum,
            "deficit": saldo < 0,
            "renda_fixa": renda_fixa,
            "renda_variavel": avg_renda_var,
            "gastos_fixos": gastos_fixos,
            "gastos_variaveis": avg_gastos_var,
        })

    return forecast


def compute_divisao_casal(df_month: pd.DataFrame) -> dict | None:
    """Calcula divisão justa de despesas entre o casal.

    Lógica:
    - Gastos com Responsavel individual → cada um paga o seu
    - Gastos com Responsavel 'Casal' → divididos 50/50
    - Cota justa = individual + metade do compartilhado
    - Diferença indica quem deve a quem para equilibrar
    """
    if df_month.empty:
        return None

    gastos = df_month[
        (df_month["Tipo"] == CFG.TIPO_SAIDA) &
        (df_month["Categoria"] != CFG.CAT_INVESTIMENTO)
    ]
    if gastos.empty:
        return None

    individuais = [r for r in CFG.RESPONSAVEIS if r != "Casal"]
    if len(individuais) != 2:
        return None

    pessoa_a, pessoa_b = individuais[0], individuais[1]

    a_ind = gastos[gastos["Responsavel"] == pessoa_a]["Valor"].sum()
    b_ind = gastos[gastos["Responsavel"] == pessoa_b]["Valor"].sum()
    casal_total = gastos[gastos["Responsavel"] == "Casal"]["Valor"].sum()
    total = a_ind + b_ind + casal_total

    if total == 0:
        return None

    metade = casal_total / 2
    a_justo = a_ind + metade
    b_justo = b_ind + metade
    diferenca = a_justo - b_justo

    return {
        "pessoas": (pessoa_a, pessoa_b),
        "individual": {pessoa_a: a_ind, pessoa_b: b_ind},
        "casal_compartilhado": casal_total,
        "metade_compartilhado": metade,
        "cota_justa": {pessoa_a: a_justo, pessoa_b: b_justo},
        "total_geral": total,
        "diferenca": abs(diferenca),
        "quem_deve": pessoa_b if diferenca > 0 else (pessoa_a if diferenca < 0 else None),
        "quem_recebe": pessoa_a if diferenca > 0 else (pessoa_b if diferenca < 0 else None),
        "equilibrado": abs(diferenca) < 1.0,
    }



def compute_weekday_pattern(df_month: pd.DataFrame) -> dict | None:
    """Calcula padrão de gastos por dia da semana."""
    if df_month.empty:
        return None

    despesas = df_month[
        (df_month["Tipo"] == CFG.TIPO_SAIDA) &
        (df_month["Categoria"] != CFG.CAT_INVESTIMENTO)
    ].copy()

    if despesas.empty:
        return None

    despesas["_wd"] = despesas["Data"].dt.dayofweek
    _DIAS_PT = {0: "Seg", 1: "Ter", 2: "Qua", 3: "Qui", 4: "Sex", 5: "Sáb", 6: "Dom"}

    agg = despesas.groupby("_wd")["Valor"].agg(["sum", "count"])

    result: dict = {"dias": [], "max_val": 0.0}
    for d in range(7):
        if d in agg.index:
            val = float(agg.loc[d, "sum"])
            count = int(agg.loc[d, "count"])
        else:
            val, count = 0.0, 0
        result["dias"].append({"dia": _DIAS_PT[d], "total": val, "count": count})
        result["max_val"] = max(result["max_val"], val)

    dias_ativos = [x for x in result["dias"] if x["total"] > 0]
    if dias_ativos:
        result["mais_caro"] = max(dias_ativos, key=lambda x: x["total"])
        result["mais_leve"] = min(dias_ativos, key=lambda x: x["total"])

    return result


def compute_tag_summary(
    df_trans: pd.DataFrame,
    user_filter: str,
    ref_month: int,
    ref_year: int,
) -> list[dict]:
    """Análise transversal por tags nos últimos 6 meses."""
    df = filter_by_user(df_trans, user_filter)
    if df.empty or "Tag" not in df.columns:
        return []

    df_tagged = df[df["Tag"].str.strip() != ""].copy()
    if df_tagged.empty:
        return []

    ref_end = end_of_month(ref_year, ref_month)
    mo, yr = ref_month, ref_year
    for _ in range(5):
        mo -= 1
        if mo == 0:
            mo, yr = 12, yr - 1
    start_date = datetime(yr, mo, 1)
    df_tagged = df_tagged[
        (df_tagged["Data"] >= start_date) & (df_tagged["Data"] <= ref_end)
    ]

    if df_tagged.empty:
        return []

    results: list[dict] = []
    for tag, group in df_tagged.groupby("Tag"):
        tag_str = str(tag).strip()
        if not tag_str:
            continue
        gastos = group[
            (group["Tipo"] == CFG.TIPO_SAIDA) &
            (group["Categoria"] != CFG.CAT_INVESTIMENTO)
        ]["Valor"].sum()
        entradas = group[group["Tipo"] == CFG.TIPO_ENTRADA]["Valor"].sum()
        results.append({
            "tag": tag_str,
            "gastos": gastos,
            "entradas": entradas,
            "n_transacoes": len(group),
            "n_meses": group["Data"].dt.to_period("M").nunique(),
        })

    results.sort(key=lambda x: x["gastos"], reverse=True)
    return results[:10]


def compute_category_sparklines(
    df_trans: pd.DataFrame,
    user_filter: str,
    ref_month: int,
    ref_year: int,
    months_back: int = 6,
) -> dict[str, list[float]]:
    """Calcula sparkline por categoria: totais mensais dos últimos N meses (I4)."""
    df = filter_by_user(df_trans, user_filter)
    if df.empty:
        return {}

    ref_end = end_of_month(ref_year, ref_month)
    mo, yr = ref_month, ref_year
    for _ in range(months_back - 1):
        mo -= 1
        if mo == 0:
            mo, yr = 12, yr - 1
    start_date = datetime(yr, mo, 1)

    df_range = df[
        (df["Data"] >= start_date)
        & (df["Data"] <= ref_end)
        & (df["Tipo"] == CFG.TIPO_SAIDA)
        & (df["Categoria"] != CFG.CAT_INVESTIMENTO)
    ].copy()

    if df_range.empty:
        return {}

    df_range["_period"] = df_range["Data"].dt.to_period("M")
    all_periods = sorted(df_range["_period"].unique())

    result: dict[str, list[float]] = {}
    for cat, grp in df_range.groupby("Categoria"):
        cat_by_period = grp.groupby("_period")["Valor"].sum()
        values = [float(cat_by_period.get(p, 0)) for p in all_periods]
        result[str(cat)] = values

    return result


def _sparkline_html(values: list[float]) -> str:
    """Gera sparkline unicode a partir de valores mensais."""
    if not values or all(v == 0 for v in values):
        return ""
    blocks = "▁▂▃▄▅▆▇█"
    max_v = max(values)
    if max_v == 0:
        return ""
    chars = []
    for v in values:
        idx = int((v / max_v) * 7)
        idx = min(7, max(0, idx))
        chars.append(blocks[idx])
    spark = "".join(chars)

    first_half = values[: len(values) // 2]
    second_half = values[len(values) // 2 :]
    avg_first = sum(first_half) / max(1, len(first_half))
    avg_second = sum(second_half) / max(1, len(second_half))
    if avg_first > 0:
        trend_pct = ((avg_second - avg_first) / avg_first) * 100
        if trend_pct > 10:
            trend = f' <span style="color:#FF4444;">▲</span>'
        elif trend_pct < -10:
            trend = f' <span style="color:#00FFCC;">▼</span>'
        else:
            trend = ""
    else:
        trend = ""

    return (
        f'<span style="font-size:0.55rem;letter-spacing:1px;color:#555;">'
        f'{spark}</span>{trend}'
    )


def compute_savings_rate(
    df_trans: pd.DataFrame,
    user_filter: str,
    ref_month: int,
    ref_year: int,
    months_back: int = CFG.MESES_EVOLUCAO,
) -> list[dict]:
    """Calcula taxa de poupança mensal: (renda − gastos) / renda × 100."""
    df = filter_by_user(df_trans, user_filter)
    if df.empty:
        return []

    mo, yr = ref_month, ref_year
    for _ in range(months_back - 1):
        mo -= 1
        if mo == 0:
            mo, yr = 12, yr - 1

    data: list[dict] = []
    for _ in range(months_back):
        df_m = filter_by_month(df, mo, yr)
        renda, gastos = 0.0, 0.0
        if not df_m.empty:
            renda = df_m[df_m["Tipo"] == CFG.TIPO_ENTRADA]["Valor"].sum()
            gastos = df_m[
                (df_m["Tipo"] == CFG.TIPO_SAIDA) &
                (df_m["Categoria"] != CFG.CAT_INVESTIMENTO)
            ]["Valor"].sum()
        rate = ((renda - gastos) / renda * 100) if renda > 0 else 0.0
        data.append({
            "label": f"{MESES_PT[mo]}/{yr}",
            "renda": renda,
            "gastos": gastos,
            "poupanca": max(0, renda - gastos),
            "rate": rate,
            "has_data": renda > 0,
        })
        mo += 1
        if mo > 12:
            mo, yr = 1, yr + 1

    return data


def compute_consistency(
    df_trans: pd.DataFrame,
    user_filter: str,
    ref_month: int,
    ref_year: int,
    months_back: int = CFG.MESES_EVOLUCAO,
    user_config: UserConfig | None = None,
) -> dict | None:
    """Calcula índice de consistência: em quantos meses atingiu as metas."""
    ucfg = user_config or UserConfig()
    df = filter_by_user(df_trans, user_filter)
    if df.empty:
        return None

    months_aporte_ok = 0
    months_saldo_ok = 0
    months_with_data = 0

    mo, yr = ref_month, ref_year
    for _ in range(months_back):
        df_m = filter_by_month(df, mo, yr)
        if not df_m.empty:
            renda = df_m[df_m["Tipo"] == CFG.TIPO_ENTRADA]["Valor"].sum()
            if renda > 0:
                months_with_data += 1
                investido = df_m[
                    (df_m["Tipo"] == CFG.TIPO_SAIDA) &
                    (df_m["Categoria"] == CFG.CAT_INVESTIMENTO)
                ]["Valor"].sum()
                gastos = df_m[
                    (df_m["Tipo"] == CFG.TIPO_SAIDA) &
                    (df_m["Categoria"] != CFG.CAT_INVESTIMENTO)
                ]["Valor"].sum()
                if (investido / renda * 100) >= ucfg.meta_investimento:
                    months_aporte_ok += 1
                if (renda - gastos - investido) >= 0:
                    months_saldo_ok += 1
        mo -= 1
        if mo == 0:
            mo, yr = 12, yr - 1

    if months_with_data == 0:
        return None

    return {
        "months_analyzed": months_with_data,
        "aporte_ok": months_aporte_ok,
        "aporte_pct": (months_aporte_ok / months_with_data) * 100,
        "saldo_ok": months_saldo_ok,
        "saldo_pct": (months_saldo_ok / months_with_data) * 100,
        "overall_pct": ((months_aporte_ok + months_saldo_ok) / (months_with_data * 2)) * 100,
    }


def compute_anomalies(
    df_trans: pd.DataFrame,
    user_filter: str,
    target_month: int,
    target_year: int,
    threshold: float = 2.0,
    months_back: int = 3,
) -> list[dict]:
    """Detecta gastos anômalos por categoria vs média histórica (I2)."""
    df = filter_by_user(df_trans, user_filter)
    if df.empty:
        return []

    df_mo = filter_by_month(df, target_month, target_year)
    if df_mo.empty:
        return []

    curr_cats = df_mo[
        (df_mo["Tipo"] == CFG.TIPO_SAIDA)
        & (df_mo["Categoria"] != CFG.CAT_INVESTIMENTO)
    ].groupby("Categoria")["Valor"].sum()

    if curr_cats.empty:
        return []

    hist_totals: dict[str, list[float]] = {}
    mo, yr = target_month, target_year
    for _ in range(months_back):
        mo -= 1
        if mo == 0:
            mo, yr = 12, yr - 1
        df_hist = filter_by_month(df, mo, yr)
        if not df_hist.empty:
            cat_sums = df_hist[
                (df_hist["Tipo"] == CFG.TIPO_SAIDA)
                & (df_hist["Categoria"] != CFG.CAT_INVESTIMENTO)
            ].groupby("Categoria")["Valor"].sum()
            for cat, val in cat_sums.items():
                hist_totals.setdefault(cat, []).append(val)

    if not hist_totals:
        return []

    anomalies: list[dict] = []
    for cat, curr_val in curr_cats.items():
        hist = hist_totals.get(cat, [])
        if not hist:
            continue
        avg = sum(hist) / len(hist)
        if avg > 0 and curr_val > avg * threshold:
            anomalies.append({
                "categoria": str(cat),
                "valor_atual": curr_val,
                "media_historica": avg,
                "ratio": curr_val / avg,
                "excedente": curr_val - avg,
            })

    anomalies.sort(key=lambda x: x["ratio"], reverse=True)
    return anomalies


def compute_calendar_heatmap(
    df_month: pd.DataFrame, month: int, year: int,
) -> dict | None:
    """Computa dados para heatmap calendário de gastos diários (V5)."""
    if df_month.empty:
        return None

    despesas = df_month[
        (df_month["Tipo"] == CFG.TIPO_SAIDA)
        & (df_month["Categoria"] != CFG.CAT_INVESTIMENTO)
    ].copy()

    days_in_month = calendar.monthrange(year, month)[1]
    first_weekday = date(year, month, 1).weekday()

    daily: dict[int, float] = {}
    daily_count: dict[int, int] = {}
    if not despesas.empty:
        despesas["_dia"] = despesas["Data"].dt.day
        for d, grp in despesas.groupby("_dia"):
            daily[int(d)] = grp["Valor"].sum()
            daily_count[int(d)] = len(grp)

    max_val = max(daily.values()) if daily else 0.0
    total = sum(daily.values()) if daily else 0.0
    dias_com_gasto = len(daily)
    dias_sem_gasto = days_in_month - dias_com_gasto

    dia_pesado, dia_pesado_val, dia_pesado_count = 0, 0.0, 0
    if daily:
        dia_pesado = max(daily, key=daily.get)
        dia_pesado_val = daily[dia_pesado]
        dia_pesado_count = daily_count.get(dia_pesado, 0)

    return {
        "month": month,
        "year": year,
        "days_in_month": days_in_month,
        "first_weekday": first_weekday,
        "daily": daily,
        "daily_count": daily_count,
        "max_val": max_val,
        "total": total,
        "dias_sem_gasto": dias_sem_gasto,
        "media_diaria": total / max(1, dias_com_gasto),
        "dia_pesado": dia_pesado,
        "dia_pesado_val": dia_pesado_val,
        "dia_pesado_count": dia_pesado_count,
    }


def compute_frequent_transactions(
    df_trans: pd.DataFrame,
    user_filter: str,
    n: int = 5,
    months_back: int = 3,
) -> list[dict]:
    """Identifica transações frequentes para templates rápidos (N2)."""
    df = filter_by_user(df_trans, user_filter)
    if df.empty:
        return []

    now = datetime.now()
    mo, yr = now.month, now.year
    for _ in range(months_back - 1):
        mo -= 1
        if mo == 0:
            mo, yr = 12, yr - 1
    start_date = datetime(yr, mo, 1)

    df_range = df[
        (df["Data"] >= start_date)
        & (df["Data"] <= now)
        & (df["Tipo"] == CFG.TIPO_SAIDA)
        & (df["Categoria"] != CFG.CAT_INVESTIMENTO)
    ].copy()

    if df_range.empty:
        return []

    groups = (
        df_range.groupby(["Descricao", "Categoria", "Responsavel"])
        .agg(count=("Valor", "count"), avg_valor=("Valor", "mean"), last_valor=("Valor", "last"))
        .reset_index()
    )
    groups = groups[groups["count"] >= 2].sort_values("count", ascending=False).head(n)

    return [
        {
            "desc": str(row["Descricao"]),
            "cat": str(row["Categoria"]),
            "resp": str(row["Responsavel"]),
            "count": int(row["count"]),
            "avg_valor": float(row["avg_valor"]),
            "last_valor": float(row["last_valor"]),
        }
        for _, row in groups.iterrows()
    ]

def compute_meta_progress(
    df_metas: pd.DataFrame, user_filter: str,
) -> list[dict]:
    """Calcula progresso de cada meta ativa (G1)."""
    df = filter_by_user(df_metas, user_filter, include_shared=True)
    if df.empty:
        return []

    now = datetime.now()
    results: list[dict] = []

    for _, row in df[df["Ativo"].eq(True)].iterrows():
        nome = str(row.get("Nome", "")).strip()
        alvo = float(row.get("ValorAlvo", 0))
        atual = float(row.get("ValorAtual", 0))
        prazo_str = str(row.get("Prazo", "")).strip()

        if alvo <= 0 or not nome:
            continue

        pct = (atual / alvo) * 100
        restante = max(0, alvo - atual)

        prazo_date = None
        months_remaining = None
        monthly_needed = None

        if prazo_str and prazo_str not in ("", "nan", "None"):
            try:
                if len(prazo_str) == 7 and prazo_str[4] == "-":
                    prazo_date = datetime(int(prazo_str[:4]), int(prazo_str[5:7]), 28)
                elif len(prazo_str) >= 10:
                    prazo_date = datetime.strptime(prazo_str[:10], "%Y-%m-%d")
            except (ValueError, IndexError):
                pass

        if prazo_date:
            delta = (prazo_date.year - now.year) * 12 + (prazo_date.month - now.month)
            months_remaining = max(0, delta)
            if months_remaining > 0 and restante > 0:
                monthly_needed = restante / months_remaining

        if pct >= 100:
            status = "achieved"
        elif prazo_date and prazo_date < now:
            status = "overdue"
        else:
            status = "active"

        results.append({
            "id": str(row.get("Id", "")),
            "nome": nome,
            "alvo": alvo,
            "atual": atual,
            "pct": min(100, pct),
            "restante": restante,
            "prazo": prazo_str if prazo_str not in ("nan", "None") else "",
            "prazo_date": prazo_date,
            "months_remaining": months_remaining,
            "monthly_needed": monthly_needed,
            "status": status,
            "responsavel": str(row.get("Responsavel", "")),
        })

    results.sort(key=lambda x: x["pct"], reverse=True)
    return results


def compute_challenges(mx: MonthMetrics) -> list[dict]:
    """Gera micro-desafios mensais baseados no perfil atual (G3)."""
    challenges: list[dict] = []
    if mx.renda <= 0:
        return challenges

    ucfg = mx.user_config

    # 1. Categoria mais cara — manter sob controle
    if mx.cat_breakdown:
        top_cat = list(mx.cat_breakdown.keys())[0]
        top_val = list(mx.cat_breakdown.values())[0]

        # Usar limite do orçamento se existir, senão 30% da renda
        _ch_target = None
        for _b in mx.budget_data:
            if _b["categoria"] == top_cat:
                _ch_target = _b["limite"]
                break

        if _ch_target and _ch_target > 0:
            _ch_progress = min(100, max(0, (1 - top_val / _ch_target) * 100))
            challenges.append({
                "title": f"Manter {top_cat} no orçamento",
                "desc": f"{fmt_brl(top_val)} / {fmt_brl(_ch_target)}",
                "progress": _ch_progress,
                "done": top_val <= _ch_target,
                "icon": "🎯",
            })
        elif mx.renda > 0:
            _ch_limit_pct = 30
            _ch_target_renda = mx.renda * _ch_limit_pct / 100
            _ch_progress = min(100, max(0, (1 - top_val / _ch_target_renda) * 100))
            challenges.append({
                "title": f"Manter {top_cat} abaixo de {_ch_limit_pct}% da renda",
                "desc": f"{fmt_brl(top_val)} / {fmt_brl(_ch_target_renda)} ({top_val / mx.renda * 100:.0f}%)",
                "progress": _ch_progress,
                "done": top_val <= _ch_target_renda,
                "icon": "🎯",
            })

    # 2. Taxa de poupança ≥ 20%
    savings_rate = ((mx.renda - mx.lifestyle) / mx.renda * 100) if mx.renda > 0 else 0
    target_rate = max(20, ucfg.meta_investimento)
    challenges.append({
        "title": f"Poupança acima de {target_rate:.0f}%",
        "desc": f"Atual: {savings_rate:.0f}%",
        "progress": min(100, max(0, savings_rate / target_rate * 100)) if target_rate > 0 else 0,
        "done": savings_rate >= target_rate,
        "icon": "💰",
    })

    # 3. Meta de aporte
    meta_inv = mx.renda * (ucfg.meta_investimento / 100)
    if meta_inv > 0:
        challenges.append({
            "title": f"Atingir aporte de {ucfg.meta_investimento}%",
            "desc": f"{fmt_brl(mx.investido_mes)} / {fmt_brl(meta_inv)}",
            "progress": min(100, max(0, mx.taxa_aporte / ucfg.meta_investimento * 100)),
            "done": mx.taxa_aporte >= ucfg.meta_investimento,
            "icon": "📈",
        })

    return challenges[:3]

# --- N1: CSV Import ---

_BANK_FORMATS: dict[str, dict] = {
    "Nubank": {
        "date_col": "data",
        "desc_col": "descrição",
        "value_col": "valor",
        "date_formats": ["%Y-%m-%d", "%d/%m/%Y"],
        "negative_is_expense": True,
    },
    "Inter": {
        "date_col": "data lançamento",
        "desc_col": "descrição",
        "value_col": "valor",
        "date_formats": ["%d/%m/%Y", "%Y-%m-%d"],
        "negative_is_expense": True,
    },
}

_AUTO_CAT_RULES: dict[str, list[str]] = {
    "Transporte": ["uber", "99", "taxi", "cabify", "combustivel", "gasolina", "estacionamento", "pedágio"],
    "Alimentação": ["mercado", "supermercado", "hortifruti", "padaria", "açougue", "ifood", "restaurante", "lanche"],
    "Moradia": ["aluguel", "condominio", "iptu", "luz", "energia", "agua", "gás"],
    "Saúde": ["farmacia", "drogaria", "medico", "hospital", "laboratorio", "consulta", "plano de saude"],
    "Lazer": ["cinema", "teatro", "bar", "cerveja", "viagem", "hotel", "ingresso"],
    "Assinaturas": ["netflix", "spotify", "amazon", "disney", "hbo", "youtube", "icloud", "apple"],
    "Educação": ["curso", "escola", "faculdade", "livro", "udemy", "alura"],
}


def _auto_categorize(desc: str) -> str:
    """Categoriza descrição automaticamente por keywords."""
    desc_lower = desc.lower()
    for cat, keywords in _AUTO_CAT_RULES.items():
        for kw in keywords:
            if kw in desc_lower:
                return cat
    return "Outros"


def _find_csv_col(cols_lower: dict[str, str], target: str) -> str | None:
    """Busca coluna no CSV por nome parcial case-insensitive."""
    target_l = target.lower()
    for key, original in cols_lower.items():
        if target_l in key:
            return original
    return None


def parse_bank_csv(
    uploaded_file, bank_format: str, responsavel: str,
) -> pd.DataFrame | None:
    """Parse CSV bancário em DataFrame de transações (N1)."""
    try:
        content = uploaded_file.read()
        uploaded_file.seek(0)
        df = None
        for enc in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
            try:
                df = pd.read_csv(BytesIO(content), encoding=enc)
                if df is not None and not df.empty:
                    break
            except Exception:
                continue
        if df is None or df.empty or len(df.columns) < 2:
            return None
    except Exception:
        return None

    cols_lower = {c.strip().lower(): c for c in df.columns}

    fmt = _BANK_FORMATS.get(bank_format)
    if fmt:
        date_col = _find_csv_col(cols_lower, fmt["date_col"])
        desc_col = _find_csv_col(cols_lower, fmt["desc_col"])
        value_col = _find_csv_col(cols_lower, fmt["value_col"])
        date_formats = fmt["date_formats"]
        neg_is_expense = fmt["negative_is_expense"]
    else:
        date_col = _find_csv_col(cols_lower, "data")
        desc_col = _find_csv_col(cols_lower, "descri")
        value_col = _find_csv_col(cols_lower, "valor")
        date_formats = ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"]
        neg_is_expense = True

    if not all([date_col, desc_col, value_col]):
        return None

    results: list[dict] = []
    for _, row in df.iterrows():
        desc = str(row[desc_col]).strip()
        if not desc or desc in ("nan", ""):
            continue

        val_raw = (
            str(row[value_col])
            .replace("R$", "").replace(" ", "")
            .replace(".", "").replace(",", ".").strip()
        )
        try:
            val = float(val_raw)
        except ValueError:
            continue

        if neg_is_expense:
            tipo = CFG.TIPO_SAIDA if val < 0 else CFG.TIPO_ENTRADA
        else:
            tipo = CFG.TIPO_SAIDA
        val = abs(val)
        if val == 0:
            continue

        date_str = str(row[date_col]).strip()[:10]
        parsed_date = None
        for dfmt in date_formats:
            try:
                parsed_date = datetime.strptime(date_str, dfmt).date()
                break
            except ValueError:
                continue
        if not parsed_date:
            continue

        cat = _auto_categorize(desc) if tipo == CFG.TIPO_SAIDA else "Extra"

        results.append({
            "Id": generate_id(),
            "Data": parsed_date,
            "Descricao": desc[: CFG.MAX_DESC_LENGTH],
            "Valor": round(val, 2),
            "Categoria": cat,
            "Tipo": tipo,
            "Responsavel": responsavel,
            "Origem": "CSV",
            "Tag": "",
        })

    return pd.DataFrame(results) if results else None
