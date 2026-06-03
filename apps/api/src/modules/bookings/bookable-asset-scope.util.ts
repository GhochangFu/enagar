/**
 * Which bookable assets a tenant service may use (from `tenant_services.override_config`).
 * Supports a single code or a list for multi-hall services.
 */
export function bookableAssetCodesFromOverrideConfig(
  overrideConfig: Record<string, unknown> | null | undefined,
): string[] {
  if (!overrideConfig) {
    return [];
  }
  const codes: string[] = [];
  const single = overrideConfig.bookable_asset_code;
  if (typeof single === 'string' && single.trim()) {
    codes.push(single.trim());
  }
  const many = overrideConfig.bookable_asset_codes;
  if (Array.isArray(many)) {
    for (const item of many) {
      if (typeof item === 'string' && item.trim()) {
        const normalized = item.trim();
        if (!codes.includes(normalized)) {
          codes.push(normalized);
        }
      }
    }
  }
  return codes;
}

export function isAssetAllowedForService(allowedCodes: string[], assetCode: string): boolean {
  if (allowedCodes.length === 0) {
    return false;
  }
  const needle = assetCode.trim();
  return allowedCodes.some((code) => code.toLowerCase() === needle.toLowerCase());
}
