import { groupSlotsByIstDay, toggleSlotSelection, type BookableSlot } from './booking-slot-grid';

const rules = { minMinutes: 60, maxMinutes: 180 };

function slot(hourUtc: number, status: 'free' | 'taken'): BookableSlot {
  const start = new Date(`2026-06-10T0${hourUtc}:30:00.000Z`);
  const end = new Date(start.getTime() + 3_600_000);
  return { starts_at: start.toISOString(), ends_at: end.toISOString(), status };
}

describe('booking-slot-grid', () => {
  it('groups slots by IST calendar day', () => {
    const slots = [slot(4, 'free'), slot(5, 'free')];
    const grouped = groupSlotsByIstDay(slots);
    expect(grouped.size).toBeGreaterThan(0);
    const first = [...grouped.values()][0];
    expect(first).toHaveLength(2);
  });

  it('rejects extending selection across taken slots', () => {
    const slots = [slot(4, 'free'), slot(5, 'taken'), slot(6, 'free')];
    const first = toggleSlotSelection(slots, null, slots[0]!, rules);
    const extended = toggleSlotSelection(slots, first, slots[2]!, rules);
    expect(extended?.startsAt).toBe(slots[2]!.starts_at);
  });
});
