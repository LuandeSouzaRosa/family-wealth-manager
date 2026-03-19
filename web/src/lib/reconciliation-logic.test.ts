import { describe, it, expect } from 'vitest';
import { findBestMatch, normalizeDescription, calculateSimilarTokens, CandidateTransaction, CsvRow } from './reconciliation-logic';

describe('Reconciliation Logic', () => {
  describe('normalizeDescription', () => {
    it('deve remover pontuação e stop words', () => {
      expect(normalizeDescription('IFOOD*DELIVERY')).toEqual(['ifood', 'delivery']);
      expect(normalizeDescription('PAGAMENTO PARA SUPERMERCADO ZÉ')).toEqual(['pagamento', 'supermercado']);
    });
  });

  describe('calculateSimilarTokens', () => {
    it('deve calcular matching básico de palavras', () => {
      expect(calculateSimilarTokens('ifood 45', 'IFOOD*DELIVERY')).toBe(1);
    });
  });

  describe('findBestMatch', () => {
    it('deve encontrar match Forte para mesma data, valor e palavra-chave', () => {
      const csvRow: CsvRow = {
        descricao: 'IFOOD*DELIVERY',
        valor: 45.00,
        data: '2023-10-01T12:00:00Z',
        tipo: 'Saída'
      };

      const candidates: CandidateTransaction[] = [
        {
          id: '1',
          descricao: 'Ifood',
          valor: 45.00,
          data: '2023-10-01T10:00:00Z',
          tipo: 'Saída'
        }
      ];

      const match = findBestMatch(csvRow, candidates);
      expect(match.level).toBe('Exato');
      expect(match.candidateId).toBe('1');
    });

    it('deve identificar a transação como Split Group corretamente', () => {
      const csvRow: CsvRow = {
        descricao: 'CLARO S/A',
        valor: 150.00,
        data: '2023-10-05T00:00:00Z',
        tipo: 'Saída'
      };

      const candidates: CandidateTransaction[] = [
        {
          id: 'random',
          descricao: 'Internet Casa',
          valor: 150.00,
          data: '2023-10-03T00:00:00Z',
          tipo: 'Saída',
          is_split_group: true,
          split_group_id: 'split-123'
        }
      ];

      const match = findBestMatch(csvRow, candidates);
      // Valor exato, diferença de 2 dias, zero tokens bate. Deveria ser Possível.
      expect(match.level).toBe('Possível');
      expect(match.candidateId).toBe('split-123');
      expect(match.isSplitGroup).toBe(true);
    });

    it('deve falhar se a diferença de valor for maior que 0.05', () => {
      const csvRow: CsvRow = { descricao: 'Luz', valor: 100.00, data: '2023-10-01', tipo: 'Saída' };
      const candidates: CandidateTransaction[] = [
        { id: '1', descricao: 'Luz', valor: 80.00, data: '2023-10-01', tipo: 'Saída' }
      ];

      const match = findBestMatch(csvRow, candidates);
      expect(match.level).toBe('Sem_Match');
    });

    it('deve ignorar Direção/Tipo incorretos', () => {
      const csvRow: CsvRow = { descricao: 'Salário', valor: 3000.00, data: '2023-10-01', tipo: 'Entrada' };
      const candidates: CandidateTransaction[] = [
        { id: '1', descricao: 'Salário Antecipado', valor: 3000.00, data: '2023-10-01', tipo: 'Saída' }
      ];

      const match = findBestMatch(csvRow, candidates);
      expect(match.level).toBe('Sem_Match');
    });

    it('deve priorizar o Match Exato sobre Possível quando há conflito de dias', () => {
      const csvRow: CsvRow = { descricao: 'Uber', valor: 25.00, data: '2023-10-05', tipo: 'Saída' };
      const candidates: CandidateTransaction[] = [
        { id: '1', descricao: 'Viagem', valor: 25.00, data: '2023-10-01', tipo: 'Saída' }, // 4 days, 0 tokens = Possível
        { id: '2', descricao: 'Uber ida pro trabalho', valor: 25.00, data: '2023-10-04', tipo: 'Saída' } // 1 day, 1 token = Exato
      ];

      const match = findBestMatch(csvRow, candidates);
      expect(match.level).toBe('Exato');
      expect(match.candidateId).toBe('2');
    });
  });
});
