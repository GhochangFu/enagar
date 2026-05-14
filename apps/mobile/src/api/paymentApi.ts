import { citizenTenantFetch } from './citizenTenantHttp';

import type { PaymentApiResponse, PaymentGatewayMethod } from '../types/dossier';

function randomIdempotencyKey(): string {
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function fetchPaymentList(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
): Promise<PaymentApiResponse[]> {
  const response = await citizenTenantFetch(
    'GET',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    '/payments',
  );
  if (!response.ok) {
    throw new Error(`GET /payments failed (${response.status})`);
  }
  return (await response.json()) as PaymentApiResponse[];
}

export async function initiatePayment(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  dto: {
    application_id: string;
    amount_paise: number;
    method: PaymentGatewayMethod;
  },
): Promise<PaymentApiResponse> {
  const response = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    '/payments/initiate',
    { body: dto, idempotencyKey: randomIdempotencyKey() },
  );
  if (!response.ok) {
    throw new Error(`POST /payments/initiate failed (${response.status})`);
  }
  return (await response.json()) as PaymentApiResponse;
}

export async function completeStubPayment(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  dto: { payment_id: string; gateway_order_id: string },
): Promise<{ ok?: boolean }> {
  const response = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    '/payments/stub/complete',
    { body: dto },
  );
  if (!response.ok) {
    throw new Error(`POST /payments/stub/complete failed (${response.status})`);
  }
  return (await response.json()) as { ok?: boolean };
}
