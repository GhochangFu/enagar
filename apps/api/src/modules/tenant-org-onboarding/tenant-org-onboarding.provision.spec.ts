import { DEFAULT_TENANT_ORG_IMPORT } from './tenant-org-onboarding.data';
import { provisionTenantOrgFromImport } from './tenant-org-onboarding.provision';

describe('provisionTenantOrgFromImport', () => {
  it('upserts 24 departments and Appendix B designations', async () => {
    const deptUpserts: unknown[] = [];
    const desigUpserts: unknown[] = [];
    const prisma = {
      tenantDepartment: {
        upsert: jest.fn(async ({ create }: { create: { code: string } }) => {
          deptUpserts.push(create.code);
          return { id: `dept-${create.code}` };
        }),
      },
      tenantDesignation: {
        upsert: jest.fn(async ({ create }: { create: { code: string } }) => {
          desigUpserts.push(create.code);
          return { id: `desig-${create.code}` };
        }),
      },
    };

    const result = await provisionTenantOrgFromImport(
      prisma as never,
      'tenant-1',
      DEFAULT_TENANT_ORG_IMPORT,
    );

    expect(result.departments_upserted).toBe(24);
    expect(result.designations_upserted).toBe(47);
    expect(deptUpserts).toContain('public-works');
    expect(desigUpserts).toContain('pwd_executive_engineer');
    expect(desigUpserts).toContain('hoarding_officer');
    expect(desigUpserts).toContain('chairperson');
  });
});
