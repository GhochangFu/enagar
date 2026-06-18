import { completeBookingStubPayment } from './bookings-api';
import { authHeaders, readApiError } from './workspace-http';

import type { TokenResponse } from './workspace-types';

type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export type WaterMeterLookup = {
  meter_id: string;
  consumer_name: string;
  balance_paise: number;
  last_reading_litres: number | null;
  last_reading_at: string | null;
};

export type WaterMeterRechargePayment = {
  id: string;
  gateway_order_id: string;
  status: string;
  amount_paise: number;
};

export type WaterMeterRecharge = {
  recharge_id: string;
  meter_id: string;
  amount_paise: number;
  status: string;
  balance_after_paise: number | null;
  payment: WaterMeterRechargePayment | null;
};

function apiBase(base: string): string {
  return base.replace(/\/$/, '');
}

export function waterRechargeIdempotencyKey(meterId: string, amountPaise: number): string {
  return `water-recharge-${meterId}-${amountPaise}-${Date.now()}`;
}

export async function lookupWaterMeter(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  meterId: string,
): Promise<WaterMeterLookup> {
  const url = new URL(
    `${apiBase(apiBaseUrl)}/citizen/iot-water/water-meters/${encodeURIComponent(meterId)}`,
  );
  url.searchParams.set('tenant_code', tenantCode);
  const response = await fetch(url.toString(), {
    headers: authHeaders(token, false, tenantCode),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as WaterMeterLookup;
}

export async function initiateWaterMeterRecharge(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  meterId: string,
  amountPaise: number,
  method: PaymentMethod,
  idempotencyKey: string,
): Promise<WaterMeterRecharge> {
  const response = await fetch(
    `${apiBase(apiBaseUrl)}/citizen/iot-water/water-meters/${encodeURIComponent(meterId)}/recharge`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(token, true, tenantCode),
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({ tenant_code: tenantCode, amount_paise: amountPaise, method }),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as WaterMeterRecharge;
}

export async function completeWaterMeterStubRecharge(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantCode: string,
  payment: WaterMeterRechargePayment,
): Promise<void> {
  await completeBookingStubPayment(
    apiBaseUrl,
    token,
    tenantCode,
    payment.id,
    payment.gateway_order_id,
  );
}
