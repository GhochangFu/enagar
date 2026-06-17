export type SmartParkingHoldNote = {
  source: 'smart_parking';
  bay_code: string;
  zone_code: string;
  hold_expires_at: string;
  vehicle_type: string | null;
  vehicle_number: string;
};

export function parseSmartParkingHoldNote(raw: string | null): SmartParkingHoldNote {
  if (!raw) {
    throw new Error('Parking hold metadata is missing');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Parking hold metadata is invalid');
  }
  const note = parsed as Partial<SmartParkingHoldNote>;
  if (
    note?.source !== 'smart_parking' ||
    !note.bay_code ||
    !note.zone_code ||
    !note.hold_expires_at
  ) {
    throw new Error('Parking hold metadata is invalid');
  }
  const vehicleNumber = note.vehicle_number?.trim();
  if (!vehicleNumber) {
    throw new Error('Parking hold metadata is invalid');
  }
  return {
    source: 'smart_parking',
    bay_code: note.bay_code,
    zone_code: note.zone_code,
    hold_expires_at: note.hold_expires_at,
    vehicle_type: note.vehicle_type ?? null,
    vehicle_number: vehicleNumber.toUpperCase(),
  };
}

export function tryParseSmartParkingHoldNote(raw: string | null): SmartParkingHoldNote | null {
  try {
    return parseSmartParkingHoldNote(raw);
  } catch {
    return null;
  }
}

export function isSmartParkingHoldExpired(
  note: SmartParkingHoldNote,
  status: string,
  now: Date = new Date(),
): boolean {
  if (status !== 'hold') {
    return false;
  }
  const expiresAt = new Date(note.hold_expires_at);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime();
}

export function isActiveSmartParkingReservation(
  row: { status: string; note: string | null; startsAt: Date; endsAt: Date },
  windowStart: Date,
  windowEnd: Date,
  now: Date = new Date(),
): boolean {
  if (row.status !== 'hold' && row.status !== 'confirmed') {
    return false;
  }
  if (row.endsAt <= windowStart || row.startsAt >= windowEnd) {
    return false;
  }
  const note = tryParseSmartParkingHoldNote(row.note);
  if (!note) {
    return false;
  }
  if (isSmartParkingHoldExpired(note, row.status, now)) {
    return false;
  }
  return true;
}
