export type CalendarEventKind = 'available' | 'blackout' | 'reservation';

export type BookingsCalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  asset_code: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status?: string;
};

export function toCalendarEvents(input: {
  availability: Array<{
    id: string;
    asset_code: string;
    kind: string;
    starts_at: string;
    ends_at: string;
    note: string | null;
  }>;
  reservations: Array<{
    id: string;
    asset_code: string;
    holder_name: string;
    starts_at: string;
    ends_at: string;
    status: string;
  }>;
  assetFilter: string | null;
}): BookingsCalendarEvent[] {
  const filter = input.assetFilter?.trim();
  const availability = input.availability
    .filter((row) => !filter || row.asset_code === filter)
    .map((row) => ({
      id: row.id,
      kind: row.kind === 'blackout' ? ('blackout' as const) : ('available' as const),
      asset_code: row.asset_code,
      title: row.kind === 'blackout' ? 'Blackout' : 'Available',
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: row.note ?? undefined,
    }));
  const reservations = input.reservations
    .filter((row) => !filter || row.asset_code === filter)
    .map((row) => ({
      id: row.id,
      kind: 'reservation' as const,
      asset_code: row.asset_code,
      title: `${row.holder_name} (${row.status})`,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: row.status,
    }));
  return [...availability, ...reservations].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function ymdTodayIst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function addDaysYmd(ymd: string, days: number): string {
  const [yStr, mStr, dStr] = ymd.split('-') as [string, string, string];
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
}

/** Build ISO instants for an IST civil day + HH:mm local times. */
export function istWindowToIso(
  dateYmd: string,
  startHm: string,
  endHm: string,
): { starts_at: string; ends_at: string } {
  const starts_at = new Date(`${dateYmd}T${startHm}:00+05:30`).toISOString();
  const ends_at = new Date(`${dateYmd}T${endHm}:00+05:30`).toISOString();
  return { starts_at, ends_at };
}
