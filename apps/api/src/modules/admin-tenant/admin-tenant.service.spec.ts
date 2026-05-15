import { createBlankFormSchemaDraft } from '@enagar/forms';
import { createLinearWorkflowDraft } from '@enagar/workflow';
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
    revenueHead?: {
      findMany?: jest.Mock;
      findUnique?: jest.Mock;
      upsert?: jest.Mock;
    };
    borough?: { upsert?: jest.Mock };
    ward?: { upsert?: jest.Mock };
    locality?: {
      findMany?: jest.Mock;
      upsert?: jest.Mock;
    };
    tenantTariff?: {
      findMany?: jest.Mock;
      upsert?: jest.Mock;
    };
    serviceFormVersion?: {
      aggregate?: jest.Mock;
      create?: jest.Mock;
      findFirst?: jest.Mock;
      update?: jest.Mock;
    };
    workflow?: {
      aggregate?: jest.Mock;
      findFirst?: jest.Mock;
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
      revenueHead: {
        findMany: overrides.revenueHead?.findMany ?? jest.fn(),
        findUnique: overrides.revenueHead?.findUnique ?? jest.fn(),
        upsert: overrides.revenueHead?.upsert ?? jest.fn(),
      },
      borough: { upsert: overrides.borough?.upsert ?? jest.fn() },
      ward: { upsert: overrides.ward?.upsert ?? jest.fn() },
      locality: {
        findMany: overrides.locality?.findMany ?? jest.fn(),
        upsert: overrides.locality?.upsert ?? jest.fn(),
      },
      tenantTariff: {
        findMany: overrides.tenantTariff?.findMany ?? jest.fn(),
        upsert: overrides.tenantTariff?.upsert ?? jest.fn(),
      },
      serviceFormVersion: {
        aggregate: overrides.serviceFormVersion?.aggregate ?? jest.fn(),
        create: overrides.serviceFormVersion?.create ?? jest.fn(),
        findFirst: overrides.serviceFormVersion?.findFirst ?? jest.fn(),
        update: overrides.serviceFormVersion?.update ?? jest.fn(),
      },
      workflow: {
        aggregate: overrides.workflow?.aggregate ?? jest.fn(),
        findFirst: overrides.workflow?.findFirst ?? jest.fn(),
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

  it('getServiceDesigner returns starter form and workflow when no drafts exist', async () => {
    const prisma = mockPrisma({
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'svc-1',
          code: 'pet-licence',
          name: { en: 'Pet Licence', bn: 'Pet Licence', hi: 'Pet Licence' },
          description: {},
          isActive: true,
          effectiveSlaDays: 7,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      },
      serviceFormVersion: { findFirst: jest.fn().mockResolvedValue(null) },
      workflow: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const service = new AdminTenantService(prisma);
    const designer = await service.getServiceDesigner(staffPrincipal, 'svc-1');

    expect(designer.starter_form_schema.service_code).toBe('pet-licence');
    expect(designer.starter_workflow.code).toBe('pet-licence-workflow-v1');
  });

  it('saveFormDraft validates service_code before persistence', async () => {
    const prisma = mockPrisma({
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'svc-1',
          code: 'birth-cert',
          name: { en: 'Birth Certificate' },
          description: {},
          isActive: true,
          effectiveSlaDays: 7,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      },
    });
    const service = new AdminTenantService(prisma);

    await expect(
      service.saveFormDraft(staffPrincipal, 'svc-1', {
        form_schema: createBlankFormSchemaDraft('trade-licence'),
      }),
    ).rejects.toThrow('service_code must match');
  });

  it('saveWorkflowDraft validates service-code-prefixed workflow code', async () => {
    const prisma = mockPrisma({
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'svc-1',
          code: 'birth-cert',
          name: { en: 'Birth Certificate' },
          description: {},
          isActive: true,
          effectiveSlaDays: 7,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      },
    });
    const service = new AdminTenantService(prisma);

    await expect(
      service.saveWorkflowDraft(staffPrincipal, 'svc-1', {
        workflow: createLinearWorkflowDraft('trade-licence'),
      }),
    ).rejects.toThrow('prefixed with the service code');
  });

  it('patchServiceConfig validates and persists fee rules, documents, and revenue mapping', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'svc-1',
      code: 'birth-cert',
      name: { en: 'Birth Certificate' },
      description: {},
      isActive: true,
      effectiveSlaDays: 7,
      effectiveFeeConfig: { type: 'fixed', amount_paise: 2500, currency: 'INR' },
      requiredDocuments: [
        {
          code: 'parent-aadhaar',
          label: { en: 'Parent Aadhaar' },
          required: true,
          accept: ['application/pdf'],
          max_size_mb: 5,
        },
      ],
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      revenueHead: {
        id: 'rh-1',
        code: 'cert-fee',
        name: { en: 'Certificate Fees' },
        accountingCode: 'RH-CERT',
      },
    });
    const prisma = mockPrisma({
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1' }),
        update,
      },
      revenueHead: {
        findUnique: jest.fn().mockResolvedValue({ id: 'rh-1', isActive: true }),
      },
    });

    const service = new AdminTenantService(prisma);
    const row = await service.patchServiceConfig(staffPrincipal, 'svc-1', {
      fee_rule: { type: 'fixed', amount_paise: 2500, currency: 'INR' },
      required_documents: [
        {
          code: 'parent-aadhaar',
          label: { en: 'Parent Aadhaar' },
          required: true,
          accept: ['application/pdf'],
          max_size_mb: 5,
        },
      ],
      revenue_head_code: 'cert-fee',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          effectiveFeeConfig: { type: 'fixed', amount_paise: 2500, currency: 'INR' },
          revenueHead: { connect: { id: 'rh-1' } },
        }),
      }),
    );
    expect(row.fee_preview_paise).toBe(2500);
    expect(row.revenue_head?.code).toBe('cert-fee');
  });

  it('rejects invalid fee rules before service config persistence', async () => {
    const prisma = mockPrisma({
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1' }),
        update: jest.fn(),
      },
    });
    const service = new AdminTenantService(prisma);

    await expect(
      service.patchServiceConfig(staffPrincipal, 'svc-1', {
        fee_rule: { type: 'fixed', amount_paise: -1 },
      }),
    ).rejects.toThrow('amount_paise');
  });

  it('upserts address master rows scoped to the principal tenant', async () => {
    const prisma = mockPrisma({
      borough: { upsert: jest.fn().mockResolvedValue({ id: 'borough-1' }) },
      ward: { upsert: jest.fn().mockResolvedValue({ id: 'ward-1' }) },
      locality: {
        upsert: jest.fn().mockResolvedValue({
          id: 'loc-1',
          name: 'Ballygunge Place',
          pincode: '700019',
          mouza: 'Kasba',
          ward: {
            number: '64',
            name: 'Ward 64',
            borough: { code: 'borough-vii', name: 'Borough VII' },
          },
        }),
      },
    });
    const service = new AdminTenantService(prisma);

    const row = await service.upsertAddressMaster(staffPrincipal, {
      borough_code: 'borough-vii',
      borough_name: 'Borough VII',
      ward_number: '64',
      ward_name: 'Ward 64',
      mouza: 'Kasba',
      locality_name: 'Ballygunge Place',
      pincode: '700019',
    });

    expect(row.locality_name).toBe('Ballygunge Place');
    expect(prisma.locality.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId_name_pincode: expect.objectContaining({ tenantId }),
        }),
      }),
    );
  });

  it('upserts tariff rows with safe fee-rule validation', async () => {
    const prisma = mockPrisma({
      tenantTariff: {
        upsert: jest.fn().mockResolvedValue({
          id: 'tariff-1',
          code: 'water-domestic-v1',
          category: 'water',
          name: { en: 'Domestic Water' },
          rateConfig: {
            type: 'slab',
            input_key: 'monthly_kl',
            slabs: [
              { upto: 10, amount_paise: 0 },
              { upto: null, amount_paise: 5000 },
            ],
          },
          isActive: true,
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      },
    });
    const service = new AdminTenantService(prisma);
    const row = await service.upsertTariff(staffPrincipal, {
      code: 'water-domestic-v1',
      category: 'water',
      name: { en: 'Domestic Water' },
      rate_config: {
        type: 'slab',
        input_key: 'monthly_kl',
        slabs: [
          { upto: 10, amount_paise: 0 },
          { upto: null, amount_paise: 5000 },
        ],
      },
    });

    expect(row.preview_paise).toBe(5000);
    expect(prisma.tenantTariff.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_code: { tenantId, code: 'water-domestic-v1' } },
      }),
    );
  });
});
