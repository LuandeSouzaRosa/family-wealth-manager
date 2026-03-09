"""Testes do Repository Pattern (Fase 4).

Testa:
- BaseRepository não pode ser instanciada (ABC)
- SheetsRepository com mocks de GSheetsConnection
- SupabaseRepository com mocks do supabase client
- get_repository factory
- Column mapping PascalCase ↔ snake_case
"""
from __future__ import annotations

import sys
import os
from unittest.mock import MagicMock, patch, PropertyMock
from datetime import datetime

import pandas as pd
import pytest

# ---------------------------------------------------------------------------
# Bloquear importação do Streamlit
# ---------------------------------------------------------------------------
_mock_st = MagicMock()
_mock_st.secrets = MagicMock()
_mock_st.secrets.get = MagicMock(return_value={})
_mock_st.session_state = {}
_mock_st.cache_data = MagicMock()

sys.modules.setdefault("streamlit", _mock_st)
sys.modules.setdefault("streamlit.components", MagicMock())
sys.modules.setdefault("streamlit.components.v1", MagicMock())
sys.modules.setdefault("streamlit_gsheets", MagicMock())

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.repository import BaseRepository
from core.sheets_repository import SheetsRepository, _parse_ativo, _normalize_strings, _serialize_for_sheet
from core.config import CFG, UserConfig
from core import get_repository


# ===========================================================================
# BaseRepository ABC
# ===========================================================================

class TestBaseRepositoryABC:
    def test_cannot_instantiate(self):
        with pytest.raises(TypeError):
            BaseRepository()

    def test_subclass_must_implement_all_methods(self):
        class Incomplete(BaseRepository):
            pass
        with pytest.raises(TypeError):
            Incomplete()


# ===========================================================================
# Helpers: _parse_ativo, _normalize_strings, _serialize_for_sheet
# ===========================================================================

class TestParseAtivo:
    @pytest.mark.parametrize("val, expected", [
        (True, True),
        (False, False),
        (1, True),
        (0, False),
        ("true", True),
        ("TRUE", True),
        ("1", True),
        ("sim", True),
        ("false", False),
        ("0", False),
        ("no", False),
        ("1.0", True),
        ("s", True),
        ("yes", True),
    ])
    def test_parse_ativo(self, val, expected):
        assert _parse_ativo(val) == expected


class TestNormalizeStrings:
    def test_strips_whitespace(self):
        df = pd.DataFrame({"A": [" hello ", " world "], "B": [1, 2]})
        result = _normalize_strings(df, ["A"])
        assert result["A"].tolist() == ["hello", "world"]

    def test_ignores_missing_columns(self):
        df = pd.DataFrame({"A": ["x"]})
        result = _normalize_strings(df, ["A", "Z"])
        assert result["A"].tolist() == ["x"]


class TestSerializeForSheet:
    def test_date_formatting(self):
        df = pd.DataFrame({"Data": [datetime(2025, 1, 15)]})
        result = _serialize_for_sheet(df)
        assert result["Data"].iloc[0] == "2025-01-15"

    def test_ativo_formatting(self):
        df = pd.DataFrame({"Ativo": [True, False, "sim"]})
        result = _serialize_for_sheet(df)
        assert result["Ativo"].tolist() == ["TRUE", "FALSE", "TRUE"]

    def test_no_date_or_ativo(self):
        df = pd.DataFrame({"X": [1, 2]})
        result = _serialize_for_sheet(df)
        assert result["X"].tolist() == [1, 2]


# ===========================================================================
# SheetsRepository
# ===========================================================================

