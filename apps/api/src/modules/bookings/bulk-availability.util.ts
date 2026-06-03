const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HM_RE = /^(\d{1,2}):(\d{2})$/;

export function istWindowToIso(
  dateYmd: string,
  startHm: string,
  endHm: string,
): { starts_at: string; ends_at: string } {
  const starts_at = new Date(`${dateYmd}T${startHm}:00+05:30`).toISOString();
  const ends_at = new Date(`${dateYmd}T${endHm}:00+05:30`).toISOString();
  if (starts_at >= ends_at) {
    throw new Error('End time must be after start time on the same IST day');
  }
  return { starts_at, ends_at };
}

export function parseIstYmd(ymd: string): { y: number; m: number; d: number } {
  const match = YMD_RE.exec(ymd.trim());
  if (!match) {
    throw new Error('Date must be YYYY-MM-DD');
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    throw new Error('Invalid calendar date');
  }
  return { y, m, d };
}

export function formatIstYmd(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Weekday in IST: 0 = Sunday … 6 = Saturday. */
export function istWeekdayFromYmd(ymd: string): number {
  const { y, m, d } = parseIstYmd(ymd);
  const utcMidnight = Date.UTC(y, m - 1, d);
  return new Date(utcMidnight + IST_OFFSET_MS).getUTCDay();
}

export function addDaysToIstYmd(ymd: string, days: number): string {
  const { y, m, d } = parseIstYmd(ymd);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return formatIstYmd(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate());
}

export function todayIstYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function listIstDatesMatchingWeekdays(
  fromYmd: string,
  toYmd: string,
  weekdays: number[],
): string[] {
  const from = parseIstYmd(fromYmd);
  const to = parseIstYmd(toYmd);
  const fromKey = from.y * 10000 + from.m * 100 + from.d;
  const toKey = to.y * 10000 + to.m * 100 + to.d;
  if (fromKey > toKey) {
    throw new Error('from_date must be on or before to_date');
  }
  const allowed = new Set(weekdays);
  const dates: string[] = [];
  for (let cursor = fromYmd; ; cursor = addDaysToIstYmd(cursor, 1)) {
    const parts = parseIstYmd(cursor);
    const key = parts.y * 10000 + parts.m * 100 + parts.d;
    if (key > toKey) {
      break;
    }
    if (allowed.has(istWeekdayFromYmd(cursor))) {
      dates.push(cursor);
    }
  }
  return dates;
}

export function assertHm(value: string, field: string): string {
  const match = HM_RE.exec(value.trim());
  if (!match) {
    throw new Error(`${field} must be HH:mm`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`${field} must be a valid time`);
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
