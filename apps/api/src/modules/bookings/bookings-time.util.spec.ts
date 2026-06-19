import { BadRequestException } from '@nestjs/common';

import { MAX_SLOT_RANGE_DAYS, parseSlotRange } from './bookings-time.util';

describe('bookings-time.util', () => {
  it('exports a 90-day slot query cap', () => {
    expect(MAX_SLOT_RANGE_DAYS).toBe(90);
  });

  it('accepts ranges within the cap', () => {
    const from = '2026-06-01T00:00:00.000Z';
    const to = '2026-06-15T00:00:00.000Z';
    expect(parseSlotRange(from, to)).toEqual({
      from: new Date(from),
      to: new Date(to),
    });
  });

  it('rejects ranges wider than the cap', () => {
    const from = '2026-01-01T00:00:00.000Z';
    const to = '2026-05-01T00:00:00.000Z';
    expect(() => parseSlotRange(from, to)).toThrow(BadRequestException);
    expect(() => parseSlotRange(from, to)).toThrow(`Slot range must be <= ${MAX_SLOT_RANGE_DAYS} days`);
  });

  it('rejects inverted ranges', () => {
    expect(() =>
      parseSlotRange('2026-06-02T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
    ).toThrow('from must be before to');
  });
});
