import type { BookingsCalendarEvent } from './bookings-calendar.util';

const IST = 'Asia/Kolkata';

export function ymdTodayIst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date());
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map((part) => Number(part));
  const cursor = new Date(Date.UTC(y, m - 1, d));
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
}

export function formatYmdIstLabel(ymd: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${ymd}T12:00:00+05:30`));
}

/** Civil day in IST for an instant. */
export function ymdInIstFromIso(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date(iso));
}

/** Hour bucket 0–23 in IST for an instant. */
export function hourInIstFromIso(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '0';
  return Number(hour);
}

export function eventsOnIstDay(
  events: BookingsCalendarEvent[],
  dayYmd: string,
): BookingsCalendarEvent[] {
  return events.filter((event) => {
    const startDay = ymdInIstFromIso(event.starts_at);
    const endDay = ymdInIstFromIso(event.ends_at);
    return startDay <= dayYmd && endDay >= dayYmd;
  });
}

export function eventsForIstHour(
  events: BookingsCalendarEvent[],
  dayYmd: string,
  hour: number,
): BookingsCalendarEvent[] {
  return eventsOnIstDay(events, dayYmd).filter((event) => {
    const startHour = hourInIstFromIso(event.starts_at);
    const endHour = hourInIstFromIso(event.ends_at);
    const endMinute = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: IST,
        minute: '2-digit',
      }).format(new Date(event.ends_at)),
    );
    const endHourInclusive = endMinute > 0 ? endHour : endHour - 1;
    return hour >= startHour && hour <= endHourInclusive;
  });
}

export function defaultAdminHourRange(): { open: number; close: number } {
  return { open: 9, close: 21 };
}
