import {
  bookableAssetCodesMissingFromDb,
  filterBookableAssetsForService,
  resolveBookableAssetCodesForMapping,
  serviceShowsBookableAssetMapping,
  workflowDefinitionIsBooking,
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

  it('shows mapping for catalogue booking pattern without hall workflow', () => {
    expect(serviceShowsBookableAssetMapping('booking', null)).toBe(true);
  });

  it('shows mapping for ad-led even with cert-issuance workflow pattern', () => {
    expect(serviceShowsBookableAssetMapping('cert-issuance', null, 'ad-led')).toBe(true);
  });

  it('filters LED boards only for ad-led', () => {
    const rows = [
      { code: 'kmc-led-central', asset_type: 'LED_BOARD', is_active: true },
      { code: 'community-hall-main', asset_type: 'HALL', is_active: true },
    ];
    expect(filterBookableAssetsForService('ad-led', rows).map((row) => row.code)).toEqual([
      'kmc-led-central',
    ]);
  });

  it('detects hall booking workflow by slot-review stage', () => {
    expect(
      workflowDefinitionIsBooking({
        code: 'community-hall-workflow-v1',
        stages: [{ code: 'slot-review' }],
        transitions: [],
      } as never),
    ).toBe(true);
  });
});
