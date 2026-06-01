import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../common/database/prisma.service';

import { AdminTenantOrgService } from './admin-tenant-org.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

const principal: AuthenticatedPrincipal = {
  subject: 'admin-subject',
  tenantId: 'tenant-1',
  tenantCode: 'KMC',
  roles: ['tenant_admin'],
  expiresAt: new Date(Date.now() + 60_000),
};

describe('AdminTenantOrgService', () => {
  let service: AdminTenantOrgService;
  let prisma: {
    tenantDepartment: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    tenantDesignation: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    user: { findFirst: jest.Mock };
    userDesignation: { findMany: jest.Mock; deleteMany: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      tenantDepartment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenantDesignation: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: { findFirst: jest.fn() },
      userDesignation: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AdminTenantOrgService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AdminTenantOrgService);
  });

  it('rejects municipality designation with department_id', async () => {
    await expect(
      service.createDesignation(principal, {
        code: 'executive_officer',
        name: { en: 'Executive Officer' },
        scope: 'municipality',
        department_id: 'dept-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects department designation without department_id', async () => {
    await expect(
      service.createDesignation(principal, {
        code: 'pwd_clerk',
        name: { en: 'Clerk' },
        scope: 'department',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates department with kebab-case code', async () => {
    prisma.tenantDepartment.create.mockResolvedValue({
      id: 'd1',
      code: 'public-works',
      name: { en: 'PWD' },
      sortOrder: 10,
      isActive: true,
      _count: { designations: 0 },
    });

    const row = await service.createDepartment(principal, {
      code: 'public-works',
      name: { en: 'Public Works Department' },
      sort_order: 10,
    });

    expect(row.code).toBe('public-works');
    expect(prisma.tenantDepartment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1', code: 'public-works' }),
      }),
    );
  });

  it('replaceUserDesignations validates designation ids', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    prisma.tenantDesignation.findMany.mockResolvedValue([]);

    await expect(
      service.replaceUserDesignations(principal, 'user-1', {
        designation_ids: ['missing-id'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when staff user not found', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.listUserDesignations(principal, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
