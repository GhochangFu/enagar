export type TenantBannerSeverity = 'info' | 'warning' | 'critical';

export type TenantBanner = {
  code: string;
  severity: TenantBannerSeverity | string;
  title: Record<string, string>;
  body: Record<string, string>;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

export async function fetchTenantBanners(
  apiBaseUrl: string,
  tenantCode: string,
): Promise<TenantBanner[]> {
  const response = await fetch(`${apiBaseUrl}/tenants/${encodeURIComponent(tenantCode)}/banners`);
  if (!response.ok) {
    return [];
  }
  return (await response.json()) as TenantBanner[];
}

export function pickBannerText(value: Record<string, string> | undefined, locale: string): string {
  return value?.[locale] ?? value?.en ?? '';
}
