"""Fixtures compartilhados para testes do Family Wealth Manager."""
from __future__ import annotations

import sys
import os
from unittest.mock import MagicMock, patch
from datetime import datetime, date
from dataclasses import dataclass, field

import pandas as pd
import pytest


# ---------------------------------------------------------------------------
# Bloquear importação do Streamlit (não disponível em testes)
# ---------------------------------------------------------------------------
_mock_st = MagicMock()
_mock_st.secrets = MagicMock()
_mock_st.secrets.get = MagicMock(return_value={})
_mock_st.session_state = {}
_mock_st.cache_data = MagicMock()
_mock_st.set_page_config = MagicMock()
_mock_st.markdown = MagicMock()
_mock_st.columns = MagicMock(return_value=[MagicMock(), MagicMock(), MagicMock()])
_mock_st.form = MagicMock()
_mock_st.form_submit_button = MagicMock(return_value=False)
_mock_st.text_input = MagicMock(return_value="")
_mock_st.number_input = MagicMock(return_value=0.0)
_mock_st.selectbox = MagicMock(return_value="")
_mock_st.toast = MagicMock()
_mock_st.error = MagicMock()
_mock_st.warning = MagicMock()
_mock_st.rerun = MagicMock()
_mock_st.column_config = MagicMock()

# Mock streamlit.components.v1
_mock_stc = MagicMock()

sys.modules["streamlit"] = _mock_st
sys.modules["streamlit.components"] = MagicMock()
sys.modules["streamlit.components.v1"] = _mock_stc
sys.modules["streamlit_gsheets"] = MagicMock()

# Agora importar o app (com Streamlit mockado)
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import app_homolog as app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def cfg():
    """Configuração padrão da aplicação."""
    return app.CFG


@pytest.fixture
def sample_transactions():
    """DataFrame com transações de exemplo para um mês."""
    return pd.DataFrame([
        {
            "Id": "aaa111", "Data": datetime(2025, 1, 5),
            "Descricao": "Salário", "Valor": 5000.0,
            "Categoria": "Salário", "Tipo": "Entrada",
            "Responsavel": "Luan", "Origem": "Manual", "Tag": "",
        },
        {
            "Id": "bbb222", "Data": datetime(2025, 1, 10),
            "Descricao": "Aluguel", "Valor": 1500.0,
            "Categoria": "Moradia", "Tipo": "Saída",
            "Responsavel": "Casal", "Origem": "Recorrente", "Tag": "",
        },
        {
            "Id": "ccc333", "Data": datetime(2025, 1, 12),
            "Descricao": "Mercado Pão de Açúcar", "Valor": 450.0,
            "Categoria": "Alimentação", "Tipo": "Saída",
            "Responsavel": "Luana", "Origem": "Manual", "Tag": "essencial",
        },
        {
            "Id": "ddd444", "Data": datetime(2025, 1, 15),
            "Descricao": "Netflix", "Valor": 55.90,
            "Categoria": "Assinaturas", "Tipo": "Saída",
            "Responsavel": "Casal", "Origem": "Recorrente", "Tag": "",
        },
        {
            "Id": "eee555", "Data": datetime(2025, 1, 20),
            "Descricao": "Uber", "Valor": 32.50,
            "Categoria": "Transporte", "Tipo": "Saída",
            "Responsavel": "Luan", "Origem": "Manual", "Tag": "",
        },
        {
            "Id": "fff666", "Data": datetime(2025, 1, 22),
            "Descricao": "Tesouro Direto", "Valor": 500.0,
            "Categoria": "Investimento", "Tipo": "Saída",
            "Responsavel": "Casal", "Origem": "Manual", "Tag": "investimento",
        },
    ])


@pytest.fixture
def sample_assets():
    """DataFrame com patrimônio de exemplo."""
    return pd.DataFrame([
        {"Item": "Imóvel", "Valor": 300000.0, "Responsavel": "Casal"},
        {"Item": "Carro", "Valor": 45000.0, "Responsavel": "Luan"},
    ])


@pytest.fixture
def empty_transactions():
    """DataFrame vazio de transações."""
    return pd.DataFrame(columns=[
        "Id", "Data", "Descricao", "Valor", "Categoria",
        "Tipo", "Responsavel", "Origem", "Tag",
    ])


@pytest.fixture
def user_config():
    """UserConfig padrão."""
    return app.UserConfig()
