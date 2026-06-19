/** Sprint 8.5E — health fleet booking service and asset types. */

export const HEALTH_FLEET_SERVICE_CODES = ['ambulance', 'hearse'] as const;

export type HealthFleetServiceCode = (typeof HEALTH_FLEET_SERVICE_CODES)[number];

export const HEALTH_FLEET_ASSET_TYPES = ['AMBULANCE', 'HEARSE'] as const;

export type HealthFleetAssetType = (typeof HEALTH_FLEET_ASSET_TYPES)[number];

const HEALTH_SERVICE_TO_ASSET_TYPE: Record<HealthFleetServiceCode, HealthFleetAssetType> = {
  ambulance: 'AMBULANCE',
  hearse: 'HEARSE',
};

export function isHealthFleetServiceCode(
  serviceCode: string | null | undefined,
): serviceCode is HealthFleetServiceCode {
  const code = serviceCode?.trim().toLowerCase();
  return (
    code === 'ambulance' ||
    code === 'hearse'
  );
}

export function isHealthFleetAssetType(
  assetType: string | null | undefined,
): assetType is HealthFleetAssetType {
  const type = assetType?.trim().toUpperCase();
  return type === 'AMBULANCE' || type === 'HEARSE';
}

export function healthFleetAssetTypeForService(
  serviceCode: string,
): HealthFleetAssetType | null {
  const code = serviceCode.trim().toLowerCase();
  if (code === 'ambulance' || code === 'hearse') {
    return HEALTH_SERVICE_TO_ASSET_TYPE[code];
  }
  return null;
}

export function readBplSubsidyPaise(rules: unknown): number {
  if (!rules || typeof rules !== 'object') {
    return 0;
  }
  const value = (rules as Record<string, unknown>).bpl_subsidy_paise;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}
