import { buildBookingConfirmationPdfModel } from './bookings-pdf.util';
import { renderBookingConfirmationPdf } from './bookings-confirmation.pdf';

describe('bookings-confirmation.pdf', () => {
  it('produces a buffer that starts with the PDF magic bytes', async () => {
    const pdf = await renderBookingConfirmationPdf(
      buildBookingConfirmationPdfModel({
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
        serviceCode: 'community-hall',
        generatedAt: new Date('2026-06-10T12:00:00.000Z'),
      }),
    );
    expect(pdf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1_500);
    expect(
      buildBookingConfirmationPdfModel({
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
        serviceCode: 'community-hall',
        generatedAt: new Date('2026-06-10T12:00:00.000Z'),
      }).bookingNo,
    ).toBe('BK/KMC/2026/00001');
  });

  it('renders health fleet PDF without asset label in model', async () => {
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
      holderMobile: '9876500099',
      emergency: true,
      generatedAt: new Date('2026-06-10T12:00:00.000Z'),
    });
    expect(model.assetLabel).toBeUndefined();
    expect(model.serviceLabel).toBe('Municipal ambulance');
    expect(model.pickupAddress).toBe('12 Park Street, Kolkata');
    expect(model.emergency).toBe(true);

    const pdf = await renderBookingConfirmationPdf(model);
    expect(pdf.subarray(0, 4).toString('utf8')).toBe('%PDF');
  });
});
