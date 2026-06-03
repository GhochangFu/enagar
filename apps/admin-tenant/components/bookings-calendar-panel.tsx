'use client';

import { useMemo, useState } from 'react';

import {
  addDaysYmd,
  defaultAdminHourRange,
  eventsForIstHour,
  eventsOnIstDay,
  formatYmdIstLabel,
  ymdTodayIst,
} from '../lib/bookings-admin-day-hour.util';
import { toCalendarEvents, type BookingsCalendarEvent } from '../lib/bookings-calendar.util';

import type { JSX } from 'react';

type BookingsCalendarPanelProps = {
  assets: Array<{ code: string; name: unknown }>;
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
  assetFilter: string;
  onAssetFilterChange: (code: string) => void;
  onSelectEvent: (event: BookingsCalendarEvent) => void;
  pickLabel: (json: unknown) => string;
};

type CalendarView = 'agenda' | 'day-hours';

function eventStyles(kind: BookingsCalendarEvent['kind']): string {
  if (kind === 'blackout') {
    return 'border-amber-300 bg-amber-50 text-amber-950';
  }
  if (kind === 'reservation') {
    return 'border-violet-300 bg-violet-50 text-violet-950';
  }
  return 'border-emerald-300 bg-emerald-50 text-emerald-950';
}

function formatIstTimeRange(startsAt: string, endsAt: string): string {
  const fmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${fmt.format(new Date(startsAt))} – ${fmt.format(new Date(endsAt))} IST`;
}

function EventButton({
  event,
  onSelectEvent,
}: {
  event: BookingsCalendarEvent;
  onSelectEvent: (event: BookingsCalendarEvent) => void;
}): JSX.Element {
  return (
    <button
      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${eventStyles(event.kind)}`}
      data-testid={`booking-calendar-event-${event.kind}-${event.id}`}
      onClick={() => onSelectEvent(event)}
      type="button"
    >
      <span className="font-semibold">
        {event.asset_code} · {event.title}
      </span>
      <span className="mt-1 block text-xs opacity-80">
        {formatIstTimeRange(event.starts_at, event.ends_at)}
      </span>
    </button>
  );
}

export function BookingsCalendarPanel({
  assets,
  availability,
  reservations,
  assetFilter,
  onAssetFilterChange,
  onSelectEvent,
  pickLabel,
}: BookingsCalendarPanelProps): JSX.Element {
  const [view, setView] = useState<CalendarView>('day-hours');
  const [focusDayYmd, setFocusDayYmd] = useState(ymdTodayIst);

  const events = useMemo(
    () =>
      toCalendarEvents({
        availability,
        reservations,
        assetFilter: assetFilter || null,
      }),
    [availability, reservations, assetFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, BookingsCalendarEvent[]>();
    for (const event of events) {
      const day = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
      }).format(new Date(event.starts_at));
      const bucket = map.get(day) ?? [];
      bucket.push(event);
      map.set(day, bucket);
    }
    return [...map.entries()];
  }, [events]);

  const dayEvents = useMemo(() => eventsOnIstDay(events, focusDayYmd), [events, focusDayYmd]);
  const { open, close } = defaultAdminHourRange();
  const hourRows = useMemo(
    () => Array.from({ length: close - open }, (_, index) => open + index),
    [open, close],
  );

  return (
    <section
      className="space-y-4 rounded-2xl border border-ink-muted/30 bg-white p-4 shadow-sm"
      data-testid="bookings-calendar-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-ink-primary">Booking calendar</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-ink-muted/40 p-0.5 text-sm">
            <button
              className={`rounded-md px-3 py-1 font-semibold ${view === 'day-hours' ? 'bg-ink-primary text-white' : 'text-ink-secondary'}`}
              data-testid="booking-calendar-view-day-hours"
              onClick={() => setView('day-hours')}
              type="button"
            >
              Day hours
            </button>
            <button
              className={`rounded-md px-3 py-1 font-semibold ${view === 'agenda' ? 'bg-ink-primary text-white' : 'text-ink-secondary'}`}
              data-testid="booking-calendar-view-agenda"
              onClick={() => setView('agenda')}
              type="button"
            >
              Agenda
            </button>
          </div>
          <label className="text-sm text-ink-secondary">
            Asset{' '}
            <select
              className="ml-2 rounded-lg border border-ink-muted/40 px-2 py-1"
              data-testid="booking-calendar-asset-filter"
              onChange={(event) => onAssetFilterChange(event.target.value)}
              value={assetFilter}
            >
              <option value="">All assets</option>
              {assets.map((asset) => (
                <option key={asset.code} value={asset.code}>
                  {pickLabel(asset.name)} ({asset.code})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-900">
          Available
        </span>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900">
          Blackout
        </span>
        <span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-1 text-violet-900">
          Reservation
        </span>
      </div>

      {view === 'day-hours' ? (
        <div className="space-y-3" data-testid="booking-calendar-day-hours">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink-primary">{formatYmdIstLabel(focusDayYmd)}</p>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-ink-muted/40 px-2 py-1 text-sm font-semibold"
                onClick={() => setFocusDayYmd(addDaysYmd(focusDayYmd, -1))}
                type="button"
              >
                Previous day
              </button>
              <button
                className="rounded-lg border border-ink-muted/40 px-2 py-1 text-sm font-semibold"
                onClick={() => setFocusDayYmd(ymdTodayIst())}
                type="button"
              >
                Today
              </button>
              <button
                className="rounded-lg border border-ink-muted/40 px-2 py-1 text-sm font-semibold"
                onClick={() => setFocusDayYmd(addDaysYmd(focusDayYmd, 1))}
                type="button"
              >
                Next day
              </button>
            </div>
          </div>
          {dayEvents.length === 0 ? (
            <p className="text-sm text-ink-secondary">No windows or reservations on this day.</p>
          ) : (
            <div className="divide-y divide-ink-muted/20 rounded-xl border border-ink-muted/30">
              {hourRows.map((hour) => {
                const hourEvents = eventsForIstHour(dayEvents, focusDayYmd, hour);
                const label = `${String(hour).padStart(2, '0')}:00`;
                return (
                  <div
                    className="grid gap-2 px-3 py-2 sm:grid-cols-[4.5rem_1fr]"
                    data-testid={`booking-calendar-hour-${hour}`}
                    key={hour}
                  >
                    <span className="text-xs font-bold uppercase tracking-wide text-ink-secondary">
                      {label} IST
                    </span>
                    <div className="space-y-2">
                      {hourEvents.length === 0 ? (
                        <span className="text-xs text-ink-secondary">—</span>
                      ) : (
                        hourEvents.map((event) => (
                          <EventButton
                            event={event}
                            key={`${event.kind}-${event.id}-${hour}`}
                            onSelectEvent={onSelectEvent}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-ink-secondary">No windows or reservations for this filter.</p>
      ) : (
        <div className="space-y-4" data-testid="booking-calendar-agenda">
          {grouped.map(([day, dayEventsAgenda]) => (
            <div key={day}>
              <p className="text-sm font-bold text-ink-primary">{day}</p>
              <ul className="mt-2 space-y-2">
                {dayEventsAgenda.map((event) => (
                  <li key={`${event.kind}-${event.id}`}>
                    <EventButton event={event} onSelectEvent={onSelectEvent} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
