import { describe, it, expect } from 'vitest';
import { OrcamentoSchema, SplitTransactionSchema } from './schemas';

describe('SplitTransactionSchema', () => {
  const validBase = {
    descricao: 'Jantar Restaurante',
    valor_total: 100,
    categoria: 'Alimentação',
    tipo: 'Saída',
  };

  it('deve validar um split válido', () => {
    const data = {
      ...validBase,
      splits: [
        { responsavel: 'Luan', valor: 60 },
        { responsavel: 'Luana', valor: 40 },
      ],
    };

    const result = SplitTransactionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('deve rejeitar se faltar responsáveis ou tiver menos de 2 splits', () => {
    const data = {
      ...validBase,
      splits: [{ responsavel: 'Luan', valor: 100 }],
    };

    const result = SplitTransactionSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(e => e.path.join('.'));
      expect(paths).toContain('splits');
    }
  });

  it('deve rejeitar valores de split negativos ou zero', () => {
    const data = {
      ...validBase,
      splits: [
        { responsavel: 'Luan', valor: 100 },
        { responsavel: 'Luana', valor: 0 },
      ],
    };

    const result = SplitTransactionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('deve rejeitar se a soma dos splits não bater com o valor_total', () => {
    const data = {
      ...validBase,
      splits: [
        { responsavel: 'Luan', valor: 50 },
        { responsavel: 'Luana', valor: 40 },
      ],
    };

    const result = SplitTransactionSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(e => e.message.includes('A soma dos splits deve ser igual ao valor total'))).toBe(true);
    }
  });

  it('deve permitir pequenas divergências de precisão flutuante (delta 0.01)', () => {
    const data = {
      ...validBase,
      valor_total: 100.01,
      splits: [
        { responsavel: 'Luan', valor: 50.00 },
        { responsavel: 'Luana', valor: 50.01 },
      ],
    };

    const result = SplitTransactionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('OrcamentoSchema', () => {
  it('deve validar payload com limite_mensal', () => {
    const result = OrcamentoSchema.safeParse({
      categoria: 'Alimentacao',
      limite_mensal: 500,
      responsavel: 'Casal',
    });

    expect(result.success).toBe(true);
  });

  it('deve rejeitar payload legado com chave limite (contrato explicito)', () => {
    const result = OrcamentoSchema.safeParse({
      categoria: 'Alimentacao',
      limite: 500,
      responsavel: 'Casal',
    });

    expect(result.success).toBe(false);
  });
});
