-- P3.12 — Split de Transações por Responsável
-- Executar no Supabase Dashboard → SQL Editor

-- 1. Adicionar coluna split_group_id
ALTER TABLE transacoes ADD COLUMN split_group_id uuid NULL;

-- 2. Índice parcial (só indexa linhas que fazem parte de um split)
CREATE INDEX idx_transacoes_split_group 
  ON transacoes(split_group_id) 
  WHERE split_group_id IS NOT NULL;
