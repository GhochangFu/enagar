/** Shared header for portal JWT scoped to a municipal tenant (same as PWA `authHeaders(..., scope)`). */
export const CITIZEN_MUNICIPALITY_SCOPE_HEADER = 'x-enagar-tenant-code';

export function citizenTenantHeaders(
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  json = false,
  idempotencyKey?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  const scope = municipalityTenantCode?.trim();
  if (scope) {
    headers[CITIZEN_MUNICIPALITY_SCOPE_HEADER] = scope;
  }
  if (idempotencyKey?.trim()) {
    headers['idempotency-key'] = idempotencyKey.trim();
  }
  return headers;
}

/** Authenticated fetch with optional ULB scope + JSON body. */
export async function citizenTenantFetch(
  method: string,
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  path: string,
  options: { body?: unknown; idempotencyKey?: string } = {},
): Promise<Response> {
  const base = apiRoot.replace(/\/$/, '');
  const headers = citizenTenantHeaders(
    accessToken,
    municipalityTenantCode,
    options.body !== undefined,
    options.idempotencyKey,
  );
  return fetch(`${base}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}
