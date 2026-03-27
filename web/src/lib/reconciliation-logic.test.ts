import { describe, it, expect } from 'vitest';
import { findBestMatch, normalizeDescription, calculateSimilarTokens, CandidateTransaction, CsvRow, parseMoney } from './reconciliation-logic';

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

  describe('parseMoney (Hardening)', () => {
    it('deve parsear formato BR 1.200,50', () => expect(parseMoney('1.200,50')).toBe(1200.5));
    it('deve parsear formato US 1,200.50', () => expect(parseMoney('1,200.50')).toBe(1200.5));
    it('deve parsear numeros limpos 1200.50', () => expect(parseMoney('1200.50')).toBe(1200.5));
    it('deve parsear com multiplas virgulas US 1,200,000.00', () => expect(parseMoney('1,200,000.00')).toBe(1200000));
    it('deve parsear negativo e contabil (150.00)', () => {
       expect(parseMoney('-150.00')).toBe(-150);
       expect(parseMoney('(150.00)')).toBe(-150);
       expect(parseMoney('R$ - 150,00')).toBe(-150);
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
      expect(match.reasons).toContain('Valor exato');
      expect(match.reasons).toContain('Data próxima');
      expect(match.reasons).toContain('Descrição parecida'); // apenas 1 token bateu ('ifood')
    });

    it('deve identificar a transação como Split Group corretamente com suas razões', () => {
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
      expect(match.reasons).toContain('Valor exato');
      expect(match.reasons).toContain('Data próxima');
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

    it('deve priorizar o Match Exato sobre Possível quando há conflito de dias preservando os motivos', () => {
      const csvRow: CsvRow = { descricao: 'Uber', valor: 25.00, data: '2023-10-05', tipo: 'Saída' };
      const candidates: CandidateTransaction[] = [
        { id: '1', descricao: 'Viagem', valor: 25.00, data: '2023-10-01', tipo: 'Saída' }, // 4 dias, 0 token, SemMatch!
        { id: '2', descricao: 'Uber ida pro trabalho', valor: 25.00, data: '2023-10-04', tipo: 'Saída' } // 1 dia, 1 token = Exato
      ];

      const match = findBestMatch(csvRow, candidates);
      expect(match.level).toBe('Exato');
      expect(match.candidateId).toBe('2');
    });

    it('Conservadorismo: Disputa/Conflito faz downgrade automático para Possível', () => {
      // Dois Ubers cobrados no mesmo dia pelo exato mesmo valor
      const csvRow: CsvRow = { descricao: 'UBER DO BRASIL', valor: 30.00, data: '2023-10-05', tipo: 'Saída' };
      const candidates: CandidateTransaction[] = [
        { id: '1', descricao: 'Uber ida', valor: 30.00, data: '2023-10-05', tipo: 'Saída' },
        { id: '2', descricao: 'Uber volta', valor: 30.00, data: '2023-10-05', tipo: 'Saída' }
      ];

      const match = findBestMatch(csvRow, candidates);
      // Apesar de ser score máximo para ambos, a engine tem que ser pessimista.
      expect(match.level).toBe('Possível'); 
      expect(match.reasons[0]).toContain('Disputa visível');
    });

    it('Conservadorismo: Vetar otimismo nulo em valores redondos (Genéricos)', () => {
        // Assinatura genérica "PAGAMENTO" com 50.00 sem texto relacionado, cai na malha fina.
        const csvRow: CsvRow = { descricao: 'PAGAMENTO BOLETO', valor: 50.00, data: '2023-10-05', tipo: 'Saída' };
        const candidates: CandidateTransaction[] = [
          { id: '1', descricao: 'Restaurante aleatório', valor: 50.00, data: '2023-10-05', tipo: 'Saída' } 
        ];
  
        const match = findBestMatch(csvRow, candidates);
        expect(match.level).toBe('Possível');
        expect(match.reasons).toContain('Match Fraco: Valor redondo comum');
        expect(match.reasons).toContain('Descrições divergentes');
    });

    it('Conservadorismo: Interromper ligação Cega de Data distante sem suporte de token', () => {
        // Descrição divergente e >2 dias = Nada feito
        const csvRow: CsvRow = { descricao: 'Hospedagem', valor: 550.00, data: '2023-10-05', tipo: 'Saída' };
        const candidates: CandidateTransaction[] = [
          { id: '1', descricao: 'Plano de Saúde', valor: 550.00, data: '2023-10-01', tipo: 'Saída' } // 4 dias de diferença
        ];
  
        const match = findBestMatch(csvRow, candidates);
        expect(match.level).toBe('Sem_Match');
    });
  });
});
