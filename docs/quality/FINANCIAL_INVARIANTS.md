# Invariantes Financeiros

Regras de negócio e consistência financeira. Nenhum push deve quebrar estas leis.

## 1. Burn Rate (Ritmo de Gasto) Ignora o Futuro
Transações agendadas para o futuro (datas maiores que hoje) não podem vazar no cálculo do fluxo de caixa histórico e do "burn rate" realizado até o momento. O histórico consolidado do hoje para baixo é atômico.

## 2. Unicidade de Consumo no CSV
Durante o algoritmo de reconciliação de importação, um "candidato" a transação (lançamento importado contra os já existentes) não pode ser consumido duas vezes numa janela cronológica. Cada match verificado na base é travado 1:1.

## 3. Coerência do Filtro "Casal"
No escopo do dashboard e filtros da aplicação, a opção 'Casal' **não é um somatório solto das partes individuais (Luan + Luana)**. Ela serve primariamente para isolar e exibir saldos/gastos mapeados intrinsecamente para contabilidade de grupo.

## 4. O Sistema de Painéis vs Extrato Histórico
O somatório das listas tabulares no extrato do período filtrado deve sempre representar matematicamente a decomposição dos blocos parciais ou totais do Dashboard superior, respeitando a semântica da busca sem divergências ocultas.

## 5. CSV Ambíguo Ruma ao Conservadorismo
Durante o parse iterativo, qualquer entrada nova ambígua tenderá à conservação: o banco ou inserirá um novo registro paralelo que denota erro ao invés de ocultá-lo, ou solicitará intervenção explícita da pessoa operando o import (conservadorismo).
