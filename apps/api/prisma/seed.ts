/**
 * Idempotently seeds `tenants` + `tenant_config` from `tenant.seed.ts` (matches JWT / demo UUIDs).
 * Run: `pnpm db:seed` from repo root, or `pnpm exec prisma db seed` in apps/api.
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { Prisma, PrismaClient } from '../src/generated/prisma';
import {
  globalServices,
  resolveEffectiveServices,
  revenueHeads,
  serviceCategories,
  tenantServiceOverrides,
} from '../src/modules/services/service-catalogue.seed';
import { CITIZEN_PORTAL_TENANT_CODE, tenantSeeds } from '../src/modules/tenants/tenant.seed';

const defaultDatabaseUrl =
  'postgresql://enagar:enagar_dev_pw_change_me@localhost:5432/enagarseba?schema=public';

async function seedGrievancePoliciesForTenant(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  const slaN = await prisma.slaPolicy.count({ where: { tenantId } });
  if (slaN === 0) {
    await prisma.slaPolicy.createMany({
      data: [
        {
          tenantId,
          sortOrder: 0,
          categoryMatch: 'roads',
          grievancePriorityMatch: null,
          hoursToResolve: 48,
        },
        {
          tenantId,
          sortOrder: 1,
          categoryMatch: null,
          grievancePriorityMatch: 'urgent',
          hoursToResolve: 24,
        },
        {
          tenantId,
          sortOrder: 100,
          categoryMatch: null,
          grievancePriorityMatch: null,
          hoursToResolve: 72,
        },
      ],
    });
  }

  const rN = await prisma.grievanceRoutingRule.count({ where: { tenantId } });
  if (rN === 0) {
    await prisma.grievanceRoutingRule.createMany({
      data: [
        {
          tenantId,
          sortOrder: 0,
          categoryMatch: 'roads',
          grievancePriorityMatch: null,
          targetRoleCode: 'municipality_clerk',
        },
        {
          tenantId,
          sortOrder: 100,
          categoryMatch: null,
          grievancePriorityMatch: null,
          targetRoleCode: 'municipality_clerk',
        },
      ],
    });
  }
}

async function seedServiceCatalogue(prisma: PrismaClient): Promise<void> {
  const categoryIds = new Map<string, string>();
  for (const category of serviceCategories) {
    const row = await prisma.serviceCategory.upsert({
      where: { code: category.code },
      create: {
        code: category.code,
        name: category.name,
        description: category.description,
        sortOrder: category.sort_order,
      },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sort_order,
        isActive: true,
      },
    });
    categoryIds.set(category.code, row.id);
  }

  const revenueHeadIds = new Map<string, string>();
  for (const revenueHead of revenueHeads) {
    const row = await prisma.revenueHead.upsert({
      where: { code: revenueHead.code },
      create: {
        code: revenueHead.code,
        name: revenueHead.name,
        accountingCode: revenueHead.accounting_code,
      },
      update: {
        name: revenueHead.name,
        accountingCode: revenueHead.accounting_code,
        isActive: true,
      },
    });
    revenueHeadIds.set(revenueHead.code, row.id);
  }

  const globalServiceIds = new Map<string, string>();
  for (const service of globalServices) {
    const categoryId = categoryIds.get(service.category_code);
    if (!categoryId) {
      throw new Error(`Missing service category seed "${service.category_code}"`);
    }
    const revenueHeadId = service.revenue_head_code
      ? revenueHeadIds.get(service.revenue_head_code)
      : null;
    if (service.revenue_head_code && !revenueHeadId) {
      throw new Error(`Missing revenue head seed "${service.revenue_head_code}"`);
    }

    const row = await prisma.globalService.upsert({
      where: { code: service.code },
      create: {
        code: service.code,
        categoryId,
        revenueHeadId,
        name: service.name,
        description: service.description,
        workflowPattern: service.workflow_pattern,
        defaultSlaDays: service.default_sla_days,
        feeType: service.fee_type,
        feeConfig: service.fee_config as Prisma.InputJsonValue,
        requiredDocuments: service.required_documents as Prisma.InputJsonValue,
        pushesToDigilocker: service.pushes_to_digilocker,
        isActive: true,
      },
      update: {
        categoryId,
        revenueHeadId,
        name: service.name,
        description: service.description,
        workflowPattern: service.workflow_pattern,
        defaultSlaDays: service.default_sla_days,
        feeType: service.fee_type,
        feeConfig: service.fee_config as Prisma.InputJsonValue,
        requiredDocuments: service.required_documents as Prisma.InputJsonValue,
        pushesToDigilocker: service.pushes_to_digilocker,
        isActive: true,
      },
    });
    globalServiceIds.set(service.code, row.id);
  }

  const overrideByTenantService = new Map(
    tenantServiceOverrides.map((override) => [
      `${override.tenant_code}:${override.service_code}`,
      override,
    ]),
  );
  const tenants = await prisma.tenant.findMany({
    where: { code: { not: CITIZEN_PORTAL_TENANT_CODE }, isActive: true },
    select: { id: true, code: true },
  });

  for (const tenant of tenants) {
    for (const service of resolveEffectiveServices(tenant.code)) {
      const categoryId = categoryIds.get(service.category_code);
      if (!categoryId) {
        throw new Error(`Missing service category seed "${service.category_code}"`);
      }
      const revenueHeadId = service.revenue_head_code
        ? revenueHeadIds.get(service.revenue_head_code)
        : null;
      if (service.revenue_head_code && !revenueHeadId) {
        throw new Error(`Missing revenue head seed "${service.revenue_head_code}"`);
      }

      const override = overrideByTenantService.get(`${tenant.code}:${service.code}`);
      const data = {
        globalServiceId: globalServiceIds.get(service.code) ?? null,
        categoryId,
        revenueHeadId: revenueHeadId ?? null,
        name: service.name,
        description: service.description,
        isActive: service.active,
        overrideConfig: { source: service.source } as Prisma.InputJsonValue,
        effectiveFeeConfig: service.fee_config as Prisma.InputJsonValue,
        effectiveSlaDays: service.sla_days,
        requiredDocuments: service.required_documents as Prisma.InputJsonValue,
        formSchemaAdditions: (override?.form_schema_additions ?? {}) as Prisma.InputJsonValue,
        workflowOverrides: (override?.workflow_overrides ?? {}) as Prisma.InputJsonValue,
      };

      await prisma.tenantService.upsert({
        where: { tenantId_code: { tenantId: tenant.id, code: service.code } },
        create: {
          tenantId: tenant.id,
          code: service.code,
          ...data,
        },
        update: data,
      });
    }
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL ?? defaultDatabaseUrl;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    for (const seed of tenantSeeds) {
      const tenant = await prisma.tenant.upsert({
        where: { code: seed.code },
        create: {
          id: seed.id,
          code: seed.code,
          name: seed.name,
          district: seed.district,
          wardCount: seed.ward_count,
          themeColor: seed.theme_color,
          logoUrl: seed.logo_url,
          languagesEnabled: seed.languages_enabled,
          isActive: seed.is_active,
        },
        update: {
          name: seed.name,
          district: seed.district,
          wardCount: seed.ward_count,
          themeColor: seed.theme_color,
          logoUrl: seed.logo_url,
          languagesEnabled: seed.languages_enabled,
          isActive: seed.is_active,
        },
      });

      await prisma.tenantConfig.upsert({
        where: { tenantId: tenant.id },
        create: { tenantId: tenant.id },
        update: {},
      });

      /** Portal is not an operational grievance jurisdiction; SLA/routing stays on ULBs only. */
      if (tenant.code !== CITIZEN_PORTAL_TENANT_CODE) {
        await seedGrievancePoliciesForTenant(prisma, tenant.id);
      }

      console.info(`Seeded tenant ${tenant.code} (${tenant.id})`);
    }
    await seedServiceCatalogue(prisma);
    console.info('Seeded service catalogue for operational tenants');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
