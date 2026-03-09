"""Testes do motor analítico (métricas, score, health) — Fase 3."""
from __future__ import annotations

from datetime import datetime
import pandas as pd
import pytest

from conftest import app


# =========================================================================
# Utilitários
# =========================================================================

class TestFormatBrl:

    def test_positive_value(self):
        result = app.fmt_brl(1234.56)
        assert "1.234" in result
        assert "56" in result

    def test_zero(self):
        result = app.fmt_brl(0)
        assert "0" in result

    def test_negative_value(self):
        result = app.fmt_brl(-500.0)
        assert "-" in result
        assert "500" in result

    def test_large_value(self):
        result = app.fmt_brl(1000000.0)
        assert "1.000.000" in result


class TestFmtDate:

    def test_format(self):
        dt = datetime(2025, 1, 15)
        result = app.fmt_date(dt)
        assert "15" in result
        assert "2025" in result


class TestFmtMonthYear:

    def test_january(self):
        result = app.fmt_month_year(1, 2025)
        assert "Janeiro" in result
        assert "2025" in result

    def test_december(self):
        result = app.fmt_month_year(12, 2025)
        assert "Dezembro" in result


class TestCalcDelta:

    def test_increase(self):
        delta = app.calc_delta(150, 100)
        assert delta == pytest.approx(50.0)

    def test_decrease(self):
        delta = app.calc_delta(50, 100)
        assert delta == pytest.approx(-50.0)

    def test_zero_previous(self):
        delta = app.calc_delta(100, 0)
        assert delta is None or delta == float("inf")

    def test_same_value(self):
        delta = app.calc_delta(100, 100)
        assert delta == pytest.approx(0.0)


class TestIsFutureMonth:

    def test_current_month_is_not_future(self):
        now = datetime.now()
        assert app._is_future_month(now.month, now.year) is False

    def test_next_month_is_future(self):
        now = datetime.now()
        next_mo = now.month + 1
        next_yr = now.year
        if next_mo > 12:
            next_mo = 1
            next_yr += 1
        assert app._is_future_month(next_mo, next_yr) is True

    def test_past_month_is_not_future(self):
        assert app._is_future_month(1, 2020) is False


# =========================================================================
# compute_metrics
# =========================================================================

class TestComputeMetrics:

    def test_basic_metrics(self, sample_transactions, sample_assets):
        mx = app.compute_metrics(
            sample_transactions, sample_assets,
            user_filter="Casal", target_month=1, target_year=2025,
        )
        assert isinstance(mx, app.MonthMetrics)
        assert mx.renda > 0
        assert mx.lifestyle > 0

    def test_empty_month(self, empty_transactions, sample_assets):
        mx = app.compute_metrics(
            empty_transactions, sample_assets,
            user_filter="Casal", target_month=6, target_year=2025,
        )
        assert mx.renda == 0
        assert mx.lifestyle == 0
        assert mx.investido_mes == 0

    def test_user_filter_luan(self, sample_transactions, sample_assets):
        mx = app.compute_metrics(
            sample_transactions, sample_assets,
            user_filter="Luan", target_month=1, target_year=2025,
        )
        # Luan tem Salário (5000) como entrada
        assert mx.renda > 0

    def test_investimento_tracked(self, sample_transactions, sample_assets):
        mx = app.compute_metrics(
            sample_transactions, sample_assets,
            user_filter="Casal", target_month=1, target_year=2025,
        )
        assert mx.investido_mes > 0


# =========================================================================
# compute_score
# =========================================================================

class TestComputeScore:

    def test_score_range(self, sample_transactions, sample_assets):
        mx = app.compute_metrics(
            sample_transactions, sample_assets,
            user_filter="Casal", target_month=1, target_year=2025,
        )
        score_data = app.compute_score(mx)
        assert "score" in score_data
        assert 0 <= score_data["score"] <= 100

    def test_score_has_breakdown(self, sample_transactions, sample_assets):
        mx = app.compute_metrics(
            sample_transactions, sample_assets,
            user_filter="Casal", target_month=1, target_year=2025,
        )
        score_data = app.compute_score(mx)
        assert "details" in score_data
        assert len(score_data["details"]) > 0


# =========================================================================
# _compute_health
# =========================================================================

class TestComputeHealth:

    def test_health_values(self, sample_transactions, sample_assets):
        mx = app.compute_metrics(
            sample_transactions, sample_assets,
            user_filter="Casal", target_month=1, target_year=2025,
        )
        # health should be one of the valid statuses
        assert mx.health in ("excellent", "good", "neutral", "warning", "danger")


# =========================================================================
# filter_by_user
# =========================================================================

class TestFilterByUser:

    def test_filter_casal_includes_all(self, sample_transactions):
        result = app.filter_by_user(sample_transactions, "Casal")
        assert len(result) == len(sample_transactions)

    def test_filter_individual(self, sample_transactions):
        result = app.filter_by_user(sample_transactions, "Luan")
        assert len(result) < len(sample_transactions)
        assert all(r == "Luan" for r in result["Responsavel"])

    def test_filter_individual_with_shared(self, sample_transactions):
        result = app.filter_by_user(
            sample_transactions, "Luan", include_shared=True,
        )
        responsaveis = set(result["Responsavel"])
        assert "Luan" in responsaveis
        assert "Casal" in responsaveis
        assert "Luana" not in responsaveis


# =========================================================================
# filter_by_month
# =========================================================================

class TestFilterByMonth:

    def test_filter_correct_month(self, sample_transactions):
        result = app.filter_by_month(sample_transactions, 1, 2025)
        assert len(result) == len(sample_transactions)

    def test_filter_wrong_month(self, sample_transactions):
        result = app.filter_by_month(sample_transactions, 2, 2025)
        assert len(result) == 0


# =========================================================================
# compute_budget
# =========================================================================

class TestComputeBudget:

    def test_empty_budget(self):
        df_orc = pd.DataFrame(columns=["Categoria", "Limite", "Responsavel"])
        result = app.compute_budget(df_orc, {"Alimentação": 450.0}, "Casal")
        assert result == []

    def test_budget_calculation(self):
        df_orc = pd.DataFrame([
            {"Categoria": "Alimentação", "Limite": 500.0, "Responsavel": "Casal"},
        ])
        cat_breakdown = {"Alimentação": 450.0}
        result = app.compute_budget(df_orc, cat_breakdown, "Casal")
        assert len(result) == 1
        assert result[0]["gasto"] == 450.0
        assert result[0]["limite"] == 500.0
        assert result[0]["pct"] == pytest.approx(90.0)
