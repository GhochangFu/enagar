import assert from 'node:assert/strict';

import { assertGrievanceFilingMatchesCatalogue } from './grievance-catalogue.service';

describe('assertGrievanceFilingMatchesCatalogue', () => {
  const tenantId = '00000000-0000-4000-8000-000000000001';

  it('skips validation when tenant has no catalogue rows', async () => {
    const prisma = {
      tenantGrievanceCategory: {
        count: async () => 0,
      },
      tenantGrievanceSubtype: {},
    } as never;

    await assertGrievanceFilingMatchesCatalogue(prisma, tenantId, {
      category: 'anything',
    });
  });

  it('rejects unknown category when catalogue exists', async () => {
    const prisma = {
      tenantGrievanceCategory: {
        count: async () => 2,
        findFirst: async () => null,
      },
      tenantGrievanceSubtype: {},
    } as never;

    await assert.rejects(
      () =>
        assertGrievanceFilingMatchesCatalogue(prisma, tenantId, {
          category: 'fake',
        }),
      /Unknown or inactive grievance category/,
    );
  });

  it('requires subtype when category has active subtypes', async () => {
    const prisma = {
      tenantGrievanceCategory: {
        count: async () => 1,
        findFirst: async () => ({
          code: 'stray_dogs',
          subtypes: [{ code: 'stray_animals' }],
        }),
      },
      tenantGrievanceSubtype: {},
    } as never;

    await assert.rejects(
      () =>
        assertGrievanceFilingMatchesCatalogue(prisma, tenantId, {
          category: 'stray_dogs',
        }),
      /subtype_code is required/,
    );
  });

  it('accepts valid category without subtypes', async () => {
    const prisma = {
      tenantGrievanceCategory: {
        count: async () => 1,
        findFirst: async () => ({
          code: 'roads',
          subtypes: [],
        }),
      },
      tenantGrievanceSubtype: {},
    } as never;

    await assertGrievanceFilingMatchesCatalogue(prisma, tenantId, {
      category: 'roads',
    });
  });
});
