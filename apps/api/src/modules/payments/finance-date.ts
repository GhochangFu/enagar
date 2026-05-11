/**
 * Interprets YYYY-MM-DD as an Indian civil day (Asia/Kolkata) and returns UTC instants [start, end]
 * inclusive of the full local day (for deterministic reconciliation filters).
 */
export function indianBusinessDayUtcBounds(dateYmd: string): { startUtc: Date; endUtc: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    throw new TypeError(`Invalid business_date '${dateYmd}', expected YYYY-MM-DD`);
  }
  const startUtc = new Date(`${dateYmd}T00:00:00+05:30`);
  const endUtc = new Date(`${dateYmd}T23:59:59.999+05:30`);
  if (Number.isNaN(startUtc.getTime()) || Number.isNaN(endUtc.getTime())) {
    throw new TypeError(`Invalid business_date '${dateYmd}'`);
  }
  return { startUtc, endUtc };
}
