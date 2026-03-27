# Contratos de Arquitetura (FWM)

Este documento registra as restrições técnicas e contratos arquiteturais imutáveis do FWM.

## 1. Mutations vs Reads
- **Reads:** Devem ser feitos exclusivamente através de Server Components ou funções utilitárias `read-only`. Next.js data fetching é a via padrão.
- **Mutations:** Obrigatório o uso de Server Actions. Proibido mutar dados diretamente de Clients via API Routes sem justificativa extrema.

## 2. Contrato de Proteção na Gravadora (Zod e Auth)
Qualquer Server Action que altera estado no banco precisa conter:
1. `const supabase = await createClient();`
2. `const { data: { user } } = await supabase.auth.getUser();` – Obter a sessão e validar *antes* de prosseguir.
3. `const parsed = SchemaValidacao.safeParse(data);` – O payload deve ser tipado e validado formalmente pelo Zod antes da injeção no Supabase.

## 3. Contrato de Invalidação
O estado das métricas dita o uso agressivo das tags de cache:
- Use `invalidateTag(CACHE_TAGS.dashboard)` impreterivelmente após qualquer mutação (insert/update/delete) que afete saldos financeiros.
- `revalidatePath("/rota-especifica")` deve ser invocado de forma **granular**. É terminantemente proibido jogar um `revalidatePath("/")` global sem motivação.

## 4. Ingestão e Split
- Custos compartilhados são sempre lançados gerando N linhas reais com um `split_group_id` UUID comum.
- Pluggy/Open Finance está desligado do pipeline atual; a arquitetura é orientada a *CSV-first*.
