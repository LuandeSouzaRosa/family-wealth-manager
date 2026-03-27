# Fase Atual da Operação

## Fase Atual
**Internal Beta (Daily Use Readiness)** – O projeto deixou de ser um MVP incipiente e entrou na fase de teste prático real na vida do casal.

## Objetivo Atual
Garantir a **confiabilidade absoluta dos números**, assegurar a **coerência semântica e matemática entre todas as telas** (Dashboard vs Histórico) e manter o **baixo atrito diário** para inserção ríspida de dados (Quick Add e CSV). O sistema deve nos dar *paz de espírito*, não retrabalho.

## O que foi fechado recentemente
- Migração completa de Python/Streamlit para Next.js 15 (App Router) + Supabase.
- Consolidação do modelo relacional e segurança via RLS.
- Implementação e estabilização de guardrails contra double-submit e race conditions.
- Finalização da estratégia de divisão de contas `split_group_id`.

## O que vem agora
- Uso diário consistente. Testar intensivamente a rotina passiva (importação de CSV nos fins de semana) e rotina ativa (Quick Add).
- Observar a resiliência das lógicas de reconciliação de transações sem gerar duplicatas.
- Levantar atritos operacionais incômodos que impactem a inserção rápida ou percepção de dados.

## O que conscientemente NÃO será feito agora
- **Sincronização Direta de Bancos (Open Finance / Pluggy):** A infraestrutura para isso "sumiu do radar" por enquanto. A prioridade é 100% no motor matemático interno com upload de CSV e lançamentos manuais.
- **Refactoring amplo e Overengineering:** O app não será reestruturado para ser o "SaaS Perfeito do Futuro" à custa da operação de hoje.
- **Reabertura de decisões arquiteturais já consolidadas.**
