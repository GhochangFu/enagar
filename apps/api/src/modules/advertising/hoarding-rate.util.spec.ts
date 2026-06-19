import { BadRequestException } from '@nestjs/common';

import {
  computeHoardingTaxPaise,
  DEFAULT_FLAT_RATE_PAISE_PER_SQFT_PER_MONTH,
  HOARDING_TAX_REVENUE_HEAD_CODE,
  MAX_HOARDING_DURATION_MONTHS,
  parseHoardingRateMatrix,
  validateHoardingRateMatrix,
} from './hoarding-rate.util';

describe('hoarding-rate.util', () => {
  const matrix = parseHoardingRateMatrix({
    flat_rate_paise_per_sqft_per_month: 5000,
    ward_rates: [
      { ward_code: '12', rate_paise_per_sqft_per_month: 7500 },
      { ward_code: '64', rate_paise_per_sqft_per_month: 6000 },
    ],
  });

  it('uses ward-specific rate when ward_code matches', () => {
    const quote = computeHoardingTaxPaise({
      matrix,
      wardCode: '12',
      widthFt: 10,
      heightFt: 8,
      durationMonths: 3,
    });
    expect(quote.ward_matched).toBe(true);
    expect(quote.rate_paise_per_sqft_per_month).toBe(7500);
    expect(quote.sqft).toBe(80);
    expect(quote.tax_paise).toBe(80 * 3 * 7500);
    expect(quote.revenue_head_code).toBe(HOARDING_TAX_REVENUE_HEAD_CODE);
  });

  it('falls back to flat rate for unknown ward', () => {
    const quote = computeHoardingTaxPaise({
      matrix,
      wardCode: '99',
      widthFt: 10,
      heightFt: 8,
      durationMonths: 1,
    });
    expect(quote.ward_matched).toBe(false);
    expect(quote.rate_paise_per_sqft_per_month).toBe(5000);
    expect(quote.tax_paise).toBe(80 * 5000);
  });

  it('uses default flat rate when matrix is empty', () => {
    const quote = computeHoardingTaxPaise({
      matrix: {},
      wardCode: '12',
      widthFt: 5,
      heightFt: 4,
      durationMonths: 2,
    });
    expect(quote.rate_paise_per_sqft_per_month).toBe(DEFAULT_FLAT_RATE_PAISE_PER_SQFT_PER_MONTH);
    expect(quote.tax_paise).toBe(20 * 2 * DEFAULT_FLAT_RATE_PAISE_PER_SQFT_PER_MONTH);
  });

  it('rounds fractional sqft to two decimal places', () => {
    const quote = computeHoardingTaxPaise({
      matrix: { flat_rate_paise_per_sqft_per_month: 1000 },
      wardCode: '12',
      widthFt: 10.5,
      heightFt: 8.25,
      durationMonths: 1,
    });
    expect(quote.sqft).toBe(86.63);
    expect(quote.tax_paise).toBe(Math.round(86.63 * 1000));
  });

  it('accepts duration at boundaries 1 and 12 months', () => {
    expect(
      computeHoardingTaxPaise({
        matrix,
        wardCode: '12',
        widthFt: 1,
        heightFt: 1,
        durationMonths: 1,
      }).duration_months,
    ).toBe(1);
    expect(
      computeHoardingTaxPaise({
        matrix,
        wardCode: '12',
        widthFt: 1,
        heightFt: 1,
        durationMonths: MAX_HOARDING_DURATION_MONTHS,
      }).duration_months,
    ).toBe(12);
  });

  it('rejects zero or negative dimensions', () => {
    expect(() =>
      computeHoardingTaxPaise({
        matrix,
        wardCode: '12',
        widthFt: 0,
        heightFt: 8,
        durationMonths: 1,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      computeHoardingTaxPaise({
        matrix,
        wardCode: '12',
        widthFt: 10,
        heightFt: -1,
        durationMonths: 1,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects invalid duration months', () => {
    expect(() =>
      computeHoardingTaxPaise({
        matrix,
        wardCode: '12',
        widthFt: 10,
        heightFt: 8,
        durationMonths: 0,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      computeHoardingTaxPaise({
        matrix,
        wardCode: '12',
        widthFt: 10,
        heightFt: 8,
        durationMonths: 13,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects tax_paise overflow', () => {
    expect(() =>
      computeHoardingTaxPaise({
        matrix: { flat_rate_paise_per_sqft_per_month: 2_000_000_000 },
        wardCode: '12',
        widthFt: 1000,
        heightFt: 1000,
        durationMonths: 12,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects duplicate ward codes in matrix validation', () => {
    expect(() =>
      validateHoardingRateMatrix({
        ward_rates: [
          { ward_code: '12', rate_paise_per_sqft_per_month: 1000 },
          { ward_code: '12', rate_paise_per_sqft_per_month: 2000 },
        ],
      }),
    ).toThrow(BadRequestException);
  });
});
