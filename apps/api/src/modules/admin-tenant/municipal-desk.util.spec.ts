import {
  applyMunicipalSignoffToDeskSnapshot,
  deskSnapshotForMunicipalGuard,
  readMunicipalSignoffPolicyFromConfig,
  readMunicipalSignoffThresholdFromConfig,
} from './municipal-desk.util';

describe('municipal-desk.util', () => {
  it('reads municipal policy defaults from override_config', () => {
    expect(readMunicipalSignoffPolicyFromConfig({ municipal_signoff_policy: 'never' })).toBe(
      'never',
    );
    expect(readMunicipalSignoffPolicyFromConfig({})).toBe('high_value_only');
    expect(
      readMunicipalSignoffThresholdFromConfig({ municipal_signoff_threshold_paise: 2500 }),
    ).toBe(2500);
  });

  it('merges policy into desk snapshot for high-value applications', () => {
    const config = {
      municipal_signoff_policy: 'high_value_only',
      municipal_signoff_threshold_paise: 10_000,
    };
    const low = applyMunicipalSignoffToDeskSnapshot(config, { computed_fee_paise: 100 });
    expect(low.municipal_signoff_required).toBe(false);

    const high = applyMunicipalSignoffToDeskSnapshot(config, { computed_fee_paise: 20_000 });
    expect(high.municipal_signoff_required).toBe(true);
  });

  it('previews guarded branches for allowed transitions', () => {
    const config = { municipal_signoff_policy: 'high_value_only' };
    const base = { computed_fee_paise: 100 };
    expect(
      deskSnapshotForMunicipalGuard(config, base, { type: 'municipal_signoff_required' })
        .municipal_signoff_required,
    ).toBe(true);
    expect(
      deskSnapshotForMunicipalGuard(config, base, { type: 'municipal_signoff_not_required' })
        .municipal_signoff_required,
    ).toBe(false);
  });
});
