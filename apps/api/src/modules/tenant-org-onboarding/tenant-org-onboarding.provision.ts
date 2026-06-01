import { DEFAULT_TENANT_ORG_IMPORT } from './tenant-org-onboarding.data';

import type { TenantOrgImport, TenantOrgProvisionResult } from './tenant-org-onboarding.types';
import type { Prisma, PrismaClient } from '../../generated/prisma';

export async function provisionTenantOrgFromImport(
  prisma: PrismaClient,
  tenantId: string,
  payload: TenantOrgImport = DEFAULT_TENANT_ORG_IMPORT,
): Promise<TenantOrgProvisionResult> {
  const deptByCode = new Map<string, string>();

  for (const dept of payload.departments) {
    const row = await prisma.tenantDepartment.upsert({
      where: { tenantId_code: { tenantId, code: dept.code } },
      create: {
        tenantId,
        code: dept.code,
        name: dept.name as Prisma.InputJsonValue,
        sortOrder: dept.sort_order,
        isActive: true,
      },
      update: {
        name: dept.name as Prisma.InputJsonValue,
        sortOrder: dept.sort_order,
        isActive: true,
      },
    });
    deptByCode.set(dept.code, row.id);
  }

  let designationsUpserted = 0;
  for (const item of payload.designations) {
    const departmentId =
      item.scope === 'department' && item.department_code
        ? (deptByCode.get(item.department_code) ?? null)
        : null;
    if (item.scope === 'department' && item.department_code && !departmentId) {
      continue;
    }

    await prisma.tenantDesignation.upsert({
      where: { tenantId_code: { tenantId, code: item.code } },
      create: {
        tenantId,
        code: item.code,
        name: item.name as Prisma.InputJsonValue,
        scope: item.scope,
        departmentId,
        isActive: true,
        isDepartmentHead: item.is_department_head ?? false,
        canRejectMunicipal: item.can_reject_municipal ?? false,
      },
      update: {
        name: item.name as Prisma.InputJsonValue,
        scope: item.scope,
        departmentId,
        isActive: true,
        isDepartmentHead: item.is_department_head ?? false,
        canRejectMunicipal: item.can_reject_municipal ?? false,
      },
    });
    designationsUpserted += 1;
  }

  return {
    departments_upserted: payload.departments.length,
    designations_upserted: designationsUpserted,
  };
}
