import { authHeaders, readApiError } from './workspace-http';

import type { TokenResponse } from './workspace-types';

type PaymentMethod = 'upi' | 'card' | 'netbanking';

export type EvCharger = {
  code: string;
  name: Record<string, string> | string;
  location: Record<string, unknown> | string;
  connector_type: string;
  max_kw: string;
  rate_paise_per_kwh: number;
  is_active: boolean;
  available: boolean;
};

export type EvSessionPayment = {
  id: string;
  gateway_order_id: string;
  status: string;
  amount_paise: number;
};

export type EvSession = {
  session_id: string;
  charger_code: string;
  vehicle_number?: string | null;
  status: string;
  hold_expires_at?: string;
  started_at?: string | null;
  ended_at?: string | null;
  kwh_consumed?: number | null;
  amount_paise?: number | null;
  rate_paise_per_kwh?: number;
  payment?: EvSessionPayment | null;
};

export function evChargingIdempotencyKey(sessionId: string): string {
  return `ev-charging-${sessionId}-${Date.now()}`;
}

function apiBase(base: string): string {
  return base.replace(/\/$/, '');
}

export async function fetchEvChargers(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
): Promise<EvCharger[]> {
  const url = new URL(`${apiBase(apiBaseUrl)}/citizen/ev-charging/chargers`);
  url.searchParams.set('tenant_code', tenantCode);
  const response = await fetch(url.toString(), {
    headers: authHeaders(token, false, tenantCode),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const body = (await response.json()) as { chargers: EvCharger[] };
  return body.chargers;
}

export async function createEvChargingHold(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  chargerCode: string,
  vehicleNumber: string,
): Promise<EvSession> {
  const response = await fetch(
    `${apiBase(apiBaseUrl)}/citizen/ev-charging/chargers/${encodeURIComponent(chargerCode)}/holds`,
    {
      method: 'POST',
      headers: authHeaders(token, true, tenantCode),
      body: JSON.stringify({
        tenant_code: tenantCode,
        vehicle_number: vehicleNumber.trim().toUpperCase(),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as EvSession;
}

export async function startEvChargingSession(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  sessionId: string,
): Promise<EvSession> {
  const response = await fetch(
    `${apiBase(apiBaseUrl)}/citizen/ev-charging/sessions/${encodeURIComponent(sessionId)}/start`,
    {
      method: 'POST',
      headers: authHeaders(token, true, tenantCode),
      body: JSON.stringify({ tenant_code: tenantCode }),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as EvSession;
}

export async function stopEvChargingSession(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  sessionId: string,
): Promise<EvSession> {
  const response = await fetch(
    `${apiBase(apiBaseUrl)}/citizen/ev-charging/sessions/${encodeURIComponent(sessionId)}/stop`,
    {
      method: 'POST',
      headers: authHeaders(token, true, tenantCode),
      body: JSON.stringify({ tenant_code: tenantCode }),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as EvSession;
}

export async function initiateEvChargingPayment(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  sessionId: string,
  method: PaymentMethod,
  idempotencyKey: string,
): Promise<EvSession> {
  const response = await fetch(
    `${apiBase(apiBaseUrl)}/citizen/ev-charging/sessions/${encodeURIComponent(sessionId)}/initiate-payment`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(token, true, tenantCode),
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({ tenant_code: tenantCode, method }),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as EvSession;
}

export async function confirmEvChargingPayment(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  sessionId: string,
  paymentId: string,
): Promise<EvSession> {
  const response = await fetch(
    `${apiBase(apiBaseUrl)}/citizen/ev-charging/sessions/${encodeURIComponent(sessionId)}/pay`,
    {
      method: 'POST',
      headers: authHeaders(token, true, tenantCode),
      body: JSON.stringify({ tenant_code: tenantCode, payment_id: paymentId }),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as EvSession;
}
