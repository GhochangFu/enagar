export type TimeRangeMs = { startMs: number; endMs: number };

export type BookableSlotStatus = 'free' | 'taken';

export type GeneratedBookableSlot = {
  starts_at: string;
  ends_at: string;
  status: BookableSlotStatus;
};

function clipRange(
  range: { startsAt: Date; endsAt: Date },
  fromMs: number,
  toMs: number,
): TimeRangeMs | null {
  const startMs = Math.max(range.startsAt.getTime(), fromMs);
  const endMs = Math.min(range.endsAt.getTime(), toMs);
  if (startMs >= endMs) {
    return null;
  }
  return { startMs, endMs };
}

function subtractInterval(base: TimeRangeMs, cut: TimeRangeMs): TimeRangeMs[] {
  if (cut.endMs <= base.startMs || cut.startMs >= base.endMs) {
    return [base];
  }
  const parts: TimeRangeMs[] = [];
  if (cut.startMs > base.startMs) {
    parts.push({ startMs: base.startMs, endMs: cut.startMs });
  }
  if (cut.endMs < base.endMs) {
    parts.push({ startMs: cut.endMs, endMs: base.endMs });
  }
  return parts;
}

function subtractMany(bases: TimeRangeMs[], cuts: TimeRangeMs[]): TimeRangeMs[] {
  let current = bases;
  for (const cut of cuts) {
    current = current.flatMap((base) => subtractInterval(base, cut));
  }
  return current;
}

function overlaps(a: TimeRangeMs, b: TimeRangeMs): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

function splitToSteps(ranges: TimeRangeMs[], stepMinutes: number): TimeRangeMs[] {
  const stepMs = stepMinutes * 60_000;
  const slots: TimeRangeMs[] = [];
  for (const range of ranges) {
    let cursor = range.startMs;
    while (cursor + stepMs <= range.endMs) {
      slots.push({ startMs: cursor, endMs: cursor + stepMs });
      cursor += stepMs;
    }
  }
  return slots;
}

/**
 * Sprint 8.1B slot grid: available − blackouts − reservations → stepped free/taken slots.
 */
export function generateBookableSlots(input: {
  from: Date;
  to: Date;
  slotStepMinutes: number;
  available: Array<{ startsAt: Date; endsAt: Date }>;
  blackouts: Array<{ startsAt: Date; endsAt: Date }>;
  reservations: Array<{ startsAt: Date; endsAt: Date }>;
}): GeneratedBookableSlot[] {
  const fromMs = input.from.getTime();
  const toMs = input.to.getTime();
  if (fromMs >= toMs) {
    return [];
  }

  const availableRanges = input.available
    .map((row) => clipRange(row, fromMs, toMs))
    .filter((row): row is TimeRangeMs => row !== null);

  const blackoutRanges = input.blackouts
    .map((row) => clipRange(row, fromMs, toMs))
    .filter((row): row is TimeRangeMs => row !== null);

  const openRanges = subtractMany(availableRanges, blackoutRanges);
  const stepSlots = splitToSteps(openRanges, input.slotStepMinutes);

  const takenRanges = input.reservations
    .map((row) => clipRange(row, fromMs, toMs))
    .filter((row): row is TimeRangeMs => row !== null);

  return stepSlots.map((slot) => ({
    starts_at: new Date(slot.startMs).toISOString(),
    ends_at: new Date(slot.endMs).toISOString(),
    status: takenRanges.some((taken) => overlaps(slot, taken)) ? 'taken' : 'free',
  }));
}
