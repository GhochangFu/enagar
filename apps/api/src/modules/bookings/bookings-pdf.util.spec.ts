import {
  bookingNoToPathSegment,
  bookingRefFromPathSegment,
  buildBookingConfirmationPdfLines,
  formatBookingSlotIst,
} from './bookings-pdf.util';

describe('bookings-pdf.util', () => {
  it('round-trips booking numbers in URL path segments', () => {
    const bookingNo = 'BK/KMC/2026/00001';
    const segment = bookingNoToPathSegment(bookingNo);
    expect(segment).toBe('BK--KMC--2026--00001');
    expect(bookingRefFromPathSegment(segment)).toBe(bookingNo);
    expect(bookingRefFromPathSegment('550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('formats slot date and hours in IST', () => {
    const slot = formatBookingSlotIst(
      new Date('2026-06-10T04:30:00.000Z'),
      new Date('2026-06-10T05:30:00.000Z'),
    );
    expect(slot.date).toContain('2026');
    expect(slot.hours).toContain('IST');
    expect(slot.hours).toMatch(/–/);
  });

  it('builds confirmation PDF lines with amounts', () => {
    const lines = buildBookingConfirmationPdfLines({
      tenantName: 'Kolkata Municipal Corporation',
      tenantCode: 'KMC',
      assetName: 'Community Hall',
      assetCode: 'community-hall-main',
      bookingNo: 'BK/KMC/2026/00001',
      status: 'confirmed',
      slotDate: '10 June 2026',
      slotHours: '10:00 am – 11:00 am IST',
      rentPaise: 50_000,
      depositPaise: 500_000,
      generatedAt: new Date('2026-06-10T12:00:00.000Z'),
    });
    expect(lines.join('\n')).toContain('Booking Confirmation');
    expect(lines.join('\n')).toContain('BK/KMC/2026/00001');
    expect(lines.join('\n')).toContain('₹');
  });
});
