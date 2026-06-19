import { mergeFleetPoolSlots, pickFirstFreeAssetCode } from './bookings-fleet-pool.util';
import { isHealthFleetServiceCode, readBplSubsidyPaise } from './health-fleet.util';

describe('bookings-fleet-pool.util', () => {
  it('merges free units across assets for the same slot window', () => {
    const slots = mergeFleetPoolSlots([
      {
        asset_code: 'amb-1',
        slots: [
          {
            starts_at: '2026-06-20T04:00:00.000Z',
            ends_at: '2026-06-20T05:00:00.000Z',
            status: 'free',
          },
        ],
      },
      {
        asset_code: 'amb-2',
        slots: [
          {
            starts_at: '2026-06-20T04:00:00.000Z',
            ends_at: '2026-06-20T05:00:00.000Z',
            status: 'free',
          },
        ],
      },
    ]);

    expect(slots).toHaveLength(1);
    expect(slots[0]?.available_units).toBe(2);
    expect(slots[0]?.status).toBe('free');
  });

  it('marks pooled slot taken when every unit is taken', () => {
    const slots = mergeFleetPoolSlots([
      {
        asset_code: 'amb-1',
        slots: [
          {
            starts_at: '2026-06-20T04:00:00.000Z',
            ends_at: '2026-06-20T05:00:00.000Z',
            status: 'taken',
          },
        ],
      },
      {
        asset_code: 'amb-2',
        slots: [
          {
            starts_at: '2026-06-20T04:00:00.000Z',
            ends_at: '2026-06-20T05:00:00.000Z',
            status: 'taken',
          },
        ],
      },
    ]);

    expect(slots[0]?.available_units).toBe(0);
    expect(slots[0]?.status).toBe('taken');
  });

  it('picks the first asset with a matching free slot', () => {
    const code = pickFirstFreeAssetCode(
      [
        {
          asset_code: 'amb-1',
          slots: [
            {
              starts_at: '2026-06-20T04:00:00.000Z',
              ends_at: '2026-06-20T05:00:00.000Z',
              status: 'taken',
            },
          ],
        },
        {
          asset_code: 'amb-2',
          slots: [
            {
              starts_at: '2026-06-20T04:00:00.000Z',
              ends_at: '2026-06-20T05:00:00.000Z',
              status: 'free',
            },
          ],
        },
      ],
      '2026-06-20T04:00:00.000Z',
      '2026-06-20T05:00:00.000Z',
    );

    expect(code).toBe('amb-2');
  });

  it('returns null when every unit is taken for the slot (concurrency loser)', () => {
    const code = pickFirstFreeAssetCode(
      [
        {
          asset_code: 'amb-1',
          slots: [
            {
              starts_at: '2026-06-20T04:00:00.000Z',
              ends_at: '2026-06-20T05:00:00.000Z',
              status: 'taken',
            },
          ],
        },
        {
          asset_code: 'amb-2',
          slots: [
            {
              starts_at: '2026-06-20T04:00:00.000Z',
              ends_at: '2026-06-20T05:00:00.000Z',
              status: 'taken',
            },
          ],
        },
      ],
      '2026-06-20T04:00:00.000Z',
      '2026-06-20T05:00:00.000Z',
    );
    expect(code).toBeNull();
  });
});

describe('health-fleet.util', () => {
  it('detects health fleet service codes', () => {
    expect(isHealthFleetServiceCode('ambulance')).toBe(true);
    expect(isHealthFleetServiceCode('hearse')).toBe(true);
    expect(isHealthFleetServiceCode('community-hall')).toBe(false);
  });

  it('reads BPL subsidy from asset rules', () => {
    expect(readBplSubsidyPaise({ bpl_subsidy_paise: 50_000 })).toBe(50_000);
    expect(readBplSubsidyPaise({})).toBe(0);
  });
});
