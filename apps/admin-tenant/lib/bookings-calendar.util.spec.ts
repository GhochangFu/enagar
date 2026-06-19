import { istWindowToIso, toCalendarEvents } from './bookings-calendar.util';

describe('bookings-calendar.util', () => {
  it('maps availability and reservations to calendar events', () => {
    const events = toCalendarEvents({
      assetFilter: 'hall-a',
      availability: [
        {
          id: '1',
          asset_code: 'hall-a',
          kind: 'available',
          starts_at: '2026-06-10T03:30:00.000Z',
          ends_at: '2026-06-10T15:30:00.000Z',
          note: null,
        },
        {
          id: '2',
          asset_code: 'hall-b',
          kind: 'blackout',
          starts_at: '2026-06-11T03:30:00.000Z',
          ends_at: '2026-06-11T15:30:00.000Z',
          note: 'Maintenance',
        },
      ],
      reservations: [
        {
          id: '3',
          asset_code: 'hall-a',
          holder_name: 'Citizen',
          starts_at: '2026-06-10T04:30:00.000Z',
          ends_at: '2026-06-10T05:30:00.000Z',
          status: 'confirmed',
        },
      ],
    });
    expect(events).toHaveLength(2);
    expect(events.some((e) => e.kind === 'reservation')).toBe(true);
  });

  it('filters events by asset type', () => {
    const events = toCalendarEvents({
      assetFilter: null,
      assetTypeFilter: 'AMBULANCE',
      assets: [
        { code: 'amb-1', asset_type: 'AMBULANCE' },
        { code: 'hall-a', asset_type: 'HALL' },
      ],
      availability: [
        {
          id: '1',
          asset_code: 'amb-1',
          kind: 'available',
          starts_at: '2026-06-10T03:30:00.000Z',
          ends_at: '2026-06-10T15:30:00.000Z',
          note: null,
        },
        {
          id: '2',
          asset_code: 'hall-a',
          kind: 'available',
          starts_at: '2026-06-10T03:30:00.000Z',
          ends_at: '2026-06-10T15:30:00.000Z',
          note: null,
        },
      ],
      reservations: [],
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.asset_code).toBe('amb-1');
  });

  it('converts IST date and times to ISO', () => {
    const window = istWindowToIso('2026-06-10', '09:00', '21:00');
    expect(window.starts_at).toContain('T');
    expect(new Date(window.ends_at).getTime()).toBeGreaterThan(
      new Date(window.starts_at).getTime(),
    );
  });
});
