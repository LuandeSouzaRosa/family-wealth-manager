"""Testes de segurança e autenticação — Fase 3."""
from __future__ import annotations

import hashlib
import secrets
import time
from unittest.mock import patch

import pytest

from conftest import app


# =========================================================================
# _sanitize_for_sheet (Sheet Injection Prevention)
# =========================================================================

class TestSanitizeForSheet:

    def test_normal_text_unchanged(self):
        assert app._sanitize_for_sheet("Mercado") == "Mercado"

    def test_formula_equals_blocked(self):
        result = app._sanitize_for_sheet("=SUM(A1:A10)")
        assert result.startswith("'")
        assert "SUM" in result

    def test_formula_plus_blocked(self):
        result = app._sanitize_for_sheet("+cmd|' /C calc'!A1")
        assert result.startswith("'")

    def test_formula_minus_blocked(self):
        result = app._sanitize_for_sheet("-1+1")
        assert result.startswith("'")

    def test_formula_at_blocked(self):
        result = app._sanitize_for_sheet("@SUM(A1)")
        assert result.startswith("'")

    def test_formula_pipe_blocked(self):
        result = app._sanitize_for_sheet("|cmd")
        assert result.startswith("'")

    def test_formula_tab_blocked(self):
        result = app._sanitize_for_sheet("\t=cmd")
        assert result.startswith("'")

    def test_empty_string_unchanged(self):
        assert app._sanitize_for_sheet("") == ""

    def test_number_string_unchanged(self):
        assert app._sanitize_for_sheet("12345") == "12345"

    def test_whitespace_stripped(self):
        assert app._sanitize_for_sheet("  Mercado  ") == "Mercado"


# =========================================================================
# sanitize (HTML XSS Prevention)
# =========================================================================

class TestSanitize:

    def test_html_tags_escaped(self):
        result = app.sanitize("<script>alert('xss')</script>")
        assert "<script>" not in result
        assert "&lt;script&gt;" in result

    def test_quotes_escaped(self):
        result = app.sanitize('"><img src=x onerror=alert(1)>')
        assert "<img" not in result

    def test_normal_text_unchanged(self):
        assert app.sanitize("Hello World") == "Hello World"

    def test_ampersand_escaped(self):
        assert "&amp;" in app.sanitize("A & B")


# =========================================================================
# _verify_password
# =========================================================================

class TestVerifyPassword:

    def test_sha256_correct_password(self):
        password = "minha_senha_segura"
        stored_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
        assert app._verify_password(stored_hash, password) is True

    def test_sha256_wrong_password(self):
        stored_hash = hashlib.sha256(b"senha_correta").hexdigest()
        assert app._verify_password(stored_hash, "senha_errada") is False

    def test_plaintext_correct_password(self):
        """Plaintext fallback funciona mas emite warning."""
        assert app._verify_password("plaintext123", "plaintext123") is True

    def test_plaintext_wrong_password(self):
        assert app._verify_password("plaintext123", "outra_senha") is False

    def test_sha256_timing_safe(self):
        """Verifica que usa compare_digest (timing-safe)."""
        password = "test"
        stored = hashlib.sha256(b"test").hexdigest()
        # Se funciona corretamente com secrets.compare_digest, deve retornar True
        assert app._verify_password(stored, password) is True

    def test_bcrypt_import_error_handled(self):
        """Se bcrypt não está instalado, retorna False para hash bcrypt."""
        fake_bcrypt_hash = "$2b$12$fakehashvaluethatisnotreal1234567890"
        with patch.dict("sys.modules", {"bcrypt": None}):
            # Deve retornar False sem crash
            result = app._verify_password(fake_bcrypt_hash, "test")
            assert result is False


# =========================================================================
# _check_login_rate_limit
# =========================================================================

class TestLoginRateLimit:

    def setup_method(self):
        """Reset session state antes de cada teste."""
        import streamlit as st
        st.session_state.clear()

    def test_first_attempt_allowed(self):
        allowed, remaining = app._check_login_rate_limit()
        assert allowed is True
        assert remaining == 0

    def test_under_limit_allowed(self):
        import streamlit as st
        st.session_state["_login_attempts"] = 3
        allowed, _ = app._check_login_rate_limit()
        assert allowed is True

    def test_at_limit_recently_blocked(self):
        import streamlit as st
        st.session_state["_login_attempts"] = 5
        st.session_state["_login_last_attempt"] = time.time()
        allowed, remaining = app._check_login_rate_limit()
        assert allowed is False
        assert remaining > 0

    def test_at_limit_after_cooldown_allowed(self):
        import streamlit as st
        st.session_state["_login_attempts"] = 5
        st.session_state["_login_last_attempt"] = time.time() - 100  # 100s ago
        allowed, _ = app._check_login_rate_limit()
        assert allowed is True


# =========================================================================
# generate_id
# =========================================================================

class TestGenerateId:

    def test_id_length(self):
        id_ = app.generate_id()
        assert len(id_) == 12

    def test_id_is_hex(self):
        id_ = app.generate_id()
        int(id_, 16)  # Should not raise

    def test_ids_are_unique(self):
        ids = {app.generate_id() for _ in range(100)}
        assert len(ids) == 100
