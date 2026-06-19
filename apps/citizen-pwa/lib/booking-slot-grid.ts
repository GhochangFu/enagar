export type BookableSlot = {
  starts_at: string;
  ends_at: string;
  status: 'free' | 'taken';
  /** Pooled health fleet slots — number of free units in the window. */
  available_units?: number;
};

export type BookingDurationRules = {
  minMinutes: number;
  maxMinutes: number;
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function parseBookingDurationRules(rules: unknown): BookingDurationRules {
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    return { minMinutes: 60, maxMinutes: 480 };
  }
  const record = rules as Record<string, unknown>;
  const min =
    typeof record.min_duration_minutes === 'number' && record.min_duration_minutes > 0
      ? record.min_duration_minutes
      : 60;
  const max =
    typeof record.max_duration_minutes === 'number' && record.max_duration_minutes >= min
      ? record.max_duration_minutes
      : 480;
  return { minMinutes: min, maxMinutes: max };
}

/** UTC midnight for a civil day in Asia/Kolkata. */
export function istDayStartUtc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+05:30`);
}

export function istDayEndUtc(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+05:30`);
}

export function formatIstDate(
  instant: Date | string,
  locale: string,
  style: 'short' | 'long' = 'long',
): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Kolkata',
    dateStyle: style,
  }).format(date);
}

export function formatIstTimeRange(startsAt: string, endsAt: string, locale: string): string {
  const timeFmt = new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${timeFmt.format(new Date(startsAt))} – ${timeFmt.format(new Date(endsAt))}`;
}

export function isIstWeekday(ymdOrInstant: string | Date): boolean {
  const instant = typeof ymdOrInstant === 'string' ? istDayStartUtc(ymdOrInstant) : ymdOrInstant;
  const dow = new Date(instant.getTime() + IST_OFFSET_MS).getUTCDay();
  return dow >= 1 && dow <= 5;
}

/** First IST weekday on or after `fromYmd` (inclusive). */
export function nextIstWeekdayYmd(fromYmd: string): string {
  let cursor = fromYmd;
  for (let i = 0; i < 14; i++) {
    if (isIstWeekday(cursor)) {
      return cursor;
    }
    cursor = addDaysYmd(cursor, 1);
  }
  return fromYmd;
}

export function ymdInIst(instant: Date): string {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const start = istDayStartUtc(ymd);
  start.setUTCDate(start.getUTCDate() + days);
  return ymdInIst(start);
}

export function groupSlotsByIstDay(slots: BookableSlot[]): Map<string, BookableSlot[]> {
  const map = new Map<string, BookableSlot[]>();
  for (const slot of slots) {
    const key = ymdInIst(new Date(slot.starts_at));
    const bucket = map.get(key) ?? [];
    bucket.push(slot);
    map.set(key, bucket);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }
  return map;
}

export function slotStepMinutes(slots: BookableSlot[]): number {
  if (slots.length < 2) {
    return 60;
  }
  return Math.round(
    (new Date(slots[1]!.starts_at).getTime() - new Date(slots[0]!.starts_at).getTime()) / 60_000,
  );
}

export type SlotSelection = { startsAt: string; endsAt: string } | null;

/** Toggle selection on an hour grid; only contiguous free slots allowed. */
export function toggleSlotSelection(
  slots: BookableSlot[],
  selected: SlotSelection,
  slot: BookableSlot,
  rules: BookingDurationRules,
): SlotSelection {
  if (slot.status === 'taken') {
    return selected;
  }
  if (!selected) {
    return { startsAt: slot.starts_at, endsAt: slot.ends_at };
  }
  if (selected.startsAt === slot.starts_at && selected.endsAt === slot.ends_at) {
    return null;
  }

  const ordered = [...slots].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const startIdx = ordered.findIndex((s) => s.starts_at === selected.startsAt);
  const endIdx = ordered.findIndex((s) => s.ends_at === selected.endsAt);
  const clickIdx = ordered.findIndex((s) => s.starts_at === slot.starts_at);
  if (startIdx < 0 || endIdx < 0 || clickIdx < 0) {
    return { startsAt: slot.starts_at, endsAt: slot.ends_at };
  }

  const fromIdx = Math.min(startIdx, clickIdx);
  const toIdx = Math.max(endIdx, clickIdx);
  const slice = ordered.slice(fromIdx, toIdx + 1);
  if (slice.some((s) => s.status === 'taken')) {
    return { startsAt: slot.starts_at, endsAt: slot.ends_at };
  }

  const step = slotStepMinutes(ordered);
  const durationMinutes = slice.length * step;
  if (durationMinutes < rules.minMinutes || durationMinutes > rules.maxMinutes) {
    return { startsAt: slot.starts_at, endsAt: slot.ends_at };
  }

  return {
    startsAt: slice[0]!.starts_at,
    endsAt: slice[slice.length - 1]!.ends_at,
  };
}

export function isSlotInsideSelection(slot: BookableSlot, selected: SlotSelection): boolean {
  if (!selected) {
    return false;
  }
  return slot.starts_at >= selected.startsAt && slot.ends_at <= selected.endsAt;
}

export function selectionDurationMinutes(selected: SlotSelection, stepMinutes: number): number {
  if (!selected) {
    return 0;
  }
  const ms = new Date(selected.endsAt).getTime() - new Date(selected.startsAt).getTime();
  return Math.round(ms / 60_000) || stepMinutes;
}
