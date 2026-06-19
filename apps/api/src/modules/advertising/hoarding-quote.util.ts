import type { HoardingQuoteResult } from './hoarding-rate.util';

export const HOARDING_CALCULATOR_SNAPSHOT_FIELD = 'hoarding_calculator_snapshot';

export type HoardingCalculatorSnapshot = HoardingQuoteResult & {
  quoted_at: string;
};

export function buildHoardingCalculatorSnapshot(
  quote: HoardingQuoteResult,
  quotedAt: Date = new Date(),
): HoardingCalculatorSnapshot {
  return {
    ...quote,
    quoted_at: quotedAt.toISOString(),
  };
}

export function serializeHoardingCalculatorSnapshot(snapshot: HoardingCalculatorSnapshot): string {
  return JSON.stringify(snapshot);
}

export function parseHoardingCalculatorSnapshot(
  formData: Record<string, unknown>,
): HoardingCalculatorSnapshot | null {
  const raw = formData[HOARDING_CALCULATOR_SNAPSHOT_FIELD];
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<HoardingCalculatorSnapshot>;
    if (
      typeof parsed.ward_code !== 'string' ||
      typeof parsed.sqft !== 'number' ||
      typeof parsed.duration_months !== 'number' ||
      typeof parsed.tax_paise !== 'number' ||
      typeof parsed.rate_paise_per_sqft_per_month !== 'number' ||
      typeof parsed.revenue_head_code !== 'string' ||
      typeof parsed.ward_matched !== 'boolean' ||
      typeof parsed.quoted_at !== 'string'
    ) {
      return null;
    }
    return parsed as HoardingCalculatorSnapshot;
  } catch {
    return null;
  }
}

export function formatHoardingDimensions(widthFt: number, heightFt: number): string {
  return `${widthFt}ft x ${heightFt}ft`;
}
