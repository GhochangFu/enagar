import { BadRequestException } from '@nestjs/common';

import {
  computeSmartParkingRentPaise,
  minuteInBand,
  parseSmartParkingPricingMatrix,
  resolveRatePaisePerHour,
} from './smart-pricing.util';

describe('smart-pricing.util', () => {
  const pricing = parseSmartParkingPricingMatrix({
    flat_rate_paise_per_hour: 1000,
    time_bands: [
      { from_hhmm: '09:00', to_hhmm: '18:00', rate_paise_per_hour: 2000 },
      { from_hhmm: '18:00', to_hhmm: '09:00', rate_paise_per_hour: 3000 },
    ],
  });

  it('uses inclusive start and exclusive end for daytime bands', () => {
    expect(minuteInBand(9 * 60, 9 * 60, 18 * 60)).toBe(true);
    expect(minuteInBand(17 * 60 + 59, 9 * 60, 18 * 60)).toBe(true);
    expect(minuteInBand(18 * 60, 9 * 60, 18 * 60)).toBe(false);
  });

  it('handles overnight spans across midnight', () => {
    expect(minuteInBand(22 * 60, 18 * 60, 9 * 60)).toBe(true);
    expect(minuteInBand(8 * 60 + 59, 18 * 60, 9 * 60)).toBe(true);
    expect(minuteInBand(12 * 60, 18 * 60, 9 * 60)).toBe(false);
  });

  it('prorates rent across an overnight booking window', () => {
    const startsAt = new Date('2026-06-17T12:30:00.000Z'); // 18:00 IST
    const endsAt = new Date('2026-06-17T15:30:00.000Z'); // 21:00 IST
    const rentPaise = computeSmartParkingRentPaise({ pricing, startsAt, endsAt });
    expect(rentPaise).toBe(9000);
  });

  it('rejects zero-duration windows', () => {
    const instant = new Date('2026-06-17T10:00:00.000Z');
    expect(() =>
      computeSmartParkingRentPaise({ pricing, startsAt: instant, endsAt: instant }),
    ).toThrow(BadRequestException);
  });

  it('falls back to flat rate when no band matches', () => {
    const noonIst = new Date('2026-06-17T06:30:00.000Z');
    expect(resolveRatePaisePerHour({ flat_rate_paise_per_hour: 1500 }, undefined, noonIst)).toBe(
      1500,
    );
  });
});
