/** Sprint 8.2D: kWh × per-kWh rate settlement math. */
export function computeEvSessionAmountPaise(kwhConsumed: number, ratePaisePerKwh: number): number {
  if (!Number.isFinite(kwhConsumed) || kwhConsumed < 0) {
    throw new Error('kWh consumed must be a non-negative number');
  }
  if (!Number.isInteger(ratePaisePerKwh) || ratePaisePerKwh <= 0) {
    throw new Error('Rate must be a positive integer paise per kWh');
  }
  return Math.round(kwhConsumed * ratePaisePerKwh);
}
