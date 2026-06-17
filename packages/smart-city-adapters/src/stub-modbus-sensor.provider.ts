import type {
  ISensorProvider,
  ParkingBaySensorStatus,
  ZoneOccupancyResult,
} from './sensor-provider.js';

export type StubSensorScenario = 'kmc-pilot' | 'all-free' | 'all-occupied';

type ScenarioZoneConfig = {
  totalBays: number;
  occupiedBays: string[];
  reservedBays?: string[];
  outOfServiceBays?: string[];
};

const SCENARIO_ZONES: Record<StubSensorScenario, Record<string, ScenarioZoneConfig>> = {
  'kmc-pilot': {
    'ZONE-A': {
      totalBays: 20,
      occupiedBays: ['B01', 'B02'],
    },
  },
  'all-free': {},
  'all-occupied': {
    'ZONE-A': {
      totalBays: 20,
      occupiedBays: Array.from({ length: 20 }, (_, index) => bayCode(index + 1)),
    },
  },
};

function bayCode(index: number): string {
  return `B${String(index).padStart(2, '0')}`;
}

function resolveScenario(value: string | undefined): StubSensorScenario {
  if (value === 'all-free' || value === 'all-occupied' || value === 'kmc-pilot') {
    return value;
  }
  return 'kmc-pilot';
}

/**
 * Deterministic Modbus-style occupancy stub for Sprint 8.2A demos.
 * Toggle scenarios via `SMART_PARKING_STUB_SCENARIO` (`kmc-pilot` | `all-free` | `all-occupied`).
 */
export class StubModbusSensorProvider implements ISensorProvider {
  private readonly scenario: StubSensorScenario;

  constructor(scenario?: string) {
    this.scenario = resolveScenario(scenario ?? process.env.SMART_PARKING_STUB_SCENARIO);
  }

  async getZoneOccupancy(tenantId: string, zoneCode: string): Promise<ZoneOccupancyResult> {
    void tenantId;
    const zoneConfig = SCENARIO_ZONES[this.scenario][zoneCode];
    const polledAt = new Date().toISOString();

    if (!zoneConfig) {
      return { bays: [], polledAt, scenario: this.scenario };
    }

    const occupied = new Set(zoneConfig.occupiedBays);
    const reserved = new Set(zoneConfig.reservedBays ?? []);
    const outOfService = new Set(zoneConfig.outOfServiceBays ?? []);

    const bays = Array.from({ length: zoneConfig.totalBays }, (_, index) => {
      const code = bayCode(index + 1);
      let status: ParkingBaySensorStatus = 'FREE';
      if (outOfService.has(code)) {
        status = 'OUT_OF_SERVICE';
      } else if (reserved.has(code)) {
        status = 'RESERVED';
      } else if (occupied.has(code)) {
        status = 'OCCUPIED';
      }
      return { code, status };
    });

    return { bays, polledAt, scenario: this.scenario };
  }
}
