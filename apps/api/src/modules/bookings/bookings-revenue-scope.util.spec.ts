import { resolveRevenueHeadCodeForAsset } from './bookings-revenue-scope.util';

describe('resolveRevenueHeadCodeForAsset', () => {
  it('resolves revenue head from bookable_asset_codes array (ad-led)', () => {
    const code = resolveRevenueHeadCodeForAsset(
      [
        {
          overrideConfig: { bookable_asset_codes: ['kmc-led-central', 'kmc-led-park-street'] },
          revenueHeadCode: 'booking-fee',
        },
        {
          overrideConfig: { bookable_asset_codes: ['community-hall-main'] },
          revenueHeadCode: 'booking-fee',
        },
      ],
      'kmc-led-central',
      'booking-fee',
    );
    expect(code).toBe('booking-fee');
  });

  it('falls back when asset is not in any service mapping', () => {
    expect(
      resolveRevenueHeadCodeForAsset(
        [{ overrideConfig: { bookable_asset_codes: ['hall-a'] }, revenueHeadCode: 'booking-fee' }],
        'unknown-asset',
        'booking-fee',
      ),
    ).toBe('booking-fee');
  });

  it('reads legacy bookable_asset_code singular field', () => {
    expect(
      resolveRevenueHeadCodeForAsset(
        [{ overrideConfig: { bookable_asset_code: 'community-hall-main' }, revenueHeadCode: 'RH-BOOK' }],
        'community-hall-main',
        'booking-fee',
      ),
    ).toBe('RH-BOOK');
  });
});