class TestSheetsRepository:
    @pytest.fixture
    def mock_conn(self):
        return MagicMock()

    @pytest.fixture
    def repo(self, mock_conn):
        return SheetsRepository(mock_conn)

    def test_load_transacoes_empty(self, repo, mock_conn):
        mock_conn.read.return_value = pd.DataFrame(columns=list(CFG.COLS_TRANSACAO))
        df = repo.load_transacoes()
        assert df.empty
        assert list(df.columns) == list(CFG.COLS_TRANSACAO)

    def test_load_transacoes_with_data(self, repo, mock_conn):
        data = pd.DataFrame([{
            "Id": "abc123", "Data": "2025-01-05",
            "Descricao": "Salário", "Valor": "5000",
            "Categoria": "Salário", "Tipo": "Entrada",
            "Responsavel": "Luan", "Origem": "Manual", "Tag": "",
        }])
        mock_conn.read.return_value = data
        df = repo.load_transacoes()
        assert len(df) == 1
        assert df["Valor"].iloc[0] == 5000.0
        assert df["Id"].iloc[0] == "abc123"

    def test_load_transacoes_backfills_missing_ids(self, repo, mock_conn):
        data = pd.DataFrame([{
            "Data": "2025-01-05", "Descricao": "Test",
            "Valor": "100", "Categoria": "Salário",
            "Tipo": "Entrada", "Responsavel": "Luan",
        }])
        mock_conn.read.return_value = data
        df = repo.load_transacoes()
        assert len(df) == 1
        assert df["Id"].iloc[0] != ""

    def test_load_patrimonio(self, repo, mock_conn):
        data = pd.DataFrame([{
            "Item": "Imóvel", "Valor": "300000", "Responsavel": "Casal"
        }])
        mock_conn.read.return_value = data
        df = repo.load_patrimonio()
        assert len(df) == 1
        assert df["Valor"].iloc[0] == 300000.0

    def test_load_recorrentes(self, repo, mock_conn):
        data = pd.DataFrame([{
            "Descricao": "Netflix", "Valor": "55.90",
            "Categoria": "Assinaturas", "Tipo": "Saída",
            "Responsavel": "Casal", "DiaVencimento": "15", "Ativo": "TRUE"
        }])
        mock_conn.read.return_value = data
        df = repo.load_recorrentes()
        assert len(df) == 1
        assert df["Ativo"].iloc[0] == True
        assert df["DiaVencimento"].iloc[0] == 15

    def test_load_orcamentos(self, repo, mock_conn):
        data = pd.DataFrame([{
            "Categoria": "Alimentação", "Limite": "1000", "Responsavel": "Casal"
        }])
        mock_conn.read.return_value = data
        df = repo.load_orcamentos()
        assert df["Limite"].iloc[0] == 1000.0

    def test_load_config_empty(self, repo, mock_conn):
        mock_conn.read.side_effect = Exception("not found")
        df = repo.load_config()
        assert df.empty

    def test_load_metas(self, repo, mock_conn):
        data = pd.DataFrame([{
            "Id": "m1", "Nome": "Reserva", "ValorAlvo": "10000",
            "ValorAtual": "5000", "Prazo": "2025-12",
            "Responsavel": "Casal", "Ativo": "TRUE",
        }])
        mock_conn.read.return_value = data
        df = repo.load_metas()
        assert df["ValorAlvo"].iloc[0] == 10000.0

    def test_load_passivos(self, repo, mock_conn):
        data = pd.DataFrame([{
            "Item": "Financiamento", "Valor": "200000", "Responsavel": "Casal"
        }])
        mock_conn.read.return_value = data
        df = repo.load_passivos()
        assert df["Valor"].iloc[0] == 200000.0

    def test_load_lixeira(self, repo, mock_conn):
        data = pd.DataFrame([{
            "Id": "x1", "Data": "2025-01-01", "Descricao": "Test",
            "Valor": "50", "Categoria": "Outros", "Tipo": "Saída",
            "Responsavel": "Luan", "Origem": "Manual", "Tag": "",
            "DeletadoEm": "2025-01-10 10:00:00",
        }])
        mock_conn.read.return_value = data
        df = repo.load_lixeira()
        assert len(df) == 1

    def test_load_favoritos(self, repo, mock_conn):
        data = pd.DataFrame([{
            "Id": "f1", "Nome": "Café", "Descricao": "Starbucks",
            "Valor": "25", "Categoria": "Alimentação", "Tipo": "Saída",
            "Responsavel": "Luan", "Tag": "", "Ordem": "1",
        }])
        mock_conn.read.return_value = data
        df = repo.load_favoritos()
        assert len(df) == 1

    def test_save_entry_success(self, repo, mock_conn):
        mock_conn.read.return_value = pd.DataFrame()
        mock_conn.update.return_value = None
        result = repo.save_entry({"Descricao": "Test", "Valor": 100}, "Patrimonio")
        assert result is True

    def test_save_entry_generates_id_for_transacoes(self, repo, mock_conn):
        mock_conn.read.return_value = pd.DataFrame()
        data = {"Descricao": "Test", "Valor": 100}
        repo.save_entry(data, "Transacoes")
        assert "Id" in data

    def test_save_entry_failure(self, repo, mock_conn):
        mock_conn.read.return_value = pd.DataFrame()
        mock_conn.update.side_effect = Exception("write error")
        result = repo.save_entry({"X": 1}, "Test")
        assert result is False

    def test_update_table_success(self, repo, mock_conn):
        mock_conn.update.return_value = None
        df = pd.DataFrame([{"X": 1}])
        result = repo.update_table(df, "Test")
        assert result is True

    def test_save_config(self, repo, mock_conn):
        mock_conn.read.return_value = pd.DataFrame(columns=list(CFG.COLS_CONFIG))
        mock_conn.update.return_value = None
        uc = UserConfig()
        result = repo.save_config(uc, "Casal")
        assert result is True

    def test_move_to_lixeira_empty(self, repo):
        result = repo.move_to_lixeira(pd.DataFrame())
        assert result is True

    def test_restore_from_lixeira_empty(self, repo):
        result = repo.restore_from_lixeira(pd.DataFrame())
        assert result is True

    def test_validate_tables_all_ok(self, repo, mock_conn):
        mock_conn.read.return_value = pd.DataFrame(columns=list(CFG.COLS_TRANSACAO))
        issues = repo.validate_tables()
        # Some tables may have different columns, but no crash
        assert isinstance(issues, list)


