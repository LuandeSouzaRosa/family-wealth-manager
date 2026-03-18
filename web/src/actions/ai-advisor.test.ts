import { generateInsights } from '../lib/ai-advisor-logic';

describe('AI Advisor Logic (generateInsights)', () => {
  const baseOrcamentos = [
    { categoria: 'Alimentação', limite: 1000, gasto_atual: 500, percentual: 50 }
  ];
  
  const currentMonthStart = new Date(2026, 2, 1); // March
  const previousMonthStart = new Date(2026, 1, 1); // Feb

  it('deve retornar no máximo 5 insights e apenas tipos válidos', () => {
    // Cenário onde TODAS as regras são ativadas para forçar > 5 insights
    const transactions = [
      // Mês anterior (total 100)
      { valor: 100, categoria: 'Outros', data: new Date(2026, 1, 15).toISOString(), descricao: 'x', tipo: 'Saída', responsavel: 'Luan' },
      
      // Mês atual (total 5000 -> dif > 15%)
      { valor: 4000, categoria: 'Destaque', data: new Date(2026, 2, 10).toISOString(), descricao: 'x', tipo: 'Saída', responsavel: 'Luan' },
      
      // Assinaturas > 200
      { valor: 250, categoria: 'Assinaturas', data: new Date(2026, 2, 12).toISOString(), descricao: 'Netflix e Spotify', tipo: 'Saída', responsavel: 'Luana' },
    ];

    const orcamentosEstourados = [
      { categoria: 'Lazer', limite: 100, gasto_atual: 90, percentual: 90 }
    ];

    const saldoParado = 6000; // Gera alerta de investimento

    const result = generateInsights(
      transactions,
      orcamentosEstourados,
      saldoParado,
      currentMonthStart,
      previousMonthStart
    );

    expect(result.success).toBe(true);
    expect(result.advice.length).toBeLessThanOrEqual(5);

    const validTypes = ['success', 'warning', 'info'];
    result.advice.forEach(insight => {
      expect(validTypes).toContain(insight.type);
    });
  });

  it('deve retornar um fallback útil quando não houver dados suficientes', () => {
    const result = generateInsights([], [], 0, currentMonthStart, previousMonthStart);
    
    expect(result.advice).toHaveLength(1);
    expect(result.advice[0].title).toBe('Análise Limpa');
    expect(result.advice[0].type).toBe('info');
  });

  it('não deve quebrar com ausência de dados do mês anterior', () => {
    const transactions = [
      // Apenas transações do mês atual
      { valor: 500, categoria: 'Mercado', data: new Date(2026, 2, 5).toISOString(), descricao: 'Mercado', tipo: 'Saída', responsavel: 'Casal' }
    ];

    const result = generateInsights(transactions, [], 0, currentMonthStart, previousMonthStart);
    
    // Como não há mês anterior, não deve gerar comparativo de tendência, mas deve continuar o processo
    expect(result.success).toBe(true);
    
    // Pode gerar "Destaque de Gastos" porque Mercado consumiu 100% (500/500)
    const titles = result.advice.map(a => a.title);
    expect(titles).toContain('Alta Concentração de Saídas');
    expect(titles).not.toContain('Aumento nas Despesas Globais'); // Falso positivo se quebrasse a matemática
  });
});
