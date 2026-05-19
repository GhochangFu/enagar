import { citizenTenantFetch } from './citizenTenantHttp';

import type { CitizenHubDashboardResponse, CitizenPreferencesResponse } from '../types/citizenHub';

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown; error?: string };
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
    if (Array.isArray(body.message)) {
      return body.message.map((part) => String(part)).join('; ');
    }
    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error;
    }
  } catch {
    /* body may not be JSON */
  }
  return `Request failed (${response.status})`;
}

/** Hub aggregate — omit `x-enagar-tenant-code`. */
export async function fetchCitizenDashboard(
  apiRoot: string,
  accessToken: string,
): Promise<CitizenHubDashboardResponse> {
  const response = await citizenTenantFetch(
    'GET',
    apiRoot,
    accessToken,
    undefined,
    '/citizen/dashboard',
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as CitizenHubDashboardResponse;
}

export async function fetchCitizenPreferences(
  apiRoot: string,
  accessToken: string,
): Promise<CitizenPreferencesResponse> {
  const response = await citizenTenantFetch(
    'GET',
    apiRoot,
    accessToken,
    undefined,
    '/citizen/preferences',
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as CitizenPreferencesResponse;
}

export async function patchCitizenPreferences(
  apiRoot: string,
  accessToken: string,
  patch: Partial<CitizenPreferencesResponse>,
): Promise<CitizenPreferencesResponse> {
  const response = await citizenTenantFetch(
    'PATCH',
    apiRoot,
    accessToken,
    undefined,
    '/citizen/preferences',
    { body: patch },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as CitizenPreferencesResponse;
}

/** Persists last workspace ULB (separate from pin list). */
export async function selectCitizenTenant(
  apiRoot: string,
  accessToken: string,
  tenantCode: string,
): Promise<void> {
  const response = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    undefined,
    '/citizen/select-tenant',
    { body: { tenant_code: tenantCode } },
  );
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export function sumHubBucketTotals(dashboard: CitizenHubDashboardResponse | null): {
  applications: number;
  payments: number;
  grievances: number;
} {
  const buckets = dashboard?.municipalities ?? [];
  return buckets.reduce(
    (acc, row) => ({
      applications: acc.applications + row.application_count,
      payments: acc.payments + row.payment_count,
      grievances: acc.grievances + row.grievance_count,
    }),
    { applications: 0, payments: 0, grievances: 0 },
  );
}
