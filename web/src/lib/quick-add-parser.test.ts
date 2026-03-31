import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from './quick-add-parser';

describe('Quick Add Parser', () => {
  it('deve extrair valores e dados corretamente de uma despesa', () => {
    const result = parseQuickAdd('ifood 45 ontem');

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(`Parser falhou: ${result.error}`);

    expect(result.data.descricao).toBe('Ifood');
    expect(result.data.valor).toBe(45);
    expect(result.data.tipo).toBe('Saída');
    expect(result.data.categoria).toBe('Alimentação');

    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    expect(result.data.data.getDate()).toBe(ontem.getDate());
  });

  it('deve tratar decimais com vírgula', () => {
    const result = parseQuickAdd('uber 23,50 hoje');

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(`Parser falhou: ${result.error}`);

    expect(result.data.descricao).toBe('Uber');
    expect(result.data.valor).toBe(23.5);
    expect(result.data.tipo).toBe('Saída');
    expect(result.data.categoria).toBe('Transporte');

    const hoje = new Date();
    expect(result.data.data.getDate()).toBe(hoje.getDate());
  });

  it('deve identificar entradas (ex: salário)', () => {
    const result = parseQuickAdd('salário 3000');

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(`Parser falhou: ${result.error}`);

    expect(result.data.descricao).toBe('Salário');
    expect(result.data.valor).toBe(3000);
    expect(result.data.tipo).toBe('Entrada');
    expect(result.data.categoria).toBe('Salário');
  });

  it('deve retornar erro estruturado se não encontrar valor numérico', () => {
    const result = parseQuickAdd('comprei um pão na padaria');

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Parser deveria falhar para entrada sem valor');
    expect(result.error).toContain('valor');
  });

  it('deve ignorar palavras de preenchimento (filler words)', () => {
    const result = parseQuickAdd('mercado 120 crédito');

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(`Parser falhou: ${result.error}`);
    expect(result.data.descricao).toBe('Mercado');
  });
});
