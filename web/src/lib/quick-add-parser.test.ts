import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from './quick-add-parser';

describe('Quick Add Parser', () => {
  it('deve extrair valores e dados corretamente de uma despesa', () => {
    const result = parseQuickAdd('ifood 45 ontem');
    
    expect(result).not.toBeNull();
    expect(result?.descricao).toBe('Ifood');
    expect(result?.valor).toBe(45);
    expect(result?.tipo).toBe('Saída');
    expect(result?.categoria).toBe('Alimentação'); // auto-detected
    // Verifica se a data é o dia anterior ao de hoje
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    expect(result?.data.getDate()).toBe(ontem.getDate());
  });

  it('deve tratar decimais com vírgula', () => {
    const result = parseQuickAdd('uber 23,50 hoje');
    
    expect(result).not.toBeNull();
    expect(result?.descricao).toBe('Uber');
    expect(result?.valor).toBe(23.50);
    expect(result?.tipo).toBe('Saída');
    expect(result?.categoria).toBe('Transporte'); // auto-detected
    
    const hoje = new Date();
    expect(result?.data.getDate()).toBe(hoje.getDate());
  });

  it('deve identificar Entradas (ex: salário)', () => {
    const result = parseQuickAdd('salário 3000');
    
    expect(result).not.toBeNull();
    expect(result?.descricao).toBe('Salário');
    expect(result?.valor).toBe(3000);
    expect(result?.tipo).toBe('Entrada');
    expect(result?.categoria).toBe('Salário');
  });

  it('deve retornar null se não encontrar um valor numérico', () => {
    const result = parseQuickAdd('comprei um pão na padaria');
    expect(result).toBeNull();
  });

  it('deve ignorar palavras de preenchimento (filler words)', () => {
    const result = parseQuickAdd('mercado 120 crédito');
    expect(result?.descricao).toBe('Mercado');
  });
});
