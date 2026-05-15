import type { ServiceSummary } from '../types/dossier';

export async function fetchTenantServices(
  apiRoot: string,
  tenantCode: string,
): Promise<ServiceSummary[]> {
  const base = apiRoot.replace(/\/$/, '');
  const response = await fetch(`${base}/services/tenants/${encodeURIComponent(tenantCode)}`, {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`GET /services/tenants/${tenantCode} failed (${response.status})`);
  }
  const rows = (await response.json()) as ServiceSummary[];
  return rows.filter((s) => s.active);
}

export async function fetchTenantService(
  apiRoot: string,
  tenantCode: string,
  serviceCode: string,
): Promise<ServiceSummary> {
  const base = apiRoot.replace(/\/$/, '');
  const response = await fetch(
    `${base}/services/tenants/${encodeURIComponent(tenantCode)}/${encodeURIComponent(serviceCode)}`,
    { method: 'GET' },
  );
  if (!response.ok) {
    throw new Error(
      `GET /services/tenants/${tenantCode}/${serviceCode} failed (${response.status})`,
    );
  }
  return (await response.json()) as ServiceSummary;
}
