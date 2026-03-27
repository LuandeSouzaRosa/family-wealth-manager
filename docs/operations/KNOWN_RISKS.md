# Riscos Vivos e Limitações (FWM)

Este documento rastreia os atritos reais e lacunas da operação diária atual.

## 1. Ambiguidades de CSV e Estorno
A reconciliação CSV trata ambiguidades com extremo conservadorismo. Transações muito parecidas (mesmo valor, datas próximas) podem falhar na detecção de duplicata se não houver ID claro, exigindo validação humana para não somar estornos ou dupla-cobrança.

## 2. Stale Visual Momentâneo
Devido ao modelo agressivo de cache do Next.js, certas interações de mutação rápida podem gerar `stale` momentâneo na UI das métricas até que o `invalidateTag(CACHE_TAGS.dashboard)` e o `revalidatePath` resolvam a árvore de componentes no cliente.

## 3. Limitações de Edição de Split (Locked partial update)
Lançamentos atrelados a um `split_group_id` têm a edição parcial bloqueada. Para alterar um rateio, o usuário é forçado a excluir a cadeia (que apaga o grupo) e lançar novamente. É um mecanismo de proteção para evitar corrupção de cotas.

## 4. Bordas de Histórico Curto
O cálculo de métricas (como médias) pode sofrer distorções ou falta de contexto se a janela cronológica selecionada no filtro for estreita ou irregular (ex: análise de dias ou meses pela metade).

## 5. Lacunas de Validação em Fluxos Rápidos
Entradas via Quick Add dependem do preenchimento humano estrito. Inserções de texto muito exóticas podem vazar na tipagem relaxada antes do Zod formal, exigindo edições estruturais manuais posteriores.
