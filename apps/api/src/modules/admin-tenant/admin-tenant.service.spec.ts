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
    tenant?: {
      findUnique?: jest.Mock;
      update?: jest.Mock;
    };
    tenantConfig?: {
      create?: jest.Mock;
      upsert?: jest.Mock;
    };
    notificationTemplate?: {
      findMany?: jest.Mock;
      upsert?: jest.Mock;
    };
    kbArticle?: {
      findMany?: jest.Mock;
      upsert?: jest.Mock;
    };
    role?: {
      findMany?: jest.Mock;
      findUnique?: jest.Mock;
    };
    user?: {
      findMany?: jest.Mock;
      findUnique?: jest.Mock;
      findUniqueOrThrow?: jest.Mock;
      create?: jest.Mock;
      update?: jest.Mock;
    };
    userRole?: {
      deleteMany?: jest.Mock;
      create?: jest.Mock;
    };
    roleStageMap?: {
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
      tenant: {
        findUnique: overrides.tenant?.findUnique ?? jest.fn(),
        update: overrides.tenant?.update ?? jest.fn(),
      },
      tenantConfig: {
        create: overrides.tenantConfig?.create ?? jest.fn(),
        upsert: overrides.tenantConfig?.upsert ?? jest.fn(),
      },
      notificationTemplate: {
        findMany: overrides.notificationTemplate?.findMany ?? jest.fn(),
        upsert: overrides.notificationTemplate?.upsert ?? jest.fn(),
      },
      kbArticle: {
        findMany: overrides.kbArticle?.findMany ?? jest.fn(),
        upsert: overrides.kbArticle?.upsert ?? jest.fn(),
      },
      role: {
        findMany: overrides.role?.findMany ?? jest.fn(),
        findUnique: overrides.role?.findUnique ?? jest.fn(),
      },
      user: {
        findMany: overrides.user?.findMany ?? jest.fn(),
        findUnique: overrides.user?.findUnique ?? jest.fn(),
        findUniqueOrThrow: overrides.user?.findUniqueOrThrow ?? jest.fn(),
        create: overrides.user?.create ?? jest.fn(),
        update: overrides.user?.update ?? jest.fn(),
      },
      userRole: {
        deleteMany: overrides.userRole?.deleteMany ?? jest.fn(),
        create: overrides.userRole?.create ?? jest.fn(),
      },
      roleStageMap: {
        findMany: overrides.roleStageMap?.findMany ?? jest.fn(),
        upsert: overrides.roleStageMap?.upsert ?? jest.fn(),
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
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          user: {
            create: overrides.user?.create ?? jest.fn(),
            update: overrides.user?.update ?? jest.fn(),
            findUniqueOrThrow: overrides.user?.findUniqueOrThrow ?? jest.fn(),
          },
          userRole: {
            deleteMany: overrides.userRole?.deleteMany ?? jest.fn(),
            create: overrides.userRole?.create ?? jest.fn(),
          },
        }),
      ),
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

  it('patchSettings validates branding and feature flags', async () => {
    const prisma = mockPrisma({
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: tenantId,
          code: 'KMC',
          languagesEnabled: ['en', 'bn', 'hi'],
          tenantConfig: {
            branding: {},
            featureFlags: {},
            defaultLanguage: 'en',
            contactPhone: null,
            contactEmail: null,
          },
        }),
        update: jest.fn().mockResolvedValue({
          id: tenantId,
          code: 'KMC',
          languagesEnabled: ['en', 'bn'],
        }),
      },
      tenantConfig: {
        upsert: jest.fn().mockResolvedValue({
          branding: { theme_color: '#0f766e' },
          featureFlags: { kb_cms: true },
          defaultLanguage: 'en',
          contactPhone: null,
          contactEmail: null,
        }),
      },
    });
    const service = new AdminTenantService(prisma);
    const row = await service.patchSettings(staffPrincipal, {
      branding: { theme_color: '#0f766e' },
      feature_flags: { kb_cms: true },
      languages_enabled: ['en', 'bn'],
      default_language: 'en',
    });

    expect(row.languages_enabled).toEqual(['en', 'bn']);
    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: tenantId },
      }),
    );
  });

  it('rejects notification template placeholders that are not declared', async () => {
    const prisma = mockPrisma({
      notificationTemplate: { upsert: jest.fn() },
    });
    const service = new AdminTenantService(prisma);

    await expect(
      service.upsertNotificationTemplate(staffPrincipal, {
        code: 'application-submitted',
        channel: 'sms',
        locale: 'en',
        trigger: 'application-submitted',
        body: 'Application {{docket_no}} for {{missing_value}}',
        variables: ['docket_no'],
      }),
    ).rejects.toThrow('missing_value');
  });

  it('upserts KB articles with tenant scope and publish timestamp', async () => {
    const upsert = jest.fn().mockResolvedValue({
      id: 'kb-1',
      slug: 'birth-certificate-help',
      title: { en: 'Birth certificate help' },
      body: { en: 'Markdown body' },
      tags: ['birth'],
      status: 'published',
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const prisma = mockPrisma({ kbArticle: { upsert } });
    const service = new AdminTenantService(prisma);
    const row = await service.upsertKbArticle(staffPrincipal, {
      slug: 'birth-certificate-help',
      title: { en: 'Birth certificate help' },
      body: { en: 'Markdown body' },
      tags: ['birth'],
      status: 'published',
    });

    expect(row.status).toBe('published');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_slug: { tenantId, slug: 'birth-certificate-help' } },
      }),
    );
  });

  it('upserts staff and replaces role assignments in the principal tenant', async () => {
    const createdUser = {
      id: 'user-1',
      tenantId,
      keycloakUserId: '10000000-0000-4000-8000-000000000201',
      username: 'kmc-clerk',
      displayName: 'KMC Clerk',
      email: null,
      mobile: null,
      status: 'active',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      userRoles: [{ role: { code: 'tenant_clerk', name: 'Tenant Clerk' }, ward: null }],
    };
    const prisma = mockPrisma({
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(createdUser),
        findUniqueOrThrow: jest.fn().mockResolvedValue(createdUser),
      },
      role: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'role-1', code: 'tenant_clerk', name: 'Tenant Clerk' }]),
      },
      userRole: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'user-role-1' }),
      },
    });
    const service = new AdminTenantService(prisma);
    const row = await service.upsertStaff(staffPrincipal, {
      keycloak_user_id: '10000000-0000-4000-8000-000000000201',
      username: 'kmc-clerk',
      display_name: 'KMC Clerk',
      status: 'active',
      role_codes: ['tenant_clerk'],
    });

    expect(row.roles).toEqual([{ code: 'tenant_clerk', name: 'Tenant Clerk', ward_number: null }]);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { keycloakUserId: '10000000-0000-4000-8000-000000000201' },
    });
  });
});
