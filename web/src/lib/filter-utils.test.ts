import { describe, it, expect } from 'vitest';
import { isResponsibleMatch, resolveResponsibleForNewTransaction } from './filter-utils';

describe('isResponsibleMatch', () => {
  it('deve retornar true quando filtro for Todos, nulo, vazio ou conter apenas espacos', () => {
    expect(isResponsibleMatch('Luan', 'Todos')).toBe(true);
    expect(isResponsibleMatch('Casal', null)).toBe(true);
    expect(isResponsibleMatch('Luana', undefined)).toBe(true);
    expect(isResponsibleMatch('Luan', '   ')).toBe(true);
    expect(isResponsibleMatch('Luan', '')).toBe(true);
    expect(isResponsibleMatch(null, 'Todos')).toBe(true);
  });

  it('deve retornar true apenas quando os nomes baterem ignorando case', () => {
    expect(isResponsibleMatch('Luan', 'Luan')).toBe(true);
    expect(isResponsibleMatch('luan', 'Luan')).toBe(true);
    expect(isResponsibleMatch('LUAN', 'luan')).toBe(true);
    expect(isResponsibleMatch('Casal', 'Casal')).toBe(true);
  });

  it('deve retornar false quando os nomes forem diferentes', () => {
    expect(isResponsibleMatch('Casal', 'Luan')).toBe(false);
    expect(isResponsibleMatch('Luan', 'Luana')).toBe(false);
    expect(isResponsibleMatch('Luana', 'Casal')).toBe(false);
  });

  it('restricao estrita: Casal nao da match com Luan', () => {
    expect(isResponsibleMatch('Casal', 'Luan')).toBe(false);
    expect(isResponsibleMatch('Casal', 'Luana')).toBe(false);
  });
});

describe('resolveResponsibleForNewTransaction', () => {
  it('deve usar o responsavel filtrado quando ele for especifico', () => {
    expect(resolveResponsibleForNewTransaction('Luan')).toBe('Luan');
    expect(resolveResponsibleForNewTransaction('luana')).toBe('Luana');
    expect(resolveResponsibleForNewTransaction('CASAL')).toBe('Casal');
  });

  it('deve usar Casal quando filtro estiver em Todos, vazio ou invalido', () => {
    expect(resolveResponsibleForNewTransaction('Todos')).toBe('Casal');
    expect(resolveResponsibleForNewTransaction('')).toBe('Casal');
    expect(resolveResponsibleForNewTransaction(undefined)).toBe('Casal');
    expect(resolveResponsibleForNewTransaction('qualquer')).toBe('Casal');
  });
});
