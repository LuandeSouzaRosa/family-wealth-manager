export function isResponsibleMatch(
  itemResponsavel: string | null | undefined,
  filtroValue: string | null | undefined
): boolean {
  const normalizedFilter = filtroValue?.trim();
  const filter = normalizedFilter ? normalizedFilter.toLowerCase() : "todos";

  if (filter === "todos") return true;

  return itemResponsavel?.trim().toLowerCase() === filter;
}

export function resolveResponsibleForNewTransaction(
  filtroValue: string | null | undefined,
): "Casal" | "Luan" | "Luana" {
  const normalizedFilter = filtroValue?.trim();
  const filter = normalizedFilter ? normalizedFilter.toLowerCase() : "todos";

  if (filter === "luan") return "Luan";
  if (filter === "luana") return "Luana";
  if (filter === "casal") return "Casal";

  return "Casal";
}
