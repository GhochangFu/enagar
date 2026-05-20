import type { GrievanceCatalogueResponse } from './types.js';

function normalizeApiRoot(apiRoot: string): string {
  return apiRoot.replace(/\/$/, '');
}

async function readCatalogueResponse(response: Response): Promise<GrievanceCatalogueResponse> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Grievance catalogue failed (${response.status})${text ? `: ${text.slice(0, 120)}` : ''}`,
    );
  }
  return (await response.json()) as GrievanceCatalogueResponse;
}

/** Anonymous read for citizen filing before login (tenant_code query). */
export async function fetchPublicGrievanceCatalogue(
  apiRoot: string,
  tenantCode: string,
): Promise<GrievanceCatalogueResponse> {
  const base = normalizeApiRoot(apiRoot);
  const url = `${base}/public/grievances/catalogue?tenant_code=${encodeURIComponent(tenantCode)}`;
  return readCatalogueResponse(await fetch(url));
}

/** Authenticated catalogue (same payload; requires JWT + optional X-Enagar-Tenant-Code). */
export async function fetchScopedGrievanceCatalogue(
  apiRoot: string,
  accessToken: string,
  tenantCode?: string | null,
): Promise<GrievanceCatalogueResponse> {
  const base = normalizeApiRoot(apiRoot);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  const trimmed = tenantCode?.trim();
  if (trimmed) {
    headers['x-enagar-tenant-code'] = trimmed;
  }
  return readCatalogueResponse(await fetch(`${base}/grievances/catalogue`, { headers }));
}
