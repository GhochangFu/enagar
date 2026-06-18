import {
  EV_CHARGING_HOLD_TTL_MS,
  evChargingHoldExpiresAt,
  isActiveEvSessionStatus,
  isEvChargingHoldExpired,
} from './ev-charging-hold.util';

describe('ev-charging-hold.util', () => {
  it('expires holds after 15 minutes', () => {
    const now = new Date('2026-06-18T10:00:00.000Z');
    const expiresAt = evChargingHoldExpiresAt(now);
    expect(expiresAt.getTime() - now.getTime()).toBe(EV_CHARGING_HOLD_TTL_MS);
  });

  it('detects expired holds', () => {
    const expiresAt = new Date('2026-06-18T10:00:00.000Z');
    expect(isEvChargingHoldExpired(expiresAt, new Date('2026-06-18T10:00:01.000Z'))).toBe(true);
    expect(isEvChargingHoldExpired(expiresAt, new Date('2026-06-18T09:59:59.000Z'))).toBe(false);
  });

  it('treats HELD and CHARGING as active', () => {
    expect(isActiveEvSessionStatus('HELD')).toBe(true);
    expect(isActiveEvSessionStatus('CHARGING')).toBe(true);
    expect(isActiveEvSessionStatus('COMPLETED')).toBe(false);
  });
});
