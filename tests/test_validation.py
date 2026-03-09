"""Testes de validação de dados — Fase 3."""
from __future__ import annotations

from datetime import datetime, date, timedelta
import pytest

from conftest import app


# =========================================================================
# validate_transaction
# =========================================================================

class TestValidateTransaction:

    def test_valid_expense(self):
        entry = {
            "Data": date(2025, 1, 15),
            "Descricao": "Mercado",
            "Valor": 150.0,
            "Categoria": "Alimentação",
            "Tipo": "Saída",
            "Responsavel": "Casal",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is True
        assert err == ""

    def test_valid_income(self):
        entry = {
            "Data": date(2025, 1, 5),
            "Descricao": "Salário Janeiro",
            "Valor": 5000.0,
            "Categoria": "Salário",
            "Tipo": "Entrada",
            "Responsavel": "Luan",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is True

    def test_empty_description_fails(self):
        entry = {
            "Data": date(2025, 1, 15),
            "Descricao": "",
            "Valor": 100.0,
            "Categoria": "Alimentação",
            "Tipo": "Saída",
            "Responsavel": "Casal",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is False
        assert "Descrição" in err

    def test_whitespace_description_fails(self):
        entry = {
            "Data": date(2025, 1, 15),
            "Descricao": "   ",
            "Valor": 100.0,
            "Categoria": "Alimentação",
            "Tipo": "Saída",
            "Responsavel": "Casal",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is False

    def test_zero_value_fails(self):
        entry = {
            "Data": date(2025, 1, 15),
            "Descricao": "Teste",
            "Valor": 0,
            "Categoria": "Alimentação",
            "Tipo": "Saída",
            "Responsavel": "Casal",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is False
        assert "Valor" in err

    def test_negative_value_fails(self):
        entry = {
            "Data": date(2025, 1, 15),
            "Descricao": "Teste",
            "Valor": -50.0,
            "Categoria": "Alimentação",
            "Tipo": "Saída",
            "Responsavel": "Casal",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is False

    def test_invalid_type_fails(self):
        entry = {
            "Data": date(2025, 1, 15),
            "Descricao": "Teste",
            "Valor": 100.0,
            "Categoria": "Alimentação",
            "Tipo": "Invalido",
            "Responsavel": "Casal",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is False
        assert "Tipo" in err

    def test_invalid_category_for_expense_fails(self):
        entry = {
            "Data": date(2025, 1, 15),
            "Descricao": "Teste",
            "Valor": 100.0,
            "Categoria": "Salário",  # Salário não é categoria de Saída
            "Tipo": "Saída",
            "Responsavel": "Casal",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is False
        assert "Categoria" in err

    def test_invalid_category_for_income_fails(self):
        entry = {
            "Data": date(2025, 1, 15),
            "Descricao": "Teste",
            "Valor": 100.0,
            "Categoria": "Alimentação",  # Alimentação não é categoria de Entrada
            "Tipo": "Entrada",
            "Responsavel": "Casal",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is False

    def test_invalid_responsavel_fails(self):
        entry = {
            "Data": date(2025, 1, 15),
            "Descricao": "Teste",
            "Valor": 100.0,
            "Categoria": "Alimentação",
            "Tipo": "Saída",
            "Responsavel": "Maria",  # Não existe
        }
        ok, err = app.validate_transaction(entry)
        assert ok is False
        assert "Responsável" in err

    def test_future_date_over_30_days_fails(self):
        entry = {
            "Data": datetime.now() + timedelta(days=60),
            "Descricao": "Teste futuro",
            "Valor": 100.0,
            "Categoria": "Alimentação",
            "Tipo": "Saída",
            "Responsavel": "Casal",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is False
        assert "futuro" in err

    def test_date_before_2020_fails(self):
        entry = {
            "Data": date(2019, 12, 31),
            "Descricao": "Teste antigo",
            "Valor": 100.0,
            "Categoria": "Alimentação",
            "Tipo": "Saída",
            "Responsavel": "Casal",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is False
        assert "antiga" in err

    def test_description_too_long_fails(self):
        entry = {
            "Data": date(2025, 1, 15),
            "Descricao": "A" * 201,
            "Valor": 100.0,
            "Categoria": "Alimentação",
            "Tipo": "Saída",
            "Responsavel": "Casal",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is False
        assert "longa" in err

    def test_investimento_as_expense_is_valid(self):
        entry = {
            "Data": date(2025, 1, 15),
            "Descricao": "Tesouro Direto",
            "Valor": 500.0,
            "Categoria": "Investimento",
            "Tipo": "Saída",
            "Responsavel": "Casal",
        }
        ok, err = app.validate_transaction(entry)
        assert ok is True


# =========================================================================
# validate_asset
# =========================================================================

class TestValidateAsset:

    def test_valid_asset(self):
        entry = {"Item": "Imóvel", "Valor": 300000.0, "Responsavel": "Casal"}
        ok, err = app.validate_asset(entry)
        assert ok is True

    def test_empty_item_fails(self):
        entry = {"Item": "", "Valor": 300000.0, "Responsavel": "Casal"}
        ok, err = app.validate_asset(entry)
        assert ok is False

    def test_negative_asset_value_fails(self):
        entry = {"Item": "Carro", "Valor": -1000.0, "Responsavel": "Casal"}
        ok, err = app.validate_asset(entry)
        assert ok is False


# =========================================================================
# validate_recorrente
# =========================================================================

class TestValidateRecorrente:

    def test_valid_recorrente(self):
        entry = {
            "Descricao": "Aluguel",
            "Valor": 1500.0,
            "Categoria": "Moradia",
            "Tipo": "Saída",
            "Responsavel": "Casal",
            "DiaVencimento": 10,
        }
        ok, err = app.validate_recorrente(entry)
        assert ok is True

    def test_dia_vencimento_zero_fails(self):
        entry = {
            "Descricao": "Aluguel",
            "Valor": 1500.0,
            "Categoria": "Moradia",
            "Tipo": "Saída",
            "Responsavel": "Casal",
            "DiaVencimento": 0,
        }
        ok, err = app.validate_recorrente(entry)
        assert ok is False

    def test_dia_vencimento_32_fails(self):
        entry = {
            "Descricao": "Aluguel",
            "Valor": 1500.0,
            "Categoria": "Moradia",
            "Tipo": "Saída",
            "Responsavel": "Casal",
            "DiaVencimento": 32,
        }
        ok, err = app.validate_recorrente(entry)
        assert ok is False
