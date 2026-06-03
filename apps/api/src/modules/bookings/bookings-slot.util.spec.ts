import { generateBookableSlots } from './bookings-slot.util';

describe('generateBookableSlots', () => {
  const from = new Date('2026-06-10T04:30:00.000Z');
  const to = new Date('2026-06-10T07:30:00.000Z');

  it('emits hourly free slots inside available windows', () => {
    const slots = generateBookableSlots({
      from,
      to,
      slotStepMinutes: 60,
      available: [
        {
          startsAt: new Date('2026-06-10T03:30:00.000Z'),
          endsAt: new Date('2026-06-10T15:30:00.000Z'),
        },
      ],
      blackouts: [],
      reservations: [],
    });

    expect(slots).toEqual([
      {
        starts_at: '2026-06-10T04:30:00.000Z',
        ends_at: '2026-06-10T05:30:00.000Z',
        status: 'free',
      },
      {
        starts_at: '2026-06-10T05:30:00.000Z',
        ends_at: '2026-06-10T06:30:00.000Z',
        status: 'free',
      },
      {
        starts_at: '2026-06-10T06:30:00.000Z',
        ends_at: '2026-06-10T07:30:00.000Z',
        status: 'free',
      },
    ]);
  });

  it('marks overlapping reservations as taken', () => {
    const slots = generateBookableSlots({
      from,
      to,
      slotStepMinutes: 60,
      available: [
        {
          startsAt: new Date('2026-06-10T03:30:00.000Z'),
          endsAt: new Date('2026-06-10T15:30:00.000Z'),
        },
      ],
      blackouts: [],
      reservations: [
        {
          startsAt: new Date('2026-06-10T05:30:00.000Z'),
          endsAt: new Date('2026-06-10T06:30:00.000Z'),
        },
      ],
    });

    expect(slots.find((slot) => slot.starts_at === '2026-06-10T05:30:00.000Z')?.status).toBe(
      'taken',
    );
    expect(slots.find((slot) => slot.starts_at === '2026-06-10T04:30:00.000Z')?.status).toBe(
      'free',
    );
  });

  it('removes blackout ranges before stepping', () => {
    const slots = generateBookableSlots({
      from,
      to: new Date('2026-06-10T08:30:00.000Z'),
      slotStepMinutes: 60,
      available: [
        {
          startsAt: new Date('2026-06-10T03:30:00.000Z'),
          endsAt: new Date('2026-06-10T15:30:00.000Z'),
        },
      ],
      blackouts: [
        {
          startsAt: new Date('2026-06-10T06:00:00.000Z'),
          endsAt: new Date('2026-06-10T07:00:00.000Z'),
        },
      ],
      reservations: [],
    });

    expect(slots.map((slot) => slot.starts_at)).toEqual([
      '2026-06-10T04:30:00.000Z',
      '2026-06-10T07:00:00.000Z',
    ]);
  });
});
