-- ==========================================================================
-- Family Wealth Manager — Supabase Schema (Phase 4)
-- ==========================================================================
-- Execute no Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==========================================================================

-- 1. Transações
CREATE TABLE IF NOT EXISTS transacoes (
    id          TEXT PRIMARY KEY,
    data        DATE NOT NULL,
    descricao   TEXT NOT NULL,
    valor       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    categoria   TEXT NOT NULL,
    tipo        TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída')),
    responsavel TEXT NOT NULL CHECK (responsavel IN ('Casal', 'Luan', 'Luana')),
    origem      TEXT NOT NULL DEFAULT 'Manual',
    tag         TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transacoes_data ON transacoes (data);
CREATE INDEX idx_transacoes_responsavel ON transacoes (responsavel);
CREATE INDEX idx_transacoes_tipo ON transacoes (tipo);
CREATE INDEX idx_transacoes_categoria ON transacoes (categoria);

-- 2. Patrimônio
CREATE TABLE IF NOT EXISTS patrimonio (
    id          SERIAL PRIMARY KEY,
    item        TEXT NOT NULL,
    valor       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    responsavel TEXT NOT NULL CHECK (responsavel IN ('Casal', 'Luan', 'Luana')),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. Recorrentes
CREATE TABLE IF NOT EXISTS recorrentes (
    id              SERIAL PRIMARY KEY,
    descricao       TEXT NOT NULL,
    valor           NUMERIC(12, 2) NOT NULL DEFAULT 0,
    categoria       TEXT NOT NULL,
    tipo            TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída')),
    responsavel     TEXT NOT NULL CHECK (responsavel IN ('Casal', 'Luan', 'Luana')),
    dia_vencimento  INTEGER NOT NULL DEFAULT 1 CHECK (dia_vencimento BETWEEN 1 AND 28),
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 4. Orçamentos
CREATE TABLE IF NOT EXISTS orcamentos (
    id          SERIAL PRIMARY KEY,
    categoria   TEXT NOT NULL,
    limite      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    responsavel TEXT NOT NULL CHECK (responsavel IN ('Casal', 'Luan', 'Luana')),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 5. Configurações
CREATE TABLE IF NOT EXISTS configuracoes (
    id          SERIAL PRIMARY KEY,
    chave       TEXT NOT NULL,
    valor       TEXT NOT NULL DEFAULT '',
    responsavel TEXT NOT NULL CHECK (responsavel IN ('Casal', 'Luan', 'Luana')),
    UNIQUE (chave, responsavel)
);

-- 6. Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id        SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario   TEXT NOT NULL DEFAULT 'anônimo',
    acao      TEXT NOT NULL,
    planilha  TEXT NOT NULL,
    detalhes  TEXT DEFAULT ''
);

CREATE INDEX idx_audit_log_timestamp ON audit_log (timestamp DESC);

-- 7. Metas
CREATE TABLE IF NOT EXISTS metas (
    id          TEXT PRIMARY KEY,
    nome        TEXT NOT NULL,
    valor_alvo  NUMERIC(12, 2) NOT NULL DEFAULT 0,
    valor_atual NUMERIC(12, 2) NOT NULL DEFAULT 0,
    prazo       TEXT DEFAULT '',
    responsavel TEXT NOT NULL CHECK (responsavel IN ('Casal', 'Luan', 'Luana')),
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 8. Passivos
CREATE TABLE IF NOT EXISTS passivos (
    id          SERIAL PRIMARY KEY,
    item        TEXT NOT NULL,
    valor       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    responsavel TEXT NOT NULL CHECK (responsavel IN ('Casal', 'Luan', 'Luana')),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 9. Lixeira
CREATE TABLE IF NOT EXISTS lixeira (
    id          TEXT PRIMARY KEY,
    data        DATE,
    descricao   TEXT,
    valor       NUMERIC(12, 2) DEFAULT 0,
    categoria   TEXT,
    tipo        TEXT,
    responsavel TEXT,
    origem      TEXT,
    tag         TEXT DEFAULT '',
    deletado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lixeira_deletado ON lixeira (deletado_em DESC);

-- 10. Favoritos
CREATE TABLE IF NOT EXISTS favoritos (
    id          TEXT PRIMARY KEY,
    nome        TEXT NOT NULL,
    descricao   TEXT DEFAULT '',
    valor       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    categoria   TEXT NOT NULL,
    tipo        TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Saída')),
    responsavel TEXT NOT NULL CHECK (responsavel IN ('Casal', 'Luan', 'Luana')),
    tag         TEXT DEFAULT '',
    ordem       INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================================
-- RLS (Row Level Security) — desabilitado por enquanto (app usa service key)
-- ==========================================================================
-- ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;
-- Policies serão adicionadas na Fase 5 quando multi-tenant for implementado.
