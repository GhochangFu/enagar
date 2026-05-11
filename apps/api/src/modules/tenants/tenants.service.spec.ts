import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  const service = new TenantsService();

  it('returns the eight active municipal ULBs (portal tenant excluded from pickers)', () => {
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

  it('resolves the citizen portal tenant for auth and config (but not via list())', () => {
    expect(service.list().some((t) => t.code === 'WBPORTAL')).toBe(false);
    expect(service.getConfig('WBPORTAL')).toMatchObject({
      code: 'WBPORTAL',
      name: 'West Bengal Citizen Portal',
      ward_count: 0,
      theme_color: '#1565C0',
    });
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
