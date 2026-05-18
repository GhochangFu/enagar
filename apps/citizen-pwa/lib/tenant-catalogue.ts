/** Shared tenant picker helpers for hub Apply / pinned cards. */

export interface TenantCatalogueRow {
  id: string;
  code: string;
  name: string;
  district: string;
  ward_count: number;
  theme_color: string;
  logo_url: string | null;
  languages_enabled: Array<'en' | 'bn' | 'hi'>;
}

export function resolveTenantFromCatalogue(
  tenantCode: string,
  tenantId: string,
  tenants: TenantCatalogueRow[],
): TenantCatalogueRow | undefined {
  if (!tenants.length) {
    return undefined;
  }
  const normalized = tenantCode.trim().toUpperCase();
  const byCode = new Map(tenants.map((tenant) => [tenant.code.trim().toUpperCase(), tenant]));
  return byCode.get(normalized) ?? tenants.find((tenant) => tenant.id === tenantId);
}
