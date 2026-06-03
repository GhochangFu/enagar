import { resolveBookingChargesSummary } from './booking-charges-summary.util';

import type { PrismaService } from '../../common/database/prisma.service';

describe('resolveBookingChargesSummary', () => {
  it('returns null when form has no booking markers', async () => {
    const prisma = {} as PrismaService;
    const result = await resolveBookingChargesSummary(prisma, 't1', 'a1', {}, {});
    expect(result).toBeNull();
  });

  it('sums upfront total from form_data fee lines', async () => {
    const prisma = {
      bookingReservation: { findFirst: async () => null },
      bookableAsset: { findFirst: async () => null },
    } as unknown as PrismaService;

    const result = await resolveBookingChargesSummary(
      prisma,
      't1',
      'a1',
      {
        bookable_asset_code: 'hall-main',
        booking_starts_at: '2026-06-05T04:30:00.000Z',
        booking_ends_at: '2026-06-05T07:30:00.000Z',
        booking_rent_paise: 150_000,
        booking_deposit_paise: 500_000,
        booking_application_fee_paise: 500_000,
      },
      { application: { status: 'paid', payment_id: 'p1', amount_paise: 500_000 } },
    );

    expect(result).not.toBeNull();
    expect(result?.upfront_total_paise).toBe(1_150_000);
    expect(result?.application_fee_status).toBe('paid');
    expect(result?.hall_rent_status).toBe('pending');
    expect(result?.upfront_paid_paise).toBe(500_000);
    expect(result?.reservation_id).toBeNull();
  });
});
