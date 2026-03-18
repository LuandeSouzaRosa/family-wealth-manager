export function getDeleteMatchCriteria(tx: { split_group_id?: string | null } | null, id: string, userId: string) {
  if (tx?.split_group_id) {
    return { type: 'grupo', match: { split_group_id: tx.split_group_id, user_id: userId } };
  }
  return { type: 'individual', match: { id, user_id: userId } };
}
