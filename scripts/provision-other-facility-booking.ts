/**
 * Provisions KMC "other-facility-booking" and remaps bookable assets (runtime, no full reseed).
 * Run: pnpm --filter @enagar/api exec tsx ../../scripts/provision-other-facility-booking.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient, type Prisma } from '../apps/api/src/generated/prisma';
import {
  globalServices,
  tenantServiceOverrides,
} from '../apps/api/src/modules/services/service-catalogue.seed';
import { ensureTenantServiceCategoryOnDepartment } from '../apps/api/src/modules/services/tenant-service-category.resolver';

const SERVICE_CODE = 'other-facility-booking';
const HALL_CODES = ['community-hall-main', 'rabindra-bhawan'] as const;
const SPORTS_CODES = ['kmc-multipurpose-ground', 'kmc-tennis-court-a'] as const;

function defaultDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    'postgresql://enagar:enagar_dev_pw_change_me@localhost:5432/enagarseba?schema=public'
  );
}

function mergeOverrideConfig(
  base: Prisma.JsonValue | null,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue {
  const existing =
    typeof base === 'object' && base !== null && !Array.isArray(base)
      ? (base as Record<string, unknown>)
      : {};
  return { ...existing, ...patch } as Prisma.InputJsonValue;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: defaultDatabaseUrl() }),
  });

  try {
    const kmc = await prisma.tenant.findUnique({ where: { code: 'KMC' } });
    if (!kmc) {
      throw new Error('KMC tenant not found — run prisma seed first');
    }

    const generalDept = await prisma.tenantDepartment.findFirst({
      where: { tenantId: kmc.id, code: 'general', isActive: true },
    });
    if (!generalDept) {
      throw new Error('general department not found for KMC');
    }

    const globalSeed = globalServices.find((row) => row.code === SERVICE_CODE);
    if (!globalSeed) {
      throw new Error(`Missing global service seed for ${SERVICE_CODE}`);
    }

    const bookingsCategory = await prisma.serviceCategory.findUnique({
      where: { code: globalSeed.category_code },
    });
    if (!bookingsCategory) {
      throw new Error(`Category ${globalSeed.category_code} not found`);
    }

    const revenueHead = globalSeed.revenue_head_code
      ? await prisma.revenueHead.findUnique({ where: { code: globalSeed.revenue_head_code } })
      : null;

    const globalService = await prisma.globalService.upsert({
      where: { code: SERVICE_CODE },
      create: {
        code: SERVICE_CODE,
        categoryId: bookingsCategory.id,
        revenueHeadId: revenueHead?.id ?? null,
        name: globalSeed.name as Prisma.InputJsonValue,
        description: globalSeed.description as Prisma.InputJsonValue,
        workflowPattern: globalSeed.workflow_pattern,
        defaultSlaDays: globalSeed.default_sla_days,
        feeType: globalSeed.fee_type,
        feeConfig: globalSeed.fee_config as Prisma.InputJsonValue,
        requiredDocuments: globalSeed.required_documents as Prisma.InputJsonValue,
        formSchema: {} as Prisma.InputJsonValue,
        pushesToDigilocker: globalSeed.pushes_to_digilocker,
        isActive: true,
      },
      update: {
        workflowPattern: globalSeed.workflow_pattern,
        name: globalSeed.name as Prisma.InputJsonValue,
        description: globalSeed.description as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    const categoryOnGeneral = await ensureTenantServiceCategoryOnDepartment(
      prisma,
      kmc.id,
      generalDept.id,
      'rent',
      { en: 'Bookings', bn: 'বুকিং', hi: 'बुकिंग' },
    );

    const override = tenantServiceOverrides.find(
      (row) => row.tenant_code === 'KMC' && row.service_code === SERVICE_CODE,
    );

    const otherService = await prisma.tenantService.upsert({
      where: { tenantId_code: { tenantId: kmc.id, code: SERVICE_CODE } },
      create: {
        tenantId: kmc.id,
        globalServiceId: globalService.id,
        code: SERVICE_CODE,
        categoryId: categoryOnGeneral.categoryId,
        departmentId: generalDept.id,
        globalCategoryCode: 'rent',
        revenueHeadId: revenueHead?.id ?? null,
        name: globalSeed.name as Prisma.InputJsonValue,
        description: globalSeed.description as Prisma.InputJsonValue,
        isActive: true,
        overrideConfig: mergeOverrideConfig(null, {
          source: 'tenant_override',
          payment_schedule: globalSeed.payment_schedule,
          fee_lines: globalSeed.fee_lines,
          bookable_asset_codes: [...SPORTS_CODES],
          ...(override?.override_config ?? {}),
        }),
        effectiveFeeConfig: {
          type: globalSeed.fee_type,
          ...globalSeed.fee_config,
        } as Prisma.InputJsonValue,
        effectiveSlaDays: globalSeed.default_sla_days,
        requiredDocuments: globalSeed.required_documents as Prisma.InputJsonValue,
      },
      update: {
        globalServiceId: globalService.id,
        categoryId: categoryOnGeneral.categoryId,
        departmentId: generalDept.id,
        isActive: true,
        name: globalSeed.name as Prisma.InputJsonValue,
        description: globalSeed.description as Prisma.InputJsonValue,
        overrideConfig: mergeOverrideConfig(null, {
          source: 'tenant_override',
          payment_schedule: globalSeed.payment_schedule,
          fee_lines: globalSeed.fee_lines,
          bookable_asset_codes: [...SPORTS_CODES],
        }),
      },
    });

    const hallService = await prisma.tenantService.findFirst({
      where: { tenantId: kmc.id, code: 'community-hall' },
      select: { id: true, overrideConfig: true },
    });
    if (hallService) {
      await prisma.tenantService.update({
        where: { id: hallService.id },
        data: {
          overrideConfig: mergeOverrideConfig(hallService.overrideConfig, {
            bookable_asset_codes: [...HALL_CODES],
          }),
        },
      });
    }

    const hallRef = await prisma.tenantService.findFirst({
      where: { tenantId: kmc.id, code: 'community-hall' },
      include: {
        formVersions: { where: { status: 'published' }, orderBy: { version: 'desc' }, take: 1 },
      },
    });

    const publishedForm = hallRef?.formVersions[0];
    if (publishedForm) {
      const formSchema = JSON.parse(JSON.stringify(publishedForm.formSchema)) as Record<
        string,
        unknown
      >;
      formSchema.service_code = SERVICE_CODE;
      await prisma.serviceFormVersion.upsert({
        where: {
          tenantId_serviceId_version: {
            tenantId: kmc.id,
            serviceId: otherService.id,
            version: 1,
          },
        },
        create: {
          tenantId: kmc.id,
          serviceId: otherService.id,
          version: 1,
          formSchema: formSchema as Prisma.InputJsonValue,
          uiSchema: publishedForm.uiSchema as Prisma.InputJsonValue,
          status: 'published',
          publishedAt: new Date(),
        },
        update: {
          formSchema: formSchema as Prisma.InputJsonValue,
          uiSchema: publishedForm.uiSchema as Prisma.InputJsonValue,
          status: 'published',
          publishedAt: new Date(),
        },
      });
    }

    console.info(JSON.stringify({ service_id: otherService.id, service_code: SERVICE_CODE }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
