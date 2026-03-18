export function generateInsights(
  transactions: any[],
  orcamentos: any[],
  saldoEmConta: number,
  currentMonthStart: Date,
  previousMonthStart: Date,
  responsavelFiltro: string = "Todos"
) {
  let currentMonthSpent = 0;
  let previousMonthSpent = 0;
  const currentExpensesByCategory: Record<string, number> = {};
  const currentExpensesByPerson: Record<string, number> = {};
  const previousExpensesByPerson: Record<string, number> = {};
  
  // Assinaturas (keywords)
  let subscriptionsTotal = 0;
  const subKeywords = ["netflix", "spotify", "amazon", "prime", "disney", "hbo", "globo", "youtube", "apple", "adobe", "chatgpt", "midjourney"];

  transactions?.forEach(t => {
      const tDate = new Date(t.data);
      const isTargetResponsavel = responsavelFiltro === "Todos" || t.responsavel === responsavelFiltro;

      if (tDate >= currentMonthStart) {
          if (isTargetResponsavel) {
              currentMonthSpent += t.valor;
              currentExpensesByCategory[t.categoria] = (currentExpensesByCategory[t.categoria] || 0) + t.valor;
              
              if (subKeywords.some(k => t.descricao.toLowerCase().includes(k))) {
                  subscriptionsTotal += t.valor;
              }
          }
          currentExpensesByPerson[t.responsavel] = (currentExpensesByPerson[t.responsavel] || 0) + t.valor;
      } else if (tDate >= previousMonthStart && tDate < currentMonthStart) {
          if (isTargetResponsavel) {
              previousMonthSpent += t.valor;
          }
          previousExpensesByPerson[t.responsavel] = (previousExpensesByPerson[t.responsavel] || 0) + t.valor;
      }
  });

  const topCategories = Object.entries(currentExpensesByCategory)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, val]) => ({ category: cat, value: val }));

  const advice = [];
  let orcamentoAlertado = false;

  // Insight 1: Alerta de Orçamento Contextualizado
  if (orcamentos && orcamentos.length > 0) {
      const compromised = orcamentos.filter((o: any) => o.percentual >= 85).sort((a: any, b: any) => b.percentual - a.percentual);
      if (compromised.length > 0) {
          const wCat = compromised[0];
          const pesoDesseResponsavel = currentExpensesByCategory[wCat.categoria] || 0;
          let obsContextual = "";
          
          if (responsavelFiltro !== "Todos" && pesoDesseResponsavel > 0) {
              obsContextual = ` Você contribuiu com R$ ${pesoDesseResponsavel.toFixed(2)} desse consumo.`;
          } else if (responsavelFiltro === "Todos") {
              const txsNaCategoria = transactions.filter(t => t.categoria === wCat.categoria && new Date(t.data) >= currentMonthStart);
              const gastosPorPessoaCat: Record<string, number> = {};
              txsNaCategoria.forEach(t => { gastosPorPessoaCat[t.responsavel] = (gastosPorPessoaCat[t.responsavel] || 0) + t.valor; });
              const maiorGastador = Object.keys(gastosPorPessoaCat).sort((a,b) => gastosPorPessoaCat[b] - gastosPorPessoaCat[a])[0];
              
              if (maiorGastador && maiorGastador !== "Casal" && gastosPorPessoaCat[maiorGastador] > (wCat.gasto_atual * 0.4)) {
                   obsContextual = ` Os gastos de ${maiorGastador} representam forte impacto nisso.`;
              }
          }

          advice.push({
              title: "Atenção ao Orçamento",
              message: `A categoria "${wCat.categoria}" já consumiu ${wCat.percentual.toFixed(0)}% do limite do mês.${obsContextual}`,
              type: "warning" as const
          });
          orcamentoAlertado = true;
      }
  }

  // Insight 2: Identificação de Tendência Cruzada (Familiar ou Pessoal)
  if (previousMonthSpent > 0 && currentMonthSpent > 0) {
      const diffTotalPercent = ((currentMonthSpent - previousMonthSpent) / previousMonthSpent) * 100;
      
      if (responsavelFiltro === "Todos") {
          let maiorSaltoNome = "";
          let maiorSaltoValor = 0;
          
          for (const resp of Object.keys(currentExpensesByPerson)) {
              if (resp === "Casal") continue; 
              const cur = currentExpensesByPerson[resp] || 0;
              const prev = previousExpensesByPerson[resp] || 0;
              if (prev > 0) {
                  const jump = cur - prev;
                  if (jump > maiorSaltoValor && jump > 200) { 
                      maiorSaltoValor = jump;
                      maiorSaltoNome = resp;
                  }
              }
          }

          if (maiorSaltoNome && diffTotalPercent > 5) {
              const txsPessoa = transactions.filter(t => t.responsavel === maiorSaltoNome && new Date(t.data) >= currentMonthStart);
              const dictCat: Record<string,number> = {};
              txsPessoa.forEach(t => { dictCat[t.categoria] = (dictCat[t.categoria] || 0) + t.valor });
              const topCatPessoa = Object.keys(dictCat).sort((a,b) => dictCat[b] - dictCat[a])[0];

              advice.push({
                  title: `Impacto nos Gastos`,
                  message: `As saídas de ${maiorSaltoNome} cresceram mais que as do mês anterior, puxadas principalmente por "${topCatPessoa || 'Outros'}".`,
                  type: "warning" as const
              });
          } else if (diffTotalPercent < -5) {
              advice.push({
                  title: "Controle Positivo Geral",
                  message: `O mês está mais controlado que o anterior, com queda de ${Math.abs(diffTotalPercent).toFixed(0)}% nas saídas totais.`,
                  type: "success" as const
              });
          } else if (diffTotalPercent > 15 && !maiorSaltoNome) {
              advice.push({
                  title: "Aumento nas Despesas Globais",
                  message: `O volume mensal (R$ ${currentMonthSpent.toFixed(2)}) está ${diffTotalPercent.toFixed(0)}% maior do que a média anterior.`,
                  type: "warning" as const
              });
          }
      } else {
          // Visão Individual (Luan, Luana, Casal)
          if (diffTotalPercent > 15) {
              advice.push({
                  title: "Aumento de Gastos Pessoais",
                  message: `Seus gastos este mês estão ${diffTotalPercent.toFixed(0)}% maiores do que o se padrão anterior. Atenção ao ritmo!`,
                  type: "warning" as const
              });
          } else if (diffTotalPercent < -5) {
              advice.push({
                  title: "Controle Positivo",
                  message: `Ótimo! Seu ritmo de saídas está ${Math.abs(diffTotalPercent).toFixed(0)}% menor em relação ao mês anterior.`,
                  type: "success" as const
              });
          }
      }
  }

  // Insight 3: Concentração de Categoria (Só se não tiver estourado orçamento daquela top categoria)
  if (topCategories.length > 0 && currentMonthSpent > 0 && !orcamentoAlertado) {
      const top = topCategories[0];
      const percent = (top.value / currentMonthSpent) * 100;
      if (percent > 40) {
          advice.push({
              title: "Alta Concentração de Saídas",
              message: `A maior parte do seu mês está concentrada em "${top.category}" (${percent.toFixed(0)}% do total). Avalie se não há exagero.`,
              type: "info" as const
          });
      }
  }

  // Insight 4: Dinheiro Parado
  if (saldoEmConta > 5000 && advice.length < 5 && responsavelFiltro === "Todos") {
      advice.push({
          title: "Dinheiro Parado Sem Render",
          message: `Identifiquei R$ ${saldoEmConta.toFixed(2)} depositados. É vantajoso enviar excedentes para investimentos rendendo CDI diário.`,
          type: "success" as const
      });
  } else if (saldoEmConta < 0 && responsavelFiltro === "Todos") {
       advice.push({
          title: "Uso do Cheque Especial",
          message: `As contas contêm balanço negativo de R$ ${Math.abs(saldoEmConta).toFixed(2)}. Zere isso assim que um resgate for possível.`,
          type: "warning" as const
      });
  }

  // Insight 5: Assinaturas ocultas/frequentes
  if (subscriptionsTotal > 200 && advice.length < 5) {
      advice.push({
          title: "Revisão de Assinaturas Mensais",
          message: `O radar encontrou R$ ${subscriptionsTotal.toFixed(2)} indo para serviços/apps mapeados. Liste-os e corte os ociosos.`,
          type: "info" as const
      });
  }

  // Fallback
  if (advice.length === 0) {
      advice.push({
          title: "Análise Limpa",
          message: "O radar de IA ainda não processou discrepâncias significativas neste recorte. Continue catalogando suas faturas.",
          type: "info" as const
      });
  }

  return { success: true, advice: advice.slice(0, 5) };
}
