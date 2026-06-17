import {
  isActiveSmartParkingReservation,
  isSmartParkingHoldExpired,
  parseSmartParkingHoldNote,
  tryParseSmartParkingHoldNote,
} from './smart-parking-hold.util';

describe('smart-parking-hold.util', () => {
  const note = {
    source: 'smart_parking' as const,
    bay_code: 'B06',
    zone_code: 'ZONE-A',
    hold_expires_at: '2026-06-17T12:00:00.000Z',
    vehicle_type: null,
    vehicle_number: 'WB06A1234',
  };

  it('parses a valid hold note', () => {
    const parsed = parseSmartParkingHoldNote(JSON.stringify(note));
    expect(parsed.vehicle_number).toBe('WB06A1234');
  });

  it('detects expired holds', () => {
    expect(isSmartParkingHoldExpired(note, 'hold', new Date('2026-06-17T12:00:01.000Z'))).toBe(
      true,
    );
    expect(isSmartParkingHoldExpired(note, 'hold', new Date('2026-06-17T11:59:59.000Z'))).toBe(
      false,
    );
    expect(isSmartParkingHoldExpired(note, 'confirmed', new Date('2026-06-17T13:00:00.000Z'))).toBe(
      false,
    );
  });

  it('treats overlapping non-expired holds as active', () => {
    const row = {
      status: 'hold',
      note: JSON.stringify(note),
      startsAt: new Date('2026-06-17T10:00:00.000Z'),
      endsAt: new Date('2026-06-17T11:00:00.000Z'),
    };
    expect(
      isActiveSmartParkingReservation(
        row,
        new Date('2026-06-17T10:30:00.000Z'),
        new Date('2026-06-17T11:30:00.000Z'),
        new Date('2026-06-17T10:15:00.000Z'),
      ),
    ).toBe(true);
  });

  it('ignores expired holds for overlap checks', () => {
    const row = {
      status: 'hold',
      note: JSON.stringify(note),
      startsAt: new Date('2026-06-17T10:00:00.000Z'),
      endsAt: new Date('2026-06-17T11:00:00.000Z'),
    };
    expect(
      isActiveSmartParkingReservation(
        row,
        new Date('2026-06-17T10:30:00.000Z'),
        new Date('2026-06-17T11:30:00.000Z'),
        new Date('2026-06-17T12:30:00.000Z'),
      ),
    ).toBe(false);
  });

  it('returns null for invalid notes', () => {
    expect(tryParseSmartParkingHoldNote('not-json')).toBeNull();
  });
});
