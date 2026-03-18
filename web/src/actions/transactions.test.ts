import { describe, it, expect } from 'vitest';
import { getDeleteMatchCriteria } from '../lib/transactions-logic';

describe('Split Deletion Logic (getDeleteMatchCriteria)', () => {
  const mockUserId = 'user-123';
  const mockTxId = 'tx-456';

  it('deve retornar critério de exclusão em GRUPO se a transação contiver split_group_id', () => {
    const tx = { split_group_id: 'split-789' };
    
    const criteria = getDeleteMatchCriteria(tx, mockTxId, mockUserId);
    
    expect(criteria.type).toBe('grupo');
    
    // Verifica se a query match aponta para o grupo e não para o ID único
    expect(criteria.match).toHaveProperty('split_group_id', 'split-789');
    expect(criteria.match).toHaveProperty('user_id', mockUserId);
    expect(criteria.match).not.toHaveProperty('id'); 
  });

  it('deve retornar critério INDIVIDUAL se a transação não tiver split_group_id', () => {
    // Caso de transação normal
    const tx = { split_group_id: null };
    
    const criteria = getDeleteMatchCriteria(tx, mockTxId, mockUserId);
    
    expect(criteria.type).toBe('individual');
    
    // Verifica se a query de exclusão é focada no ID único
    expect(criteria.match).toHaveProperty('id', mockTxId);
    expect(criteria.match).toHaveProperty('user_id', mockUserId);
    expect(criteria.match).not.toHaveProperty('split_group_id');
  });

  it('deve retornar critério INDIVIDUAL se a query do banco retornar undefined/null (ex: transação já apagada)', () => {
    const tx = null;
    
    const criteria = getDeleteMatchCriteria(tx, mockTxId, mockUserId);
    
    expect(criteria.type).toBe('individual');
    expect(criteria.match).toHaveProperty('id', mockTxId);
  });
});
