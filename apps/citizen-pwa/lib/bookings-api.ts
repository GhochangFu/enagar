import { authHeaders, readApiError } from './workspace-http';

import type { BookableSlot } from './booking-slot-grid';
import type { TokenResponse } from './workspace-types';

export type PublicBookableAsset = {
  code: string;
  name: Record<string, string> | string;
  location: Record<string, unknown> | null;
  rate_unit: string;
  asset_type: string;
  base_rate_paise: number;
  security_deposit_paise: number;
  slot_step_minutes: number;
  rules?: Record<string, unknown> | null;
};

export type BookingQuote = {
  asset_code: string;
  starts_at: string;
  ends_at: string;
  rate_unit: string;
  rent_paise: number;
  deposit_paise: number;
  total_paise: number;
  revenue_head_code: string | null;
};

export type BookingHold = {
  id: string;
  asset_code: string;
  status: string;
  starts_at: string;
  ends_at: string;
  rent_paise: number;
  deposit_paise: number;
  hold_expires_at: string;
};

export type BookingReservation = {
  id: string;
  booking_no: string | null;
  asset_code: string;
  status: string;
  starts_at: string;
  ends_at: string;
  deposit_id: string | null;
};

export type BookingHoldPayment = {
  hold_id: string;
  deposit_id: string;
  payment: {
    id: string;
    gateway_order_id: string;
    status: string;
    amount_paise: number;
  };
  amount_paise: number;
  deposit_paise: number;
  rent_paise: number;
};

function apiBase(base: string): string {
  return base.replace(/\/$/, '');
}

