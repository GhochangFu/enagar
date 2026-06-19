import type { GeneratedBookableSlot } from './bookings-slot.util';

export type FleetPoolSlot = GeneratedBookableSlot & {
  available_units: number;
};

export type FleetAssetSlotGrid = {
  asset_code: string;
  slots: GeneratedBookableSlot[];
};

/**
 * Merge per-asset slot grids into pooled slots keyed by start/end ISO timestamps.
 * A pooled slot is free when at least one linked unit is free for that window.
 */
export function mergeFleetPoolSlots(assetGrids: FleetAssetSlotGrid[]): FleetPoolSlot[] {
  const byKey = new Map<string, { starts_at: string; ends_at: string; freeUnits: number }>();

  for (const grid of assetGrids) {
    for (const slot of grid.slots) {
      const key = `${slot.starts_at}|${slot.ends_at}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
          freeUnits: slot.status === 'free' ? 1 : 0,
        });
        continue;
      }
      if (slot.status === 'free') {
        existing.freeUnits += 1;
      }
    }
  }

  return [...byKey.values()]
    .sort((left, right) => left.starts_at.localeCompare(right.starts_at))
    .map((row) => ({
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      available_units: row.freeUnits,
      status: row.freeUnits > 0 ? ('free' as const) : ('taken' as const),
    }));
}

export function pickFirstFreeAssetCode(
  assetGrids: FleetAssetSlotGrid[],
  startsAtIso: string,
  endsAtIso: string,
): string | null {
  for (const grid of assetGrids) {
    const match = grid.slots.find(
      (slot) =>
        slot.starts_at === startsAtIso &&
        slot.ends_at === endsAtIso &&
        slot.status === 'free',
    );
    if (match) {
      return grid.asset_code;
    }
  }
  return null;
}
