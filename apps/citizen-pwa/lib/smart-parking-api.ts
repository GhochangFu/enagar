import { authHeaders, readApiError } from './workspace-http';

import type { TokenResponse } from './workspace-types';

type PaymentMethod = 'upi' | 'card' | 'netbanking';

export type SmartParkingZone = {
  code: string;
  name: Record<string, string> | string;
  free_count: number;
  total_count: number;
  is_active: boolean;
};

export type SmartParkingBay = {
  code: string;
  status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE';
};

export type SmartParkingQuote = {
  zone_code: string;
  bay_code: string;
  starts_at: string;
  ends_at: string;
  vehicle_type: string | null;
  rent_paise: number;
  revenue_head_code: string;
  accounting_code: string;
  bay_available: true;
};

export type SmartParkingHold = {
  hold_id: string;
  zone_code: string;
  bay_code: string;
  status: 'hold';
  starts_at: string;
  ends_at: string;
  hold_expires_at: string;
  rent_paise: number;
  payment: {
    id: string;
    gateway_order_id: string;
    status: string;
    amount_paise: number;
  } | null;
};

export function smartParkingIdempotencyKey(holdId: string): string {
  return `smart-parking-hold-${holdId}-${Date.now()}`;
}

function apiBase(base: string): string {
  return base.replace(/\/$/, '');
}

export async function fetchSmartParkingZones(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
): Promise<SmartParkingZone[]> {
  const url = new URL(`${apiBase(apiBaseUrl)}/citizen/smart-parking/zones`);
  url.searchParams.set('tenant_code', tenantCode);
  const response = await fetch(url.toString(), {
    headers: authHeaders(token, false, tenantCode),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const body = (await response.json()) as { zones: SmartParkingZone[] };
  return body.zones;
}

export async function fetchSmartParkingBays(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  zoneCode: string,
): Promise<SmartParkingBay[]> {
  const url = new URL(
    `${apiBase(apiBaseUrl)}/citizen/smart-parking/zones/${encodeURIComponent(zoneCode)}/bays`,
  );
  url.searchParams.set('tenant_code', tenantCode);
  const response = await fetch(url.toString(), {
    headers: authHeaders(token, false, tenantCode),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const body = (await response.json()) as { bays: SmartParkingBay[] };
  return body.bays;
}

export async function quoteSmartParking(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  payload: {
    zone_code: string;
    bay_code: string;
    starts_at: string;
    ends_at: string;
    vehicle_number: string;
    vehicle_type?: string;
  },
): Promise<SmartParkingQuote> {
  const response = await fetch(`${apiBase(apiBaseUrl)}/citizen/smart-parking/quote`, {
    method: 'POST',
    headers: authHeaders(token, true, tenantCode),
    body: JSON.stringify({ tenant_code: tenantCode, ...payload }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as SmartParkingQuote;
}

export async function createSmartParkingHold(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  payload: {
    zone_code: string;
    bay_code: string;
    starts_at: string;
    ends_at: string;
    vehicle_number: string;
    vehicle_type?: string;
  },
): Promise<SmartParkingHold> {
  const response = await fetch(`${apiBase(apiBaseUrl)}/citizen/smart-parking/holds`, {
    method: 'POST',
    headers: authHeaders(token, true, tenantCode),
    body: JSON.stringify({ tenant_code: tenantCode, ...payload }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as SmartParkingHold;
}

export async function initiateSmartParkingPayment(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  holdId: string,
  method: PaymentMethod,
  idempotencyKey: string,
): Promise<SmartParkingHold> {
  const response = await fetch(
    `${apiBase(apiBaseUrl)}/citizen/smart-parking/holds/${encodeURIComponent(holdId)}/initiate-payment`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(token, true, tenantCode),
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({ method }),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as SmartParkingHold;
}

export async function confirmSmartParkingHold(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  holdId: string,
  paymentId?: string,
): Promise<{ booking_no: string }> {
  const response = await fetch(
    `${apiBase(apiBaseUrl)}/citizen/smart-parking/holds/${encodeURIComponent(holdId)}/confirm`,
    {
      method: 'POST',
      headers: authHeaders(token, true, tenantCode),
      body: JSON.stringify(paymentId ? { payment_id: paymentId } : {}),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as { booking_no: string };
}
