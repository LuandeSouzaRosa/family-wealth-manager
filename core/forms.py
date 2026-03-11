"""Formulários de interação do usuário.

Extraído do monolito app_homolog.py.
Retorna dicionários com os dados preenchidos quando o form é submetido,
delegando a validação final e o salvamento para o controller.
"""
from __future__ import annotations

import streamlit as st
import pandas as pd
from datetime import datetime, date
import calendar

from core.config import CFG
from core.utils import default_form_date

def transaction_form(
    form_key: str, tipo: str, categorias: list[str],
    submit_label: str = "REGISTRAR",
    desc_placeholder: str = "Descrição",
    default_step: float = 10.0,
    sel_mo: int | None = None, sel_yr: int | None = None,
    default_resp: str = "Casal",
) -> dict | None:
    """Formulário genérico de transação."""
    form_date = default_form_date(sel_mo, sel_yr) if sel_mo and sel_yr else datetime.now().date()
    if sel_mo and sel_yr:
        d_min = date(sel_yr, sel_mo, 1)
        d_max = date(sel_yr, sel_mo, calendar.monthrange(sel_yr, sel_mo)[1])
    else:
        d_min, d_max = None, None
        
    with st.form(form_key, clear_on_submit=True):
        d = st.date_input("Data", form_date, min_value=d_min, max_value=d_max, format="DD/MM/YYYY")
        desc = st.text_input(
            "Descrição", placeholder=desc_placeholder,
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Valor (R$)", min_value=0.01, step=default_step)
        cat = st.selectbox("Categoria", categorias)
        
        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Responsável", resp_options, index=resp_index)
        
        tag = st.text_input("Tag (opcional)", placeholder="Ex: viagem, reforma, natal", max_chars=50)
        
        if st.form_submit_button(submit_label):
            return {
                "Data": d, "Descricao": desc.strip(), "Valor": val,
                "Categoria": cat, "Tipo": tipo, "Responsavel": resp,
                "Origem": CFG.ORIGEM_MANUAL,
                "Tag": tag.strip() if tag else "",
            }
    return None

def wealth_form(
    sel_mo: int | None = None,
    sel_yr: int | None = None,
    default_resp: str = "Casal",
) -> dict | None:
    """Formulário de aporte / investimento."""
    form_date = default_form_date(sel_mo, sel_yr) if sel_mo and sel_yr else datetime.now().date()
    if sel_mo and sel_yr:
        d_min = date(sel_yr, sel_mo, 1)
        d_max = date(sel_yr, sel_mo, calendar.monthrange(sel_yr, sel_mo)[1])
    else:
        d_min, d_max = None, None
        
    with st.form("f_wealth", clear_on_submit=True):
        d = st.date_input("Data", form_date, min_value=d_min, max_value=d_max, format="DD/MM/YYYY")
        desc = st.text_input(
            "Ativo / Corretora", placeholder="Ex: IVVB11, Bitcoin, CDB",
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Valor (R$)", min_value=0.01, step=100.0)
        
        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Titular", resp_options, index=resp_index)
        
        w_tag = st.text_input("Tag (opcional)", placeholder="Ex: renda fixa, cripto", max_chars=50, key="w_tag")
        
        if st.form_submit_button("CONFIRMAR APORTE"):
            return {
                "Data": d, "Descricao": desc.strip(), "Valor": val,
                "Categoria": CFG.CAT_INVESTIMENTO, "Tipo": CFG.TIPO_SAIDA, "Responsavel": resp,
                "Origem": CFG.ORIGEM_MANUAL,
                "Tag": w_tag.strip() if w_tag else "",
            }
    return None

def patrimonio_form(default_resp: str = "Casal") -> dict | None:
    """Formulário de ativo patrimonial."""
    with st.form("f_patrimonio", clear_on_submit=True):
        item = st.text_input(
            "Ativo / Conta", placeholder="Ex: Poupança Nubank, Apartamento",
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Valor (R$)", min_value=0.01, step=100.0)

        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Titular", resp_options, index=resp_index)
        
        if st.form_submit_button("ADICIONAR ATIVO"):
            return {"Item": item.strip(), "Valor": val, "Responsavel": resp}
    return None

def recorrente_form(default_resp: str = "Casal") -> dict | None:
    """Formulário para cadastrar transação recorrente."""
    with st.form("f_recorrente", clear_on_submit=True):
        tipo = st.selectbox("Tipo", list(reversed(CFG.TIPOS)))
        desc = st.text_input(
            "Descrição", placeholder="Ex: Aluguel, Netflix, Salário",
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Valor (R$)", min_value=0.01, step=50.0)
        
        if tipo == CFG.TIPO_SAIDA:
            cat_options = list(CFG.CATEGORIAS_SAIDA) + [CFG.CAT_INVESTIMENTO]
        else:
            cat_options = list(CFG.CATEGORIAS_ENTRADA)
        cat = st.selectbox("Categoria", cat_options, key=f"rec_cat_{tipo}")
        
        dia = st.number_input(
            "Dia do vencimento", min_value=1, max_value=28, value=1, step=1
        )
        
        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Responsável", resp_options, index=resp_index)
        
        if st.form_submit_button("CADASTRAR RECORRENTE"):
            return {
                "Descricao": desc.strip(),
                "Valor": val,
                "Categoria": cat,
                "Tipo": tipo,
                "Responsavel": resp,
                "DiaVencimento": int(dia),
                "Ativo": True,
            }
    return None

def orcamento_form(default_resp: str = "Casal") -> dict | None:
    """Formulário para definir limite de orçamento por categoria."""
    with st.form("f_orcamento", clear_on_submit=True):
        cat = st.selectbox("Categoria", list(CFG.CATEGORIAS_SAIDA))
        limite = st.number_input("Limite mensal (R$)", min_value=0.01, step=50.0)
        
        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Responsável", resp_options, index=resp_index)
        
        if st.form_submit_button("DEFINIR LIMITE"):
            return {
                "Categoria": cat,
                "Limite": limite,
                "Responsavel": resp,
            }
    return None

def passivo_form(default_resp: str = "Casal") -> dict | None:
    """Formulário de passivo/dívida."""
    with st.form("f_passivo", clear_on_submit=True):
        item = st.text_input(
            "Dívida / Financiamento",
            placeholder="Ex: Financiamento Apto, Empréstimo, Cartão",
            max_chars=CFG.MAX_DESC_LENGTH,
        )
        val = st.number_input("Saldo Devedor (R$)", min_value=0.01, step=100.0)
        
        resp_options = list(CFG.RESPONSAVEIS)
        resp_index = resp_options.index(default_resp) if default_resp in resp_options else 0
        resp = st.selectbox("Responsável", resp_options, index=resp_index)
        
        if st.form_submit_button("ADICIONAR PASSIVO"):
            return {"Item": item.strip(), "Valor": val, "Responsavel": resp}
    return None

def meta_form(default_resp: str = "Casal") -> dict | None:
    """Formulário para criar meta financeira."""
    with st.form("f_meta", clear_on_submit=True):
        nome = st.text_input(
            "Nome da Meta",
            placeholder="Ex: Reserva de Emergência, Viagem Europa",
            max_chars=100,
        )
        m1, m2 = st.columns(2)
        with m1:
            valor_alvo = st.number_input("Valor Alvo (R$)", min_value=0.01, step=500.0)
        with m2:
            valor_atual = st.number_input(
                "Valor Atual (R$)", min_value=0.0, step=100.0, value=0.0,
            )
        m3, m4 = st.columns(2)
        with m3:
            prazo = st.text_input(
                "Prazo (YYYY-MM)", placeholder="Ex: 2025-12", max_chars=7,
            )
        with m4:
            resp_opts = list(CFG.RESPONSAVEIS)
            resp_idx = resp_opts.index(default_resp) if default_resp in resp_opts else 0
            resp = st.selectbox("Responsável", resp_opts, index=resp_idx)
            
        if st.form_submit_button("CRIAR META", use_container_width=True):
            return {
                "Nome": nome.strip() if nome else "",
                "ValorAlvo": valor_alvo,
                "ValorAtual": valor_atual,
                "Prazo": prazo.strip() if prazo else "",
                "Responsavel": resp,
                "Ativo": True,
            }
    return None
