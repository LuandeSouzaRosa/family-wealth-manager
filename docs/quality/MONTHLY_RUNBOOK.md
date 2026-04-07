# Runbook de Fechamento Mensal (FWM)

O fechamento de um ciclo mensal financeiro do Casal não deve depender de exploração livre, mas sim de uma esteira mecânica que garanta legibilidade e exatidão dos dados antes da tomada de decisão. Siga a esteira cronologicamente.

## 1. Importar (Ingestão Base)
A ingestão deve focar em subir os blocos brutos, sem tentar corrigir pendências minúsculas no começo.
- **Passo 1:** Faça o extrato principal (Luan) na modalidade de CSV.
- **Passo 2:** Imediatamente importe o arquivo recíproco esperado (Luana) na modalidade CSV/PDF, sem se preocupar em classificar detalhadamente o Dashboard vazio gerado no meio-tempo. 

## 2. Validar (O Terminal Responde)
Uma vez que o volume entrou no sistema, não perca tempo buscando furos manualmente. Execute o auditor nativo que mastiga o mês todo usando a lógica de Casal.
- Abra o terminal na raiz `web/` e rode:
  ```bash
  npm run ops:post-import-validation
  ```
- *Opcional:* Se deseja forçar a verificação num mês que já fechou: `npm run ops:post-import-validation -- --month 3 --year 2026`.

## 3. Revisar (O Próximo Melhor Passo)
Inspecione primariamente o **Status do Mês** no topo do output do terminal.

- 🛑 **[BLOCKED]**: Base vazia ou Luan/Luana totalmente ignorados. Volte para a Etapa 1.
- 🚧 **[PARTIAL]**: Está faltando o pacote consolidado de alguém. Identifique no console *("Falta importar o extrato de...")*. Faça o upload primeiro.
- ⚠️ **[NEEDS_REVIEW]**: O Casal está completo, porém algo ofusca sua matemática (seja dominância atípica de Não-Consumo ou um pacote enorme caído na categoria "Outros"). Olhe seção **Próximo Melhor Passo** (PMP) e clique diretamente de onde vem aquele impacto no app para categorizar/reclassificar.
- ✅ **[READY]**: Mês confiável, base forte.

## 4. Decidir (Pronto!)
Se o terminal devolve `[READY]`, o Mês do FWM está matematicamente seguro. Quaisquer flutuações menores da interface e gráficos devem agora ser lidos com extrema confiança como "Insights" corretos e factuais. O processo encerra aqui.
