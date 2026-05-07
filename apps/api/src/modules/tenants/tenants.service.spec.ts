import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  const service = new TenantsService();

  it('returns the canonical 8 Phase-1 tenants', () => {
    const tenants = service.list();

    expect(tenants).toHaveLength(8);
    expect(tenants.map((tenant) => tenant.code)).toEqual([
      'KMC',
      'HMC',
      'CMC',
      'BMC',
      'SMC',
      'AMC',
      'DMC',
      'SDDM',
    ]);
  });

  it('returns tenant config with theme and ward count', () => {
    expect(service.getConfig('KMC')).toMatchObject({
      code: 'KMC',
      name: 'Kolkata Municipal Corporation',
      ward_count: 144,
      theme_color: '#0F4C75',
      config: {
        feature_flags: {
          digilocker_enabled: false,
          tenant_switcher_enabled: true,
        },
      },
    });
  });
});
