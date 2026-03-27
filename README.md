# Family Wealth Manager (v6.0)

Aplicação web centrada no controle ágil e transparente das finanças do casal. O projeto opera em **Next.js 15 (App Router)** e **Supabase**, desenhado com extrema atenção a métricas claras, ingestão rápida de dados (CSV/Manual) e isolamento seguro de lançamentos.

## Documentação Técnica do Repositório

Arquitetura, protocolos e regras de domínio estão imantados dentro da pasta `docs/`. Agentes sintéticos prestando manutenção têm diretrizes absolutas nestes endereços:

* 🧠 **Agentes / IAs:** Leitura inicial mandatória do [Prompt Mestre](docs/operations/AGENT_MASTER_PROMPT.md) e do [Protocolo de Execução](docs/operations/AGENT_EXECUTION_PROTOCOL.md).
* ⚙️ **Regras de Infra:** Leia os [Contratos de Arquitetura](docs/architecture/ARCHITECTURE_DECISIONS.md).
* 💰 **Lógica de Domínio:** Consulte as regras matemáticas em [Invariantes Financeiros](docs/quality/FINANCIAL_INVARIANTS.md).
* 🚦 **Fase Atual:** Verifique [Fase Operacional](docs/operations/CURRENT_PHASE.md) e [Riscos Vivos](docs/operations/KNOWN_RISKS.md).
* 🔍 **Visões Legadas & PRDs Antigos:** Mergulhe no histórico em `docs/archive/`.

## Ambiente, Setup Mínimo Útil e Testes

Para executar localmente, garanta que as variáveis de ambiente baseadas no `.env.example` existem (credenciais de Supabase).

```bash
# Setup
npm install

# Desenvolvimento
npm run dev

# Bateria de Validação
npm run test

# Build de Produção Local
npm run build
```
