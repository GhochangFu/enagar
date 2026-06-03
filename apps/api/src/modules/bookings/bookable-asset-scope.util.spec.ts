import {
  bookableAssetCodesFromOverrideConfig,
  isAssetAllowedForService,
} from './bookable-asset-scope.util';

describe('bookableAssetCodesFromOverrideConfig', () => {
  it('reads a single bookable_asset_code', () => {
    expect(
      bookableAssetCodesFromOverrideConfig({ bookable_asset_code: 'community-hall-main' }),
    ).toEqual(['community-hall-main']);
  });

  it('merges bookable_asset_codes without duplicates', () => {
    expect(
      bookableAssetCodesFromOverrideConfig({
        bookable_asset_code: 'hall-a',
        bookable_asset_codes: ['hall-a', 'hall-b'],
      }),
    ).toEqual(['hall-a', 'hall-b']);
  });

  it('returns empty when unset', () => {
    expect(bookableAssetCodesFromOverrideConfig(null)).toEqual([]);
    expect(bookableAssetCodesFromOverrideConfig({})).toEqual([]);
  });
});

describe('isAssetAllowedForService', () => {
  it('matches case-insensitively', () => {
    expect(isAssetAllowedForService(['Hall-Main'], 'hall-main')).toBe(true);
    expect(isAssetAllowedForService(['hall-main'], 'other')).toBe(false);
  });
});
