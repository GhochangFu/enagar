import { buildHoardingCalculatorSnapshot, HOARDING_CALCULATOR_SNAPSHOT_FIELD } from './hoarding-quote.util';
import {
  applyHoardingTaxToApprovalSettlement,
  resolveHoardingApprovalFeeBreakdown,
} from './hoarding-approval-fee.util';

describe('hoarding-approval-fee.util', () => {
  const snapshot = buildHoardingCalculatorSnapshot({
    tax_paise: 1_800_000,
    revenue_head_code: 'tax-ad-hoarding',
    ward_matched: true,
    ward_code: '12',
    sqft: 80,
    duration_months: 3,
    rate_paise_per_sqft_per_month: 7500,
  });

  const formData = {
    [HOARDING_CALCULATOR_SNAPSHOT_FIELD]: JSON.stringify(snapshot),
  };

  it('combines permission fee and hoarding tax', () => {
    const breakdown = resolveHoardingApprovalFeeBreakdown(5_000_000, formData);
    expect(breakdown).toEqual({
      base_permission_fee_paise: 5_000_000,
      hoarding_tax_paise: 1_800_000,
      total_approval_paise: 6_800_000,
      has_calculator_snapshot: true,
    });
  });

  it('returns null when snapshot missing', () => {
    expect(resolveHoardingApprovalFeeBreakdown(5_000_000, {})).toBeNull();
  });

  it('updates approval settlement amount for ad-hoarding', () => {
    const next = applyHoardingTaxToApprovalSettlement(
      {
        approval: { status: 'not_required', payment_id: null, amount_paise: 5_000_000 },
      },
      'ad-hoarding',
      5_000_000,
      formData,
    );
    expect(next.approval?.amount_paise).toBe(6_800_000);
  });

  it('leaves settlement unchanged for other services', () => {
    const settlement = {
      approval: { status: 'not_required' as const, payment_id: null, amount_paise: 1000 },
    };
    expect(
      applyHoardingTaxToApprovalSettlement(settlement, 'birth-cert', 1000, formData),
    ).toEqual(settlement);
  });
});
