import {
  buildHoardingCalculatorSnapshot,
  formatHoardingDimensions,
  HOARDING_CALCULATOR_SNAPSHOT_FIELD,
  parseHoardingCalculatorSnapshot,
  serializeHoardingCalculatorSnapshot,
} from './hoarding-quote.util';

describe('hoarding-quote.util', () => {
  const quote = {
    tax_paise: 1_800_000,
    revenue_head_code: 'tax-ad-hoarding',
    ward_matched: true,
    ward_code: '12',
    sqft: 80,
    duration_months: 3,
    rate_paise_per_sqft_per_month: 7500,
  };

  it('builds and parses calculator snapshot round-trip', () => {
    const snapshot = buildHoardingCalculatorSnapshot(quote, new Date('2026-06-18T10:00:00.000Z'));
    const serialized = serializeHoardingCalculatorSnapshot(snapshot);
    const parsed = parseHoardingCalculatorSnapshot({
      [HOARDING_CALCULATOR_SNAPSHOT_FIELD]: serialized,
    });

    expect(parsed).toEqual(snapshot);
  });

  it('returns null for invalid snapshot JSON', () => {
    expect(
      parseHoardingCalculatorSnapshot({
        [HOARDING_CALCULATOR_SNAPSHOT_FIELD]: '{not json',
      }),
    ).toBeNull();
  });

  it('formats hoarding dimensions for apply prefill', () => {
    expect(formatHoardingDimensions(10, 8)).toBe('10ft x 8ft');
  });
});
