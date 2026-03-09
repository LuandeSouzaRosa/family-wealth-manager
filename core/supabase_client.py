"""Cliente Supabase — singleton com leitura de credenciais.

Lê credenciais de st.secrets ou variáveis de ambiente.
"""
from __future__ import annotations

import os
import logging

logger = logging.getLogger("ll_finance")

_client = None


def get_supabase_client():
    """Retorna instância singleton do cliente Supabase.

    Prioridade de credenciais:
    1. st.secrets["supabase"] (Streamlit Cloud / secrets.toml)
    2. Variáveis de ambiente SUPABASE_URL + SUPABASE_KEY
    """
    global _client
    if _client is not None:
        return _client

    url = None
    key = None

    # Tentar st.secrets primeiro
    try:
        import streamlit as st
        secrets = st.secrets.get("supabase", {})
        url = secrets.get("url")
        key = secrets.get("key")
    except Exception:
        pass

    # Fallback para env vars
    if not url:
        url = os.environ.get("SUPABASE_URL")
    if not key:
        key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        raise ValueError(
            "Credenciais Supabase não encontradas. "
            "Configure em st.secrets['supabase'] ou variáveis SUPABASE_URL/SUPABASE_KEY."
        )

    from supabase import create_client
    _client = create_client(url, key)
    logger.info("Supabase client inicializado")
    return _client


def reset_client() -> None:
    """Reseta o singleton (útil para testes)."""
    global _client
    _client = None
