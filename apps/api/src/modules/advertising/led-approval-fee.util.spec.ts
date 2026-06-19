import {
  applyLedBookingToApprovalSettlement,
  resolveLedApprovalFeeBreakdown,
} from './led-approval-fee.util';
import { buildLedBookingSnapshot } from './led-booking-quote.util';

describe('led-approval-fee.util', () => {
  const snapshot = buildLedBookingSnapshot({
    asset_code: 'kmc-led-central',
    starts_at: '2026-06-22T00:30:00.000Z',
    ends_at: '2026-06-22T01:30:00.000Z',
    rent_paise: 100_000,
    deposit_paise: 100_000,
  });

  it('resolves rent + deposit from led_booking_snapshot', () => {
    const formData = { led_booking_snapshot: JSON.stringify(snapshot) };
    expect(resolveLedApprovalFeeBreakdown(formData)).toEqual({
      rent_paise: 100_000,
      deposit_paise: 100_000,
      total_approval_paise: 200_000,
      has_booking_snapshot: true,
    });
  });

  it('sets approval fee line for ad-led service', () => {
    const formData = { led_booking_snapshot: JSON.stringify(snapshot) };
    const updated = applyLedBookingToApprovalSettlement(
      { approval: { status: 'not_required', payment_id: null, amount_paise: 0 } },
      'ad-led',
      formData,
    );
    expect(updated.approval?.amount_paise).toBe(200_000);
  });
});
