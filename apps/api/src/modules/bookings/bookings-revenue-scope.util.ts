import {
  bookableAssetCodesFromOverrideConfig,
  isAssetAllowedForService,
} from './bookable-asset-scope.util';

export type TenantServiceRevenueScopeRow = {
  overrideConfig: Record<string, unknown> | null | undefined;
  revenueHeadCode: string | null;
};

/** Resolve revenue head for a bookable asset from tenant service override mappings. */
export function resolveRevenueHeadCodeForAsset(
  services: TenantServiceRevenueScopeRow[],
  assetCode: string,
  fallbackCode: string,
): string | null {
  for (const service of services) {
    const codes = bookableAssetCodesFromOverrideConfig(service.overrideConfig);
    if (isAssetAllowedForService(codes, assetCode)) {
      return service.revenueHeadCode ?? null;
    }
  }
  return fallbackCode;
}
