import { buildTenantBookingSummary } from './admin-tenant-booking-summary.util';

describe('admin-tenant-booking-summary.util', () => {
  it('aggregates totals and breakdowns for the period window', () => {
    const periodRows = [
      {
        id: 'res-amb',
        bookingNo: 'BK/KMC/2026/00001',
        status: 'confirmed',
        startsAt: new Date('2026-06-10T04:30:00.000Z'),
        endsAt: new Date('2026-06-10T05:30:00.000Z'),
        holderName: 'Citizen A',
        note: JSON.stringify({ service_code: 'ambulance' }),
        asset: { code: 'kmc-ambulance-01', assetType: 'AMBULANCE' },
      },
      {
        id: 'res-hall',
        bookingNo: 'BK/KMC/2026/00002',
        status: 'hold',
        startsAt: new Date('2026-06-11T04:30:00.000Z'),
        endsAt: new Date('2026-06-11T06:30:00.000Z'),
        holderName: 'Citizen B',
        note: JSON.stringify({ service_code: 'community-hall' }),
        asset: { code: 'community-hall-main', assetType: 'HALL' },
      },
      {
        id: 'res-led',
        bookingNo: null,
        status: 'cancelled',
        startsAt: new Date('2026-06-12T04:30:00.000Z'),
        endsAt: new Date('2026-06-12T05:30:00.000Z'),
        holderName: 'Citizen C',
        note: JSON.stringify({ service_code: 'ad-led' }),
        asset: { code: 'kmc-led-central', assetType: 'LED_BOARD' },
      },
    ];

    const summary = buildTenantBookingSummary(periodRows, periodRows.slice(0, 1));

    expect(summary.period_days).toBe(30);
    expect(summary.totals).toEqual({ confirmed: 1, holds: 1, cancelled: 1 });
    expect(summary.by_asset_type).toEqual(
      expect.arrayContaining([
        { asset_type: 'AMBULANCE', confirmed: 1, holds: 0 },
        { asset_type: 'HALL', confirmed: 0, holds: 1 },
        { asset_type: 'LED_BOARD', confirmed: 0, holds: 0 },
      ]),
    );
    expect(summary.by_service_code).toEqual([{ service_code: 'ambulance', confirmed: 1 }]);
    expect(summary.recent).toHaveLength(1);
    expect(summary.recent[0]?.service_code).toBe('ambulance');
    expect(summary.recent[0]?.asset_code).toBe('kmc-ambulance-01');
  });
});
