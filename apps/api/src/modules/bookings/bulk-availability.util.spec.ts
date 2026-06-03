import {
  addDaysToIstYmd,
  istWeekdayFromYmd,
  istWindowToIso,
  listIstDatesMatchingWeekdays,
} from './bulk-availability.util';

describe('bulk-availability.util', () => {
  it('lists weekdays between two IST dates', () => {
    const dates = listIstDatesMatchingWeekdays('2026-06-01', '2026-06-07', [1, 2, 3, 4, 5]);
    expect(dates.length).toBeGreaterThan(0);
    for (const ymd of dates) {
      const dow = istWeekdayFromYmd(ymd);
      expect(dow).toBeGreaterThanOrEqual(1);
      expect(dow).toBeLessThanOrEqual(5);
    }
  });

  it('builds IST window instants', () => {
    const window = istWindowToIso('2026-06-05', '09:00', '21:00');
    expect(window.starts_at).toContain('T');
    expect(window.ends_at > window.starts_at).toBe(true);
  });

  it('adds days on IST calendar', () => {
    expect(addDaysToIstYmd('2026-06-05', 1)).toBe('2026-06-06');
  });
});
