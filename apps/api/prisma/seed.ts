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

const addressMasterSeeds = [
  {
    tenant_code: 'KMC',
    borough_code: 'borough-vii',
    borough_name: 'Borough VII',
    ward_number: '64',
    ward_name: 'Ward 64',
    mouza: 'Kasba',
    locality_name: 'Ballygunge Place',
    pincode: '700019',
  },
  {
    tenant_code: 'KMC',
    borough_code: 'borough-xii',
    borough_name: 'Borough XII',
    ward_number: '101',
    ward_name: 'Ward 101',
    mouza: 'Behala',
    locality_name: 'Behala Chowrasta',
    pincode: '700034',
  },
  {
    tenant_code: 'HMC',
    borough_code: 'borough-i',
    borough_name: 'Borough I',
    ward_number: '12',
    ward_name: 'Ward 12',
    mouza: 'Shibpur',
    locality_name: 'Shibpur Road',
    pincode: '711102',
  },
];

const tariffSeeds = [
  {
    tenant_code: 'KMC',
    code: 'property-residential-v1',
    category: 'property',
    name: {
      en: 'Residential Property Tax',
      bn: 'Residential Property Tax',
      hi: 'Residential Property Tax',
    },
    rate_config: {
      type: 'computed',
      input_key: 'built_up_area_sqft',
      base_amount_paise: 5000,
      unit_amount_paise: 125,
    },
  },
  {
    tenant_code: 'KMC',
    code: 'water-domestic-v1',
    category: 'water',
    name: { en: 'Domestic Water Tariff', bn: 'Domestic Water Tariff', hi: 'Domestic Water Tariff' },
    rate_config: {
      type: 'slab',
      input_key: 'monthly_kl',
      slabs: [
        { upto: 10, amount_paise: 0 },
        { upto: 25, amount_paise: 2500 },
        { upto: null, amount_paise: 6000 },
      ],
    },
  },
  {
    tenant_code: 'HMC',
    code: 'conservancy-commercial-v1',
    category: 'conservancy',
    name: {
      en: 'Commercial Conservancy Tariff',
      bn: 'Commercial Conservancy Tariff',
      hi: 'Commercial Conservancy Tariff',
    },
    rate_config: { type: 'fixed', amount_paise: 15000, currency: 'INR' },
  },
];

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

async function seedAddressAndTariffMasters(prisma: PrismaClient): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { code: { in: ['KMC', 'HMC'] } },
    select: { id: true, code: true },
  });
  const tenantByCode = new Map(tenants.map((tenant) => [tenant.code, tenant]));

  for (const seed of addressMasterSeeds) {
    const tenant = tenantByCode.get(seed.tenant_code);
    if (!tenant) {
      continue;
    }
    const borough = await prisma.borough.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: seed.borough_code } },
      create: {
        tenantId: tenant.id,
        code: seed.borough_code,
        name: seed.borough_name,
      },
      update: {
        name: seed.borough_name,
      },
    });
    const ward = await prisma.ward.upsert({
      where: { tenantId_number: { tenantId: tenant.id, number: seed.ward_number } },
      create: {
        tenantId: tenant.id,
        boroughId: borough.id,
        number: seed.ward_number,
        name: seed.ward_name,
      },
      update: {
        boroughId: borough.id,
        name: seed.ward_name,
      },
    });
    await prisma.locality.upsert({
      where: {
        tenantId_name_pincode: {
          tenantId: tenant.id,
          name: seed.locality_name,
          pincode: seed.pincode,
        },
      },
      create: {
        tenantId: tenant.id,
        wardId: ward.id,
        mouza: seed.mouza,
        name: seed.locality_name,
        pincode: seed.pincode,
      },
      update: {
        wardId: ward.id,
        mouza: seed.mouza,
      },
    });
  }

  for (const seed of tariffSeeds) {
    const tenant = tenantByCode.get(seed.tenant_code);
    if (!tenant) {
      continue;
    }
    await prisma.tenantTariff.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: seed.code } },
      create: {
        tenantId: tenant.id,
        code: seed.code,
        category: seed.category,
        name: seed.name,
        rateConfig: seed.rate_config as Prisma.InputJsonValue,
      },
      update: {
        category: seed.category,
        name: seed.name,
        rateConfig: seed.rate_config as Prisma.InputJsonValue,
        isActive: true,
      },
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
    await seedAddressAndTariffMasters(prisma);
    console.info('Seeded address and tariff masters for smoke tenants');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
