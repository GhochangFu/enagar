import {
  bookableAssetCodesMissingFromDb,
  resolveBookableAssetCodesForMapping,
} from './bookable-assets-mapping.util';

describe('bookable-assets-mapping.util', () => {
  const assets = [{ code: 'community-hall-main' }, { code: 'rabindra-bhawan-w91' }];

  it('drops config codes that are not in the tenant asset catalogue', () => {
    expect(
      resolveBookableAssetCodesForMapping(
        ['community-hall-main', 'rabindra-bhawan', 'rabindra-bhawan-w91'],
        assets,
      ),
    ).toEqual(['community-hall-main', 'rabindra-bhawan-w91']);
  });

  it('lists stale catalogue codes for operator messaging', () => {
    expect(
      bookableAssetCodesMissingFromDb(
        ['community-hall-main', 'rabindra-bhawan', 'kmc-tennis-court-a'],
        assets,
      ),
    ).toEqual(['rabindra-bhawan', 'kmc-tennis-court-a']);
  });
});
