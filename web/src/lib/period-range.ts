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

export function getYearFilterOptions(
  selectedYear: string,
  referenceDate: Date = new Date(),
  yearsBack: number = 2,
) {
  const currentYear = referenceDate.getFullYear();
  const years = new Set<number>();

  for (let offset = 0; offset <= yearsBack; offset += 1) {
    years.add(currentYear - offset);
  }

  const selectedYearAsNumber = Number.parseInt(selectedYear, 10);
  if (
    !Number.isNaN(selectedYearAsNumber) &&
    selectedYearAsNumber >= 2000 &&
    selectedYearAsNumber <= 2100
  ) {
    years.add(selectedYearAsNumber);
  }

  return Array.from(years)
    .sort((a, b) => b - a)
    .map(String);
}
