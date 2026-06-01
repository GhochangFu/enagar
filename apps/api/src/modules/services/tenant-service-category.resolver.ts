import {
  defaultDepartmentCodeForGlobalCategory,
  tenantServiceCategoryCodeForGlobal,
  toGlobalNavigationCategoryCode,
} from './tenant-service-category.util';

import type { Prisma, PrismaClient } from '../../generated/prisma';

const NAV_TO_SEED_CATEGORY: Record<string, string> = {
  cert: 'certificates',
  tax: 'tax-property',
  water: 'water-sanitation',
  building: 'building-plan',
  health: 'health',
  adv: 'advertising',
  rent: 'bookings',
  smart: 'parking-transport',
  tender: 'tenders',
  fines: 'fines-challans',
  info: 'rti',
  misc: 'grievances',
  welfare: 'welfare',
};

/** Citizen catalogue seed code (e.g. `certificates`) from nav or tenant category code. */
export function seedCategoryCodeFromNavigation(navOrSeedCode: string): string {
  const normalized = navOrSeedCode.trim().toLowerCase();
  if (NAV_TO_SEED_CATEGORY[normalized]) {
    return NAV_TO_SEED_CATEGORY[normalized];
  }
  const nav = toGlobalNavigationCategoryCode(normalized);
  return NAV_TO_SEED_CATEGORY[nav] ?? normalized;
}

export async function ensureTenantServiceCategory(
  prisma: PrismaClient,
  tenantId: string,
  seedCategoryCode: string,
  categoryName?: Prisma.InputJsonValue,
): Promise<{ categoryId: string; departmentId: string; globalCategoryCode: string }> {
  const globalCategoryCode = toGlobalNavigationCategoryCode(seedCategoryCode);
  const deptCode = defaultDepartmentCodeForGlobalCategory(globalCategoryCode);
  const tscCode = tenantServiceCategoryCodeForGlobal(seedCategoryCode);

  const department = await prisma.tenantDepartment.upsert({
    where: { tenantId_code: { tenantId, code: deptCode } },
    create: {
      tenantId,
      code: deptCode,
      name: {
        en: deptCode.replace(/-/g, ' '),
        bn: deptCode,
        hi: deptCode,
      },
      sortOrder: 500,
      isActive: true,
    },
    update: { isActive: true },
  });

  const name =
    categoryName ??
    ({
      en: globalCategoryCode,
      bn: globalCategoryCode,
      hi: globalCategoryCode,
    } as Prisma.InputJsonValue);

  const category = await prisma.tenantServiceCategory.upsert({
    where: {
      tenantId_departmentId_code: {
        tenantId,
        departmentId: department.id,
        code: tscCode,
      },
    },
    create: {
      tenantId,
      departmentId: department.id,
      code: tscCode,
      name,
      sortOrder: 100,
      isActive: true,
    },
    update: { name, isActive: true },
  });

  return {
    categoryId: category.id,
    departmentId: department.id,
    globalCategoryCode,
  };
}

/** Link a service category to an explicit tenant department (reassign / override default). */
export async function ensureTenantServiceCategoryOnDepartment(
  prisma: PrismaClient,
  tenantId: string,
  departmentId: string,
  globalCategoryCode: string,
  categoryName?: Prisma.InputJsonValue,
): Promise<{ categoryId: string; departmentId: string }> {
  const tscCode = globalCategoryCode.trim().toLowerCase();
  const name =
    categoryName ??
    ({
      en: tscCode,
      bn: tscCode,
      hi: tscCode,
    } as Prisma.InputJsonValue);

  const category = await prisma.tenantServiceCategory.upsert({
    where: {
      tenantId_departmentId_code: {
        tenantId,
        departmentId,
        code: tscCode,
      },
    },
    create: {
      tenantId,
      departmentId,
      code: tscCode,
      name,
      sortOrder: 100,
      isActive: true,
    },
    update: { name, isActive: true },
  });

  return { categoryId: category.id, departmentId };
}
