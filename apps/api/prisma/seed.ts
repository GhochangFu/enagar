/**
 * Idempotently seeds `tenants` + `tenant_config` from `tenant.seed.ts` (matches JWT / demo UUIDs).
 * Run: `pnpm db:seed` from repo root, or `pnpm exec prisma db seed` in apps/api.
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma';
import { tenantSeeds } from '../src/modules/tenants/tenant.seed';

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

      await seedGrievancePoliciesForTenant(prisma, tenant.id);

      console.info(`Seeded tenant ${tenant.code} (${tenant.id})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
