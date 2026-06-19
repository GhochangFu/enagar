import { authHeaders, readApiError } from './workspace-http';

import type { TokenResponse } from './workspace-types';

export type HoardingWardOption = {
  number: string;
  name: string | null;
};

export type HoardingCalculatorSnapshot = {
  tax_paise: number;
  revenue_head_code: string;
  ward_matched: boolean;
  ward_code: string;
  sqft: number;
  duration_months: number;
  rate_paise_per_sqft_per_month: number;
  quoted_at: string;
};

export const HOARDING_CALCULATOR_SNAPSHOT_FIELD = 'hoarding_calculator_snapshot';

export async function fetchHoardingContext(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
): Promise<{ wards: HoardingWardOption[] }> {
  const url = new URL(`${apiBaseUrl}/citizen/advertising/hoarding/context`);
  url.searchParams.set('tenant_code', tenantCode);
  const response = await fetch(url.toString(), {
    headers: authHeaders(token, false, tenantCode),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as { wards: HoardingWardOption[] };
}

export async function quoteHoardingTax(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  input: {
    ward_code: string;
    width_ft: number;
    height_ft: number;
    duration_months: number;
  },
): Promise<HoardingCalculatorSnapshot> {
  const response = await fetch(`${apiBaseUrl}/citizen/advertising/hoarding/quote`, {
    method: 'POST',
    headers: authHeaders(token, true, tenantCode),
    body: JSON.stringify({
      tenant_code: tenantCode,
      ...input,
    }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as HoardingCalculatorSnapshot;
}

export function buildApplyFormPrefill(input: {
  snapshot: HoardingCalculatorSnapshot;
  widthFt: number;
  heightFt: number;
}): Record<string, string> {
  return {
    hoarding_dimensions: `${input.widthFt}ft x ${input.heightFt}ft`,
    [HOARDING_CALCULATOR_SNAPSHOT_FIELD]: JSON.stringify(input.snapshot),
  };
}
