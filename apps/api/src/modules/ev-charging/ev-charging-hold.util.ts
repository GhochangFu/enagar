/** Sprint 8.2D: EV charger slot hold TTL (15 minutes). */
export const EV_CHARGING_HOLD_TTL_MS = 15 * 60 * 1000;

export function evChargingHoldExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + EV_CHARGING_HOLD_TTL_MS);
}

export function isEvChargingHoldExpired(
  holdExpiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!holdExpiresAt) {
    return false;
  }
  return holdExpiresAt.getTime() <= now.getTime();
}

export function isActiveEvSessionStatus(status: string): boolean {
  return status === 'HELD' || status === 'CHARGING';
}
