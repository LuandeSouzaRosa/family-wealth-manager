"""Autenticação — funções puras (sem dependência de st.session_state).

Extraído do monolito app_homolog.py — Seção 12 (parcial).
"""
from __future__ import annotations

import hashlib
import logging
import secrets

logger = logging.getLogger("ll_finance")


def verify_password(stored_hash: str, password: str) -> bool:
    """Verifica senha contra hash armazenado.

    Suporta:
    - bcrypt ($2b$...): via bcrypt lib (se disponível)
    - SHA-256 (hex 64 chars): hashlib
    - Plaintext (fallback legado — emite warning)
    """
    stored = str(stored_hash)

    # bcrypt hash
    if stored.startswith("$2b$") or stored.startswith("$2a$"):
        try:
            import bcrypt
            return bcrypt.checkpw(
                password.encode("utf-8"), stored.encode("utf-8")
            )
        except ImportError:
            logger.error("bcrypt não instalado — instale com: pip install bcrypt")
            return False

    # SHA-256 hex hash
    if len(stored) == 64 and all(c in '0123456789abcdef' for c in stored.lower()):
        candidate = hashlib.sha256(password.encode("utf-8")).hexdigest()
        return secrets.compare_digest(candidate, stored.lower())

    # Plaintext fallback (legado — emite warning)
    logger.warning(
        "SEGURANÇA: senha armazenada em plaintext! "
        "Use: python -c \"import hashlib; print(hashlib.sha256(b'SUA_SENHA').hexdigest())\" "
        "para gerar o hash e substitua no secrets.toml"
    )
    return secrets.compare_digest(stored, password)
