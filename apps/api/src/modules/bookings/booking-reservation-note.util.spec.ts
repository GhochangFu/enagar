import {
  buildBookingHoldNote,
  parseBookingReservationNote,
  serviceCodeFromReservationNote,
} from './booking-reservation-note.util';

describe('booking-reservation-note.util', () => {
  it('round-trips hold note with service_code ad-led', () => {
    const expires = new Date('2026-06-18T12:15:00.000Z');
    const note = buildBookingHoldNote({ holdExpiresAt: expires, serviceCode: 'ad-led' });
    expect(parseBookingReservationNote(note)).toEqual({
      hold_expires_at: expires.toISOString(),
      service_code: 'ad-led',
    });
    expect(serviceCodeFromReservationNote(note)).toBe('ad-led');
  });

  it('omits service_code when not provided', () => {
    const note = buildBookingHoldNote({ holdExpiresAt: new Date('2026-06-18T12:00:00.000Z') });
    expect(serviceCodeFromReservationNote(note)).toBeUndefined();
  });

  it('preserves clerk_review flag', () => {
    const note = buildBookingHoldNote({
      holdExpiresAt: new Date('2026-06-18T12:00:00.000Z'),
      serviceCode: 'community-hall',
      clerkReview: true,
    });
    expect(parseBookingReservationNote(note).clerk_review).toBe(true);
  });

  it('round-trips emergency ambulance metadata', () => {
    const expires = new Date('2026-06-18T12:15:00.000Z');
    const declared = new Date('2026-06-18T12:10:00.000Z');
    const note = buildBookingHoldNote({
      holdExpiresAt: expires,
      serviceCode: 'ambulance',
      emergency: true,
      emergencyDeclarationAt: declared,
      pickupAddress: { en: '12 Park Street' },
    });
    expect(parseBookingReservationNote(note)).toMatchObject({
      service_code: 'ambulance',
      emergency: true,
      emergency_declaration_at: declared.toISOString(),
      pickup_address: { en: '12 Park Street' },
    });
  });
});
