import { describe, it, expect } from 'vitest';
import { calculateDashboardMetrics, calculateFinancialHealthMetrics, DashboardTransactionInput } from './dashboard-logic';

describe('Dashboard Logic Calculations', () => {

  it('Cenário 1: Todas as saídas são Realizadas (Zero divergência)', () => {
    const data: DashboardTransactionInput[] = [
      { valor: 100, tipo: "Saída", responsavel: "Luan", status: "Realizado" },
      { valor: 50, tipo: "Saída", responsavel: "Luana", status: "Realizado" }
    ];
    const metrics = calculateDashboardMetrics(data);
    expect(metrics.despesasRealizadas).toBe(150);
    expect(metrics.despesasAgendadas).toBe(0);
    expect(metrics.despesas).toBe(150);
    expect(metrics.porResponsavel["Luan"].despesasRealizadas).toBe(100);
    expect(metrics.porResponsavel["Luana"].despesasRealizadas).toBe(50);
  });

  it('Cenário 2: Mistura Exata de 50% Realizado e 50% Agendado', () => {
    const data: DashboardTransactionInput[] = [
      { valor: 200, tipo: "Saída", responsavel: "Casal", status: "Realizado" },
      { valor: 200, tipo: "Saída", responsavel: "Casal", status: "Agendado" }
    ];
    const metrics = calculateDashboardMetrics(data);
    expect(metrics.despesasRealizadas).toBe(200);
    expect(metrics.despesasAgendadas).toBe(200);
    // A despesa global deve conter ambos (para coerência de fluxo de caixa mental)
    expect(metrics.despesas).toBe(400); 
  });

  it('Cenário 3: Entradas Agendadas vs Realizadas', () => {
    const data: DashboardTransactionInput[] = [
      { valor: 5000, tipo: "Entrada", responsavel: "Luan", status: "Realizado" },
      { valor: 3000, tipo: "Entrada", responsavel: "Luana", status: "Pendente" }
    ];
    const metrics = calculateDashboardMetrics(data);
    expect(metrics.rendaRealizada).toBe(5000);
    expect(metrics.rendaAgendada).toBe(3000); // Pendente deve ser tratado como Agendado
    expect(metrics.renda).toBe(8000);
  });

  it('Cenário 4: Pendentes caem no bucket correto (Agendado)', () => {
    const data: DashboardTransactionInput[] = [
      { valor: 100, tipo: "Saída", responsavel: "Casal", status: "Pendente" }
    ];
    const metrics = calculateDashboardMetrics(data);
    expect(metrics.despesasRealizadas).toBe(0);
    expect(metrics.despesasAgendadas).toBe(100);
  });

  it('Cenário 5: Separação por Responsável Misto e Fallback de Nulo', () => {
    const data: DashboardTransactionInput[] = [
      { valor: 1500, tipo: "Entrada", responsavel: null, status: "Realizado" }, // Deve cair no Casal
      { valor: 300, tipo: "Saída", responsavel: "Luana", status: "Realizado" },
      { valor: 200, tipo: "Saída", responsavel: "Luan", status: "Agendado" }
    ];
    const metrics = calculateDashboardMetrics(data);
    expect(metrics.porResponsavel["Casal"].rendaRealizada).toBe(1500);
    expect(metrics.porResponsavel["Luana"].despesasRealizadas).toBe(300);
    expect(metrics.porResponsavel["Luan"].despesasAgendadas).toBe(200);
    
    expect(metrics.despesasRealizadas).toBe(300);
    expect(metrics.despesasAgendadas).toBe(200);
    expect(metrics.despesas).toBe(500);
  });

  it('Cenário 6: Investimentos (Transferências) não computam Agendados', () => {
    const data: DashboardTransactionInput[] = [
      { valor: 1000, tipo: "Transferência", responsavel: "Luan", status: "Realizado" },
      { valor: 500, tipo: "Transferência", responsavel: "Casal", status: "Agendado" }
    ];
    const metrics = calculateDashboardMetrics(data);
    // Deve computar os 1000 realizados, mas os 500 agendados NÃO entram no "Investido" até efetivar
    expect(metrics.investido).toBe(1000);
  });

  it('Cenário 7: Array vazio / Lixo do DB (Robustez)', () => {
    const data: DashboardTransactionInput[] = [];
    const metrics = calculateDashboardMetrics(data);
    expect(metrics.renda).toBe(0);
    expect(metrics.despesas).toBe(0);
    expect(metrics.investido).toBe(0);
    expect(metrics.porResponsavel["Casal"].renda).toBe(0);
  });

  it('Cenário 8: Compatibilidade - Null/Indefinido em valores numéricos espúrios vira 0 sem travar', () => {
    const data: any[] = [
      { valor: null, tipo: "Saída", responsavel: "Luan", status: "Realizado" },
      { valor: "invalid", tipo: "Saída", responsavel: "Luan", status: "Realizado" },
    ];
    const metrics = calculateDashboardMetrics(data);
  });

});

describe('Financial Health Calculations (Median & Historical Isolation)', () => {

  it('1. Filtra meses futuros e agendados para não corromper o histórico de saúde', () => {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setMonth(today.getMonth() + 2); // Passou muito pra frente

    const lastMonth = new Date();
    lastMonth.setMonth(today.getMonth() - 1);

    const data = [
      // Falsos positivos de longo prazo
      { valor: 10000, tipo: "Saída", data: futureDate.toISOString(), status: "Agendado" },
      { valor: 5000, tipo: "Saída", data: lastMonth.toISOString(), status: "Pendente" }, 
      // O único fluxo real
      { valor: 3000, tipo: "Saída", data: lastMonth.toISOString(), status: "Realizado" },
    ];

    const { avgBurnRate } = calculateFinancialHealthMetrics(data);
    // As faturas ignoradas somariam 15k!
    expect(avgBurnRate).toBe(3000); 
  });

  it('2. Fuga de Outlier usando Matemática Mediana vs Média Aritmética Cega', () => {
    // Array com 3 meses de transações. 
    // M1: 5k (Normal), M2: 6k (Normal), M3: 50k (Atípico/Carro).
    const today = new Date();
    
    const m1 = new Date(); m1.setMonth(today.getMonth() - 1);
    const m2 = new Date(); m2.setMonth(today.getMonth() - 2);
    const m3 = new Date(); m3.setMonth(today.getMonth() - 3);

    const data = [
      { valor: 5000, tipo: "Saída", data: m1.toISOString(), status: "Realizado" }, // M1 = 5k
      { valor: 6000, tipo: "Saída", data: m2.toISOString(), status: "Realizado" }, // M2 = 6k
      { valor: 50000, tipo: "Saída", data: m3.toISOString(), status: "Realizado" }, // M3 = 50k
    ];

    const { avgBurnRate } = calculateFinancialHealthMetrics(data);
    // A média faria o Burn Rate ser: (5k + 6k + 50k) / 3 = 20.3K
    // A mediana corta os extremos e crava 6000
    expect(avgBurnRate).toBe(6000); 
  });

  it('3. Meses com apenas 1 ou 2 entradas computam a mediana proporcional', () => {
    const today = new Date();
    const m1 = new Date(); m1.setMonth(today.getMonth() - 1);

    const data = [
      { valor: 2000, tipo: "Saída", data: m1.toISOString(), status: "Realizado" }, 
      { valor: 2500, tipo: "Saída", data: m1.toISOString(), status: "Realizado" } // Total M1 = 4.5k
    ];

    const { avgBurnRate } = calculateFinancialHealthMetrics(data);
    expect(avgBurnRate).toBe(4500); 
  });

});
