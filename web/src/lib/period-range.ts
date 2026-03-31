export function getCurrentMonthIsoRange(referenceDate: Date = new Date()) {
  const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const startOfNextMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);

  return {
    startIso: startOfMonth.toISOString(),
    endExclusiveIso: startOfNextMonth.toISOString(),
  };
}

export function getPreviousMonthIsoRange(referenceDate: Date = new Date()) {
  const startOfCurrentMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const startOfPreviousMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);

  return {
    startIso: startOfPreviousMonth.toISOString(),
    endExclusiveIso: startOfCurrentMonth.toISOString(),
  };
}
