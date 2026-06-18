import type { IWaterMeterProvider, WaterMeterLookupResult } from './water-meter-provider.js';

/**
 * Sprint 8.2E deterministic water meter stub.
 * The API keeps DB balances authoritative; this class is used by tests and future adapter swaps.
 */
export class StubWaterMeterProvider implements IWaterMeterProvider {
  private readonly meters = new Map<string, WaterMeterLookupResult>();

  constructor(initialMeters: WaterMeterLookupResult[] = []) {
    for (const meter of initialMeters) {
      this.meters.set(meter.meterId, { ...meter });
    }
  }

  async lookup(meterId: string): Promise<WaterMeterLookupResult | null> {
    const meter = this.meters.get(meterId.trim());
    return meter ? { ...meter } : null;
  }

  async applyRecharge(meterId: string, amountPaise: number): Promise<WaterMeterLookupResult> {
    const normalized = meterId.trim();
    const current =
      this.meters.get(normalized) ??
      ({
        meterId: normalized,
        balancePaise: 0,
        lastReadingLitres: null,
        lastReadingAt: null,
      } satisfies WaterMeterLookupResult);
    const next = {
      ...current,
      balancePaise: current.balancePaise + amountPaise,
    };
    this.meters.set(normalized, next);
    return { ...next };
  }
}
