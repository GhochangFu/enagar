import { CITIZEN_PORTAL_TENANT_CODE, tenantSeeds } from './tenant.seed';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  it('returns seed ULBs when Prisma is unavailable', async () => {
    const service = new TenantsService();
    const tenants = await service.list();

    expect(tenants.length).toBeGreaterThan(0);
    expect(tenants.some((t) => t.code === 'WBPORTAL')).toBe(false);
    expect(tenants.map((t) => t.code)).toEqual(
      tenantSeeds
        .filter((t) => t.is_active && t.code !== CITIZEN_PORTAL_TENANT_CODE)
        .map((t) => t.code),
    );
  });

  it('lists active tenants from Postgres when available', async () => {
    const prisma = {
      tenant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            code: 'BLYM',
            name: 'Bally Municipality',
            district: 'Howrah',
            wardCount: 20,
            themeColor: '#0E7490',
            logoUrl: null,
            languagesEnabled: ['en', 'bn'],
            isActive: true,
          },
        ]),
      },
      tenantService: { count: jest.fn() },
      serviceCategory: { count: jest.fn() },
    };
    const service = new TenantsService(prisma as never);
    const tenants = await service.list();

    expect(tenants).toHaveLength(1);
    expect(tenants[0]).toMatchObject({ code: 'BLYM', is_active: true });
  });

  it('resolves the citizen portal tenant for config (not via list())', async () => {
    const service = new TenantsService();
    const tenants = await service.list();
    expect(tenants.some((t) => t.code === 'WBPORTAL')).toBe(false);
    await expect(service.getConfig('WBPORTAL')).resolves.toMatchObject({
      code: 'WBPORTAL',
      name: 'West Bengal Citizen Portal',
    });
  });

  it('returns tenant config with theme and ward count from seeds', async () => {
    const service = new TenantsService();
    await expect(service.getConfig('KMC')).resolves.toMatchObject({
      code: 'KMC',
      name: 'Kolkata Municipal Corporation',
      ward_count: 144,
      theme_color: '#0F4C75',
    });
  });
});
