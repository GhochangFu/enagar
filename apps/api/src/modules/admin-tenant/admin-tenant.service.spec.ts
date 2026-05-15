import { NotFoundException } from '@nestjs/common';

import { AdminTenantService } from './admin-tenant.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

describe('AdminTenantService', () => {
  const tenantId = '00000000-0000-4000-a000-000000000002';

  const staffPrincipal: AuthenticatedPrincipal = {
    subject: 'staff-1',
    tenantId,
    tenantCode: 'KMC',
    roles: ['municipality_admin'],
    expiresAt: new Date(Date.now() + 60_000),
  };

  function mockPrisma(overrides: {
    tenantService?: {
      findMany?: jest.Mock;
      findFirst?: jest.Mock;
      update?: jest.Mock;
    };
    application?: { count?: jest.Mock };
    grievance?: { count?: jest.Mock };
    citizen?: { count?: jest.Mock };
    payment?: { count?: jest.Mock };
  }) {
    const applicationCount = overrides.application?.count ?? jest.fn().mockResolvedValue(0);
    const grievanceCount = overrides.grievance?.count ?? jest.fn().mockResolvedValue(0);
    const citizenCount = overrides.citizen?.count ?? jest.fn().mockResolvedValue(0);
    const paymentCount = overrides.payment?.count ?? jest.fn().mockResolvedValue(0);

    return {
      application: { count: applicationCount },
      grievance: { count: grievanceCount },
      citizen: { count: citizenCount },
      payment: { count: paymentCount },
      tenantService: {
        findMany: overrides.tenantService?.findMany ?? jest.fn(),
        findFirst: overrides.tenantService?.findFirst ?? jest.fn(),
        update: overrides.tenantService?.update ?? jest.fn(),
      },
    } as unknown as import('../../common/database/prisma.service').PrismaService;
  }

  it('getDashboard aggregates tenant-scoped counts', async () => {
    const prisma = mockPrisma({
      application: { count: jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(4) },
      grievance: { count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1) },
      citizen: { count: jest.fn().mockResolvedValue(88) },
      payment: { count: jest.fn().mockResolvedValue(5) },
    });

    const service = new AdminTenantService(prisma);
    const dash = await service.getDashboard(staffPrincipal);

    expect(dash.tenant_id).toBe(tenantId);
    expect(dash.applications_total).toBe(10);
    expect(dash.applications_open).toBe(4);
    expect(dash.grievances_open).toBe(3);
    expect(dash.grievances_sla_breached_open).toBe(1);
    expect(dash.citizens_registered).toBe(88);
    expect(dash.payments_settled_last_30_days).toBe(5);
  });

  it('patchService merges multilingual name shallowly', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'svc-1',
      code: 'birth-cert',
      name: { en: 'Birth', bn: 'জন্ম' },
      description: {},
      isActive: true,
      effectiveSlaDays: 7,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const update = jest.fn().mockResolvedValue({
      id: 'svc-1',
      code: 'birth-cert',
      name: { en: 'Birth certificate', bn: 'জন্ম' },
      description: {},
      isActive: false,
      effectiveSlaDays: 14,
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    const prisma = mockPrisma({
      tenantService: { findFirst, update },
    });

    const service = new AdminTenantService(prisma);
    const row = await service.patchService(staffPrincipal, 'svc-1', {
      is_active: false,
      name: { en: 'Birth certificate' },
      effective_sla_days: 14,
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'svc-1', tenantId },
      select: expect.any(Object),
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'svc-1' },
      data: {
        isActive: false,
        name: { en: 'Birth certificate', bn: 'জন্ম' },
        effectiveSlaDays: 14,
      },
      select: expect.any(Object),
    });
    expect(row.is_active).toBe(false);
    expect(row.effective_sla_days).toBe(14);
  });

  it('patchService throws when row missing', async () => {
    const prisma = mockPrisma({
      tenantService: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });
    const service = new AdminTenantService(prisma);
    await expect(
      service.patchService(staffPrincipal, 'missing', { is_active: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
