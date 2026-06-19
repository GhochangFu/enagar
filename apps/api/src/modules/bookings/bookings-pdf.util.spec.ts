import {
  bookingNoToPathSegment,
  bookingRefFromPathSegment,
  buildBookingConfirmationPdfLines,
  buildBookingConfirmationPdfModel,
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

  it('includes service_code on confirmation PDF when provided', () => {
    const lines = buildBookingConfirmationPdfLines({
      tenantName: 'Kolkata Municipal Corporation',
      tenantCode: 'KMC',
      assetName: 'KMC LED — Central',
      assetCode: 'kmc-led-central',
      bookingNo: 'BK/KMC/2026/00042',
      status: 'confirmed',
      slotDate: '10 June 2026',
      slotHours: '10:00 am – 11:00 am IST',
      rentPaise: 100_000,
      depositPaise: 100_000,
      serviceCode: 'ad-led',
      generatedAt: new Date('2026-06-10T12:00:00.000Z'),
    });
    expect(lines.join('\n')).toContain('Service: ad-led');
  });

  it('omits asset line on health fleet citizen PDF', () => {
    const lines = buildBookingConfirmationPdfLines({
      tenantName: 'Kolkata Municipal Corporation',
      tenantCode: 'KMC',
      assetName: 'KMC Ambulance 01',
      assetCode: 'kmc-ambulance-01',
      bookingNo: 'BK/KMC/2026/00099',
      status: 'confirmed',
      slotDate: '10 June 2026',
      slotHours: '10:00 am – 11:00 am IST',
      rentPaise: 0,
      depositPaise: 0,
      serviceCode: 'ambulance',
      hideAssetLine: true,
      pickupAddressText: '12 Park Street, Kolkata',
      holderMobile: '9876500099',
      emergency: true,
      generatedAt: new Date('2026-06-10T12:00:00.000Z'),
    });
    const text = lines.join('\n');
    expect(text).not.toContain('kmc-ambulance-01');
    expect(text).not.toContain('Asset:');
    expect(text).toContain('Pickup address: 12 Park Street, Kolkata');
    expect(text).toContain('Emergency booking: yes');
  });

  it('builds PDF model with formatted amounts and hall asset label', () => {
    const model = buildBookingConfirmationPdfModel({
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
    expect(model.statusLabel).toBe('Confirmed');
    expect(model.assetLabel).toContain('community-hall-main');
    expect(model.rentFormatted).toContain('₹');
    expect(model.totalFormatted).toContain('₹');
  });

  it('builds PDF model without asset for health fleet', () => {
    const model = buildBookingConfirmationPdfModel({
      tenantName: 'Kolkata Municipal Corporation',
      tenantCode: 'KMC',
      assetName: 'KMC Ambulance 01',
      assetCode: 'kmc-ambulance-01',
      bookingNo: 'BK/KMC/2026/00099',
      status: 'confirmed',
      slotDate: '10 June 2026',
      slotHours: '10:00 am – 11:00 am IST',
      rentPaise: 0,
      depositPaise: 0,
      serviceCode: 'ambulance',
      hideAssetLine: true,
      pickupAddressText: '12 Park Street, Kolkata',
      emergency: true,
      generatedAt: new Date('2026-06-10T12:00:00.000Z'),
    });
    expect(model.assetLabel).toBeUndefined();
    expect(model.serviceLabel).toBe('Municipal ambulance');
    expect(model.pickupAddress).toBe('12 Park Street, Kolkata');
  });
});
