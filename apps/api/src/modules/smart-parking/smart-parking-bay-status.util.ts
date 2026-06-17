export type ParkingBayStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE';

const STATUS_RESTRICTION_RANK: Record<ParkingBayStatus, number> = {
  FREE: 0,
  RESERVED: 1,
  OCCUPIED: 2,
  OUT_OF_SERVICE: 3,
};

export function normalizeParkingBayStatus(value: string): ParkingBayStatus {
  if (value === 'RESERVED' || value === 'OCCUPIED' || value === 'OUT_OF_SERVICE') {
    return value;
  }
  return 'FREE';
}

/** Prefer the more restrictive of DB workflow state and live sensor reading. */
export function mergeParkingBayStatus(
  dbStatus: string,
  sensorStatus: string | undefined,
): ParkingBayStatus {
  const db = normalizeParkingBayStatus(dbStatus);
  if (!sensorStatus) {
    return db;
  }
  const sensor = normalizeParkingBayStatus(sensorStatus);
  return STATUS_RESTRICTION_RANK[db] >= STATUS_RESTRICTION_RANK[sensor] ? db : sensor;
}

export function mergeParkingBayStatuses(
  dbRows: Array<{ bayCode: string; status: string }>,
  sensorBays: Array<{ code: string; status: string }>,
): Array<{ code: string; status: ParkingBayStatus }> {
  const sensorByCode = new Map(sensorBays.map((bay) => [bay.code, bay.status]));
  const merged = new Map<string, ParkingBayStatus>();

  for (const row of dbRows) {
    merged.set(row.bayCode, mergeParkingBayStatus(row.status, sensorByCode.get(row.bayCode)));
  }
  for (const bay of sensorBays) {
    if (!merged.has(bay.code)) {
      merged.set(bay.code, mergeParkingBayStatus('FREE', bay.status));
    }
  }

  return Array.from(merged.entries())
    .map(([code, status]) => ({ code, status }))
    .sort((left, right) => left.code.localeCompare(right.code));
}
