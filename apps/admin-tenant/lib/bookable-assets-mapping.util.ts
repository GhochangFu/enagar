import type { WorkflowDefinition } from '@enagar/workflow';

export type BookableAssetMappingRow = {
  code: string;
  asset_type?: string;
  is_active: boolean;
};

/** True when the workflow draft uses the hall booking pattern (template or equivalent stages). */
export function workflowDefinitionIsBooking(
  workflow: Pick<WorkflowDefinition, 'code' | 'stages' | 'transitions'> | null | undefined,
): boolean {
  if (!workflow) {
    return false;
  }
  const code = workflow.code?.trim() ?? '';
  if (code === 'booking-v1' || code.endsWith('-booking-v1')) {
    return true;
  }
  if (workflow.stages?.some((stage) => stage.code === 'slot-review')) {
    return true;
  }
  if (workflow.transitions?.some((transition) => transition.verb === 'review-slot')) {
    return true;
  }
  return false;
}

/** Service codes that link citizen bookings to Operations bookable assets (independent of workflow pattern). */
const BOOKABLE_ASSET_MAPPING_SERVICE_CODES = new Set([
  'ad-led',
  'community-hall',
  'other-facility-booking',
]);

/** Show asset mapping for booking-pattern services, hall workflows, or LED slot booking (ad-led). */
export function serviceShowsBookableAssetMapping(
  workflowPattern: string | null | undefined,
  workflow: Pick<WorkflowDefinition, 'code' | 'stages' | 'transitions'> | null | undefined,
  serviceCode?: string | null,
): boolean {
  if (serviceCode && BOOKABLE_ASSET_MAPPING_SERVICE_CODES.has(serviceCode)) {
    return true;
  }
  if (workflowPattern === 'booking') {
    return true;
  }
  return workflowDefinitionIsBooking(workflow);
}

export function filterBookableAssetsForService(
  serviceCode: string,
  assets: BookableAssetMappingRow[],
): BookableAssetMappingRow[] {
  const active = assets.filter((asset) => asset.is_active);
  if (serviceCode === 'ad-led') {
    return active.filter((asset) => asset.asset_type === 'LED_BOARD');
  }
  if (serviceCode === 'ambulance') {
    return active.filter((asset) => asset.asset_type === 'AMBULANCE');
  }
  if (serviceCode === 'hearse') {
    return active.filter((asset) => asset.asset_type === 'HEARSE');
  }
  if (serviceCode === 'community-hall' || serviceCode === 'other-facility-booking') {
    return active.filter(
      (asset) => asset.asset_type !== 'LED_BOARD' && asset.asset_type !== 'PARKING_ZONE',
    );
  }
  return active;
}

/** Keep only codes that exist in Operations → Bookings (ignore catalogue/seed placeholders). */
export function resolveBookableAssetCodesForMapping(
  requested: string[],
  assets: Array<{ code: string }>,
): string[] {
  const known = new Set(assets.map((asset) => asset.code));
  return [
    ...new Set(requested.map((code) => code.trim()).filter((code) => code && known.has(code))),
  ];
}

export function bookableAssetCodesMissingFromDb(
  requested: string[],
  assets: Array<{ code: string }>,
): string[] {
  const known = new Set(assets.map((asset) => asset.code));
  return [
    ...new Set(requested.map((code) => code.trim()).filter((code) => code && !known.has(code))),
  ];
}
