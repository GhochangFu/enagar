import { DEFAULT_TENANT_ORG_IMPORT } from '../../src/modules/tenant-org-onboarding/tenant-org-onboarding.data';
import { provisionTenantOrgFromImport } from '../../src/modules/tenant-org-onboarding/tenant-org-onboarding.provision';

import type { PrismaClient } from '../../generated/prisma';

/** Prisma seed hook — full Appendix A departments + Appendix B designations for every ULB. */
export async function seedTenantOrgForTenant(
  prisma: PrismaClient,
  tenantId: string,
  _tenantCode: string,
): Promise<void> {
  await provisionTenantOrgFromImport(prisma, tenantId, DEFAULT_TENANT_ORG_IMPORT);
}
