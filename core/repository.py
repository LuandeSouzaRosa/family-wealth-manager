"""Interface abstrata do repositório de dados (Repository Pattern).

Define o contrato que todas as implementações (Google Sheets, Supabase)
devem seguir. Nenhuma lógica de infraestrutura aqui.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

import pandas as pd

from core.config import UserConfig


class BaseRepository(ABC):
    """Contrato para acesso a dados do Family Wealth Manager."""

    # ------------------------------------------------------------------
    # Leitura
    # ------------------------------------------------------------------

    @abstractmethod
    def load_transacoes(self) -> pd.DataFrame:
        """Carrega transações."""

    @abstractmethod
    def load_patrimonio(self) -> pd.DataFrame:
        """Carrega patrimônio (ativos)."""

    @abstractmethod
    def load_recorrentes(self) -> pd.DataFrame:
        """Carrega transações recorrentes."""

    @abstractmethod
    def load_orcamentos(self) -> pd.DataFrame:
        """Carrega orçamentos por categoria."""

    @abstractmethod
    def load_config(self) -> pd.DataFrame:
        """Carrega configurações do usuário."""

    @abstractmethod
    def load_metas(self) -> pd.DataFrame:
        """Carrega metas financeiras."""

    @abstractmethod
    def load_passivos(self) -> pd.DataFrame:
        """Carrega passivos (dívidas/financiamentos)."""

    @abstractmethod
    def load_lixeira(self) -> pd.DataFrame:
        """Carrega transações na lixeira."""

    @abstractmethod
    def load_favoritos(self) -> pd.DataFrame:
        """Carrega favoritos de lançamento."""

    # ------------------------------------------------------------------
    # Escrita
    # ------------------------------------------------------------------

    @abstractmethod
    def save_entry(self, data: dict, table: str) -> bool:
        """Salva uma nova entrada em uma tabela."""

    @abstractmethod
    def update_table(self, df: pd.DataFrame, table: str) -> bool:
        """Atualiza tabela inteira com DataFrame editado."""

    @abstractmethod
    def save_config(self, user_config: UserConfig, responsavel: str) -> bool:
        """Salva configurações do usuário."""

    @abstractmethod
    def move_to_lixeira(self, rows: pd.DataFrame) -> bool:
        """Move transações para a lixeira (soft delete)."""

    @abstractmethod
    def restore_from_lixeira(self, rows: pd.DataFrame) -> bool:
        """Restaura transações da lixeira."""

    @abstractmethod
    def log_audit(self, action: str, table: str, details: str = "") -> None:
        """Registra ação no audit log."""

    # ------------------------------------------------------------------
    # Validação
    # ------------------------------------------------------------------

    @abstractmethod
    def validate_tables(self) -> list[str]:
        """Valida integridade das tabelas. Retorna lista de issues."""