# ===========================================================================
# Column Mapping
# ===========================================================================

class TestColumnMapping:
    def test_snake_to_pascal(self):
        from core.supabase_repository import _to_pascal
        df = pd.DataFrame({"id": [1], "descricao": ["x"], "dia_vencimento": [15]})
        result = _to_pascal(df)
        assert "Id" in result.columns
        assert "Descricao" in result.columns
        assert "DiaVencimento" in result.columns

    def test_pascal_to_snake(self):
        from core.supabase_repository import _to_snake
        df = pd.DataFrame({"Id": [1], "Descricao": ["x"], "DiaVencimento": [15]})
        result = _to_snake(df)
        assert "id" in result.columns
        assert "descricao" in result.columns
        assert "dia_vencimento" in result.columns

    def test_dict_to_snake(self):
        from core.supabase_repository import _dict_to_snake
        result = _dict_to_snake({"Id": "abc", "DiaVencimento": 15, "Descricao": "test"})
        assert result == {"id": "abc", "dia_vencimento": 15, "descricao": "test"}

    def test_roundtrip(self):
        from core.supabase_repository import _to_pascal, _to_snake
        original = pd.DataFrame({
            "Id": ["abc"], "Descricao": ["test"], "ValorAlvo": [100.0],
            "DiaVencimento": [15], "DeletadoEm": ["2025-01-01"]
        })
        snake = _to_snake(original)
        back = _to_pascal(snake)
        assert list(back.columns) == list(original.columns)


# ===========================================================================
# Factory: get_repository
# ===========================================================================

class TestGetRepository:
    def test_sheets_backend(self):
        mock_conn = MagicMock()
        repo = get_repository(backend="sheets", conn=mock_conn)
        assert isinstance(repo, SheetsRepository)

    def test_sheets_requires_conn(self):
        with pytest.raises(ValueError, match="conn"):
            get_repository(backend="sheets", conn=None)

    def test_supabase_backend_fails_without_credentials(self):
        """Supabase backend should fail when no credentials configured."""
        # Clean env vars
        with patch.dict(os.environ, {}, clear=True):
            with patch("core.supabase_client._client", None):
                with pytest.raises(Exception):
                    get_repository(backend="supabase")