export function bookingNoToPdfPathRef(bookingNo: string): string {
  return bookingNo.replace(/\//g, '--');
}

export function bookingConfirmationPdfPath(apiBaseUrl: string, ref: string): string {
  return `${apiBase(apiBaseUrl)}/citizen/bookings/${encodeURIComponent(ref)}/confirmation.pdf`;
}

export async function fetchPublicBookableAssets(
  apiBaseUrl: string,
  tenantCode: string,
  serviceCode?: string,
): Promise<PublicBookableAsset[]> {
  const url = new URL(`${apiBase(apiBaseUrl)}/public/bookings/assets`);
  url.searchParams.set('tenant_code', tenantCode);
  if (serviceCode?.trim()) {
    url.searchParams.set('service_code', serviceCode.trim());
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as PublicBookableAsset[];
}

export async function fetchAssetSlots(
  apiBaseUrl: string,
  tenantCode: string,
  assetCode: string,
  from: string,
  to: string,
  serviceCode?: string,
): Promise<BookableSlot[]> {
  const url = new URL(
    `${apiBase(apiBaseUrl)}/public/bookings/assets/${encodeURIComponent(assetCode)}/slots`,
  );
  url.searchParams.set('tenant_code', tenantCode);
  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  if (serviceCode?.trim()) {
    url.searchParams.set('service_code', serviceCode.trim());
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const body = (await response.json()) as { slots: BookableSlot[] };
  return body.slots;
}

export async function quoteBooking(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantScopeCode: string,
  payload: {
    tenant_code: string;
    service_code?: string;
    asset_code: string;
    starts_at: string;
    ends_at: string;
  },
): Promise<BookingQuote> {
  const response = await fetch(`${apiBase(apiBaseUrl)}/citizen/bookings/quote`, {
    method: 'POST',
    headers: authHeaders(token, true, tenantScopeCode),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as BookingQuote;
}

export async function createBookingHold(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantScopeCode: string,
  payload: {
    tenant_code: string;
    service_code?: string;
    asset_code: string;
    starts_at: string;
    ends_at: string;
  },
): Promise<BookingHold> {
  const response = await fetch(`${apiBase(apiBaseUrl)}/citizen/bookings/holds`, {
    method: 'POST',
    headers: authHeaders(token, true, tenantScopeCode),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as BookingHold;
}

export async function initiateBookingHoldPayment(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantScopeCode: string,
  holdId: string,
  method: 'upi' | 'card' | 'netbanking',
  idempotencyKey: string,
  includeRent = false,
): Promise<BookingHoldPayment> {
  const response = await fetch(
    `${apiBase(apiBaseUrl)}/citizen/bookings/holds/${encodeURIComponent(holdId)}/initiate-payment`,
    {
      method: 'POST',
      headers: {
        ...authHeaders(token, true, tenantScopeCode),
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({ method, include_rent: includeRent }),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as BookingHoldPayment;
}

export async function completeBookingStubPayment(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantScopeCode: string,
  paymentId: string,
  gatewayOrderId: string,
): Promise<void> {
  const response = await fetch(`${apiBase(apiBaseUrl)}/payments/stub/complete`, {
    method: 'POST',
    headers: authHeaders(token, true, tenantScopeCode),
    body: JSON.stringify({ payment_id: paymentId, gateway_order_id: gatewayOrderId }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export async function createApplicationDraft(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantScopeCode: string,
  payload: { service_code: string; form_data: Record<string, unknown> },
): Promise<{ id: string; docket_no: string }> {
  const response = await fetch(`${apiBase(apiBaseUrl)}/applications/drafts`, {
    method: 'POST',
    headers: authHeaders(token, true, tenantScopeCode),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as { id: string; docket_no: string };
}

export async function initiateApplicationPayment(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantScopeCode: string,
  applicationId: string,
  amountPaise: number,
  idempotencyKey: string,
): Promise<{ id: string; gateway_order_id: string }> {
  const response = await fetch(`${apiBase(apiBaseUrl)}/payments/initiate`, {
    method: 'POST',
    headers: {
      ...authHeaders(token, true, tenantScopeCode),
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      application_id: applicationId,
      amount_paise: amountPaise,
      method: 'upi',
      fee_code: 'application',
    }),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const payment = (await response.json()) as { id: string; gateway_order_id: string };
  return payment;
}

export async function linkBookingHoldApplication(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantScopeCode: string,
  holdId: string,
  applicationId: string,
): Promise<BookingReservation> {
  const response = await fetch(
    `${apiBase(apiBaseUrl)}/citizen/bookings/holds/${encodeURIComponent(holdId)}/link-application`,
    {
      method: 'POST',
      headers: authHeaders(token, true, tenantScopeCode),
      body: JSON.stringify({ application_id: applicationId }),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as BookingReservation;
}

export async function submitApplicationDraft(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantScopeCode: string,
  applicationId: string,
): Promise<{ docket_no: string; current_stage: string }> {
  const response = await fetch(
    `${apiBase(apiBaseUrl)}/applications/${encodeURIComponent(applicationId)}/submit`,
    {
      method: 'POST',
      headers: authHeaders(token, true, tenantScopeCode),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  const body = (await response.json()) as { docket_no: string; current_stage: string };
  return body;
}

export async function confirmBookingHold(
  apiBaseUrl: string,
  token: TokenResponse,
  tenantScopeCode: string,
  holdId: string,
  options?: { depositId?: string; applicationId?: string },
): Promise<BookingReservation> {
  const body: Record<string, string> = {};
  if (options?.depositId) {
    body.deposit_id = options.depositId;
  }
  if (options?.applicationId) {
    body.application_id = options.applicationId;
  }
  const response = await fetch(
    `${apiBase(apiBaseUrl)}/citizen/bookings/holds/${encodeURIComponent(holdId)}/confirm`,
    {
      method: 'POST',
      headers: authHeaders(token, true, tenantScopeCode),
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as BookingReservation;
}

export async function downloadBookingConfirmationPdf(
  apiBaseUrl: string,
  token: TokenResponse,
  ref: string,
  tenantScopeCode: string,
): Promise<Blob> {
  const response = await fetch(bookingConfirmationPdfPath(apiBaseUrl, ref), {
    headers: authHeaders(token, false, tenantScopeCode),
  });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return response.blob();
}

export function assetDisplayName(
  name: PublicBookableAsset['name'],
  locale: 'en' | 'bn' | 'hi',
): string {
  if (typeof name === 'string') {
    return name;
  }
  return name[locale] ?? name.en ?? Object.values(name)[0] ?? 'Hall';
}
