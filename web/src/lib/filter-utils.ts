export function isResponsibleMatch(
  itemResponsavel: string | null | undefined,
  filtroValue: string | null | undefined
): boolean {
  const normalizedFilter = filtroValue?.trim();
  const filter = normalizedFilter ? normalizedFilter.toLowerCase() : "todos";

  if (filter === "todos") return true;

  return itemResponsavel?.trim().toLowerCase() === filter;
}
