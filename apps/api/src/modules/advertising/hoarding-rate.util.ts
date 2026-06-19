import { BadRequestException } from '@nestjs/common';

export const HOARDING_TAX_REVENUE_HEAD_CODE = 'tax-ad-hoarding';
export const AD_HOARDING_SERVICE_CODE = 'ad-hoarding';
export const DEFAULT_FLAT_RATE_PAISE_PER_SQFT_PER_MONTH = 5000;
export const MIN_HOARDING_DURATION_MONTHS = 1;
export const MAX_HOARDING_DURATION_MONTHS = 12;
export const MAX_HOARDING_MATRIX_ROWS = 200;
const MAX_TAX_PAISE = 2_147_483_647;

export type HoardingWardRate = {
  ward_code: string;
  rate_paise_per_sqft_per_month: number;
};

export type HoardingRateMatrix = {
  flat_rate_paise_per_sqft_per_month?: number;
  ward_rates?: HoardingWardRate[];
};

export type HoardingQuoteResult = {
  tax_paise: number;
  revenue_head_code: string;
  ward_matched: boolean;
  ward_code: string;
  sqft: number;
  duration_months: number;
  rate_paise_per_sqft_per_month: number;
};

export function parseHoardingRateMatrix(value: unknown): HoardingRateMatrix {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const flat = record.flat_rate_paise_per_sqft_per_month;
  const wardRatesRaw = record.ward_rates;
  const ward_rates = Array.isArray(wardRatesRaw)
    ? wardRatesRaw
        .filter(
          (row): row is HoardingWardRate =>
            !!row &&
            typeof row === 'object' &&
            typeof (row as HoardingWardRate).ward_code === 'string' &&
            typeof (row as HoardingWardRate).rate_paise_per_sqft_per_month === 'number',
        )
        .map((row) => ({
          ward_code: row.ward_code.trim(),
          rate_paise_per_sqft_per_month: row.rate_paise_per_sqft_per_month,
        }))
    : undefined;

  return {
    ...(typeof flat === 'number' && Number.isFinite(flat) ? { flat_rate_paise_per_sqft_per_month: flat } : {}),
    ...(ward_rates?.length ? { ward_rates } : {}),
  };
}

export function validateHoardingRateMatrix(matrix: HoardingRateMatrix): void {
  const flat = matrix.flat_rate_paise_per_sqft_per_month;
  if (flat !== undefined && (!Number.isFinite(flat) || flat < 0)) {
    throw new BadRequestException('flat_rate_paise_per_sqft_per_month must be a non-negative number');
  }

  const rows = matrix.ward_rates ?? [];
  if (rows.length > MAX_HOARDING_MATRIX_ROWS) {
    throw new BadRequestException(`hoarding_rate_matrix supports at most ${MAX_HOARDING_MATRIX_ROWS} ward rows`);
  }

  const seen = new Set<string>();
  for (const row of rows) {
    const code = row.ward_code.trim();
    if (!code) {
      throw new BadRequestException('ward_code is required for each ward rate row');
    }
    const normalized = code.toLowerCase();
    if (seen.has(normalized)) {
      throw new BadRequestException(`duplicate ward_code in hoarding_rate_matrix: ${code}`);
    }
    seen.add(normalized);
    if (!Number.isFinite(row.rate_paise_per_sqft_per_month) || row.rate_paise_per_sqft_per_month < 0) {
      throw new BadRequestException(`invalid rate for ward ${code}`);
    }
  }
}

export function resolveHoardingRateForWard(
  matrix: HoardingRateMatrix,
  wardCode: string,
): { ratePaisePerSqftPerMonth: number; wardMatched: boolean } {
  const normalized = wardCode.trim();
  const match = matrix.ward_rates?.find((row) => row.ward_code.trim().toLowerCase() === normalized.toLowerCase());
  if (match) {
    return { ratePaisePerSqftPerMonth: match.rate_paise_per_sqft_per_month, wardMatched: true };
  }
  const flat = matrix.flat_rate_paise_per_sqft_per_month ?? DEFAULT_FLAT_RATE_PAISE_PER_SQFT_PER_MONTH;
  return { ratePaisePerSqftPerMonth: flat, wardMatched: false };
}

export function computeHoardingTaxPaise(input: {
  matrix: HoardingRateMatrix;
  wardCode: string;
  widthFt: number;
  heightFt: number;
  durationMonths: number;
  minDurationMonths?: number;
  maxDurationMonths?: number;
}): HoardingQuoteResult {
  const minMonths = input.minDurationMonths ?? MIN_HOARDING_DURATION_MONTHS;
  const maxMonths = input.maxDurationMonths ?? MAX_HOARDING_DURATION_MONTHS;

  if (!Number.isFinite(input.widthFt) || input.widthFt <= 0) {
    throw new BadRequestException('width_ft must be greater than zero');
  }
  if (!Number.isFinite(input.heightFt) || input.heightFt <= 0) {
    throw new BadRequestException('height_ft must be greater than zero');
  }
  if (!Number.isInteger(input.durationMonths) || input.durationMonths < minMonths || input.durationMonths > maxMonths) {
    throw new BadRequestException(`duration_months must be between ${minMonths} and ${maxMonths}`);
  }

  const wardCode = input.wardCode.trim();
  if (!wardCode) {
    throw new BadRequestException('ward_code is required');
  }

  const sqft = roundSqft(input.widthFt * input.heightFt);
  const { ratePaisePerSqftPerMonth, wardMatched } = resolveHoardingRateForWard(input.matrix, wardCode);
  const taxRaw = sqft * input.durationMonths * ratePaisePerSqftPerMonth;
  if (!Number.isFinite(taxRaw) || taxRaw > MAX_TAX_PAISE) {
    throw new BadRequestException('computed tax exceeds maximum allowed amount');
  }

  return {
    tax_paise: Math.round(taxRaw),
    revenue_head_code: HOARDING_TAX_REVENUE_HEAD_CODE,
    ward_matched: wardMatched,
    ward_code: wardCode,
    sqft,
    duration_months: input.durationMonths,
    rate_paise_per_sqft_per_month: ratePaisePerSqftPerMonth,
  };
}

function roundSqft(value: number): number {
  return Math.round(value * 100) / 100;
}
