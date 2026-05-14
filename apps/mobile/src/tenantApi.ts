/** Public tenant-picker row shape (aligned with citizen PWA tenant list). */

export type MobileLocale = 'en' | 'bn' | 'hi';

export type TenantListItem = {
  id: string;
  code: string;
  name: string;
  district: string;
  ward_count: number;
  theme_color: string;
  logo_url: string | null;
  languages_enabled: MobileLocale[];
};

export async function fetchPublicTenants(apiRoot: string): Promise<TenantListItem[]> {
  const base = apiRoot.replace(/\/$/, '');
  const response = await fetch(`${base}/tenants`);

  if (!response.ok) {
    throw new Error(`GET /tenants failed (${response.status})`);
  }

  const body: unknown = await response.json();
  const list = Array.isArray(body) ? body : [];

  return list.filter(isTenantRow);
}

function isTenantRow(row: unknown): row is TenantListItem {
  if (!row || typeof row !== 'object') {
    return false;
  }
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.code === 'string' &&
    typeof r.name === 'string' &&
    typeof r.district === 'string' &&
    typeof r.ward_count === 'number' &&
    typeof r.theme_color === 'string' &&
    (r.logo_url === null || typeof r.logo_url === 'string') &&
    Array.isArray(r.languages_enabled)
  );
}
