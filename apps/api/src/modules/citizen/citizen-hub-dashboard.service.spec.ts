import { CitizenHubDashboardService } from './citizen-hub-dashboard.service';

describe('CitizenHubDashboardService (Hub H6.1)', () => {
  const principal = {
    subject: 'sub-1',
    tenantId: '99999999-9999-4999-8999-999999999999',
    tenantCode: 'WBPORTAL',
    roles: ['citizen'] as string[],
    expiresAt: new Date('2030-01-01'),
  };

  it('buckets tenant counts without per-ULB filter scans', async () => {
    const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    const applications = {
      list: jest
        .fn()
        .mockResolvedValue([
          { tenant_id: tenantA },
          { tenant_id: tenantA },
          { tenant_id: tenantB },
        ]),
    };
    const payments = {
      list: jest.fn().mockResolvedValue([{ tenant_id: tenantB }]),
    };
    const grievances = {
      list: jest.fn().mockResolvedValue([]),
    };
    const tenants = {
      list: jest.fn().mockReturnValue([
        { id: tenantA, code: 'AAA', theme_color: '#111' },
        { id: tenantB, code: 'BBB', theme_color: '#222' },
      ]),
    };
    const catalogue = {
      distinctActiveServiceCodesAcrossMunicipalities: jest.fn().mockReturnValue(1),
    };

    const service = new CitizenHubDashboardService(
      applications as never,
      payments as never,
      grievances as never,
      tenants as never,
      catalogue as never,
    );

    const result = await service.getDashboard(principal);

    expect(applications.list).toHaveBeenCalledWith(principal, undefined);
    expect(result.municipalities).toEqual([
      {
        tenant_id: tenantA,
        tenant_code: 'AAA',
        theme_color: '#111',
        application_count: 2,
        payment_count: 0,
        grievance_count: 0,
      },
      {
        tenant_id: tenantB,
        tenant_code: 'BBB',
        theme_color: '#222',
        application_count: 1,
        payment_count: 1,
        grievance_count: 0,
      },
    ]);
    expect(result.distinct_active_service_codes).toBe(1);
  });
});
