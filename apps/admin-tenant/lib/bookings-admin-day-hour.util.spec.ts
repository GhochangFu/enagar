import {
  eventsForIstHour,
  eventsOnIstDay,
  hourInIstFromIso,
  ymdInIstFromIso,
} from './bookings-admin-day-hour.util';

import type { BookingsCalendarEvent } from './bookings-calendar.util';

describe('bookings-admin-day-hour.util', () => {
  const sample: BookingsCalendarEvent = {
    id: '1',
    kind: 'reservation',
    asset_code: 'community-hall-main',
    title: 'Citizen (hold)',
    starts_at: '2026-06-10T04:30:00.000Z',
    ends_at: '2026-06-10T06:30:00.000Z',
    status: 'hold',
  };

  it('maps UTC slot to IST day and hours', () => {
    expect(ymdInIstFromIso(sample.starts_at)).toBe('2026-06-10');
    expect(hourInIstFromIso(sample.starts_at)).toBe(10);
    expect(hourInIstFromIso(sample.ends_at)).toBe(12);
  });

  it('places event on 10:00 and 11:00 IST rows', () => {
    const dayEvents = eventsOnIstDay([sample], '2026-06-10');
    expect(dayEvents).toHaveLength(1);
    expect(eventsForIstHour(dayEvents, '2026-06-10', 10)).toHaveLength(1);
    expect(eventsForIstHour(dayEvents, '2026-06-10', 11)).toHaveLength(1);
    expect(eventsForIstHour(dayEvents, '2026-06-10', 9)).toHaveLength(0);
  });
});
