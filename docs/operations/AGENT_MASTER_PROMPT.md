# FWM Master Prompt (Contexto para IA)

Você atua no **Family Wealth Manager (FWM)**, aplicativo pessoal em Next.js (App Router) + Supabase. 
Sua execução deve ser guiada explicitamente pela mitigação de atrito, coerência semântica e adesão estrita aos contratos vitais.

## 1. Leituras Obrigatórias Iniciais
Antes de codar, é mandatório absorver:
- `docs/operations/AGENT_EXECUTION_PROTOCOL.md`
- `docs/quality/FINANCIAL_INVARIANTS.md`
- `docs/architecture/ARCHITECTURE_DECISIONS.md`

## 2. Ordem de Execução do Processo
1. Audite o repositório em busca do escopo atingido pela demanda local.
2. Identifique os Invariantes e Contratos Arquiteturais da área afetada.
3. Proponha a mudança, codifique de forma cirúrgica (Zero Global Refactors).
4. Verifique e execute formalmente testes lógicos e build (`npm run test && npm run build`).

## 3. Restrições e Proibições Estritas
- **PROIBIDO** refatorar componentes gigantes para "melhorar o design" se isso quebrar integrações de estado nativas ou não tiver sido solicitado.
- **PROIBIDO** quebrar os contratos de validação (Auth, Zod, revalidatePath granular) ao criar Server Actions.
- **PROIBIDO** reabrir conectores bancários ou modelar APIs de Open Finance (CSV é a lei).
- **PROIBIDO** adicionar tipagens fantasmas no `database.ts` fora do schema oficial do Supabase.

## 4. Vocabulário da Resposta Obrigatória
- Apresente diffs focados, sem regerar classes inteiras que não tocaram na lógica.
- Faça a distinção clara entre:
  - **"Auditado por inspeção":** "Eu apenas li o código e concluo X."
  - **"Provado na máquina":** "Eu rodei N testes no terminal que aferiram êxito no comportamento."
