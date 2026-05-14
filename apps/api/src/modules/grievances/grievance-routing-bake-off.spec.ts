import { resolveGrievanceRouting } from './grievance-routing';

import type { PrismaClient } from '../../generated/prisma';

const TENANT_FIXTURE_ID = '33333333-3333-4333-a333-333333333333';
const WARD_ALPHA = 'aaaaaaaa-aaaa-4aaa-a8aa-aaaaaaaaaaaa';

/** Deterministic oracle — keep aligned with RULE_ROWS fixture ordering */
function oracleExpected(category: string, priority: string, wardId: string | null): string {
  if (category === 'water' && priority === 'urgent') {
    return 'tenant_admin';
  }
  if (category === 'water') {
    return 'municipality_admin';
  }
  if (wardId === WARD_ALPHA && priority === 'high') {
    return 'municipality_clerk';
  }
  if (wardId === WARD_ALPHA) {
    return 'tenant_admin';
  }
  return 'municipality_clerk';
}

const RULE_ROWS = [
  {
    sortOrder: 0,
    categoryMatch: 'water',
    grievancePriorityMatch: 'urgent',
    wardId: null,
    targetRoleCode: 'tenant_admin',
    assignUserId: null,
  },
  {
    sortOrder: 1,
    categoryMatch: 'water',
    grievancePriorityMatch: null,
    wardId: null,
    targetRoleCode: 'municipality_admin',
    assignUserId: null,
  },
  {
    sortOrder: 2,
    categoryMatch: null,
    grievancePriorityMatch: 'high',
    wardId: WARD_ALPHA,
    targetRoleCode: 'municipality_clerk',
    assignUserId: null,
  },
  {
    sortOrder: 3,
    categoryMatch: null,
    grievancePriorityMatch: null,
    wardId: WARD_ALPHA,
    targetRoleCode: 'tenant_admin',
    assignUserId: null,
  },
  {
    sortOrder: 999,
    categoryMatch: null,
    grievancePriorityMatch: null,
    wardId: null,
    targetRoleCode: 'municipality_clerk',
    assignUserId: null,
  },
];

const prismaStub = {
  grievanceRoutingRule: {
    findMany: async (): Promise<(typeof RULE_ROWS)[number][]> =>
      RULE_ROWS.map((row) => ({ ...row, tenantId: TENANT_FIXTURE_ID })),
  },
} as unknown as Pick<PrismaClient, 'grievanceRoutingRule'>;

function scenarioAt(index: number): {
  category: string;
  priority: string;
  wardId: string | null;
} {
  const categories = ['water', 'roads', 'sanitation', 'parks', 'other'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  return {
    category: categories[index % categories.length] ?? 'other',
    priority: priorities[Math.floor(index / categories.length) % priorities.length] ?? 'low',
    wardId: index % 2 === 0 ? WARD_ALPHA : null,
  };
}

describe('Master Phase 4 backlog — grievance routing bake-off (200 permutations)', () => {
  it('routing engine aligns with seeded rule ordering on systematic scenarios', async () => {
    for (let i = 0; i < 200; i++) {
      const s = scenarioAt(i);
      const actual = await resolveGrievanceRouting(
        prismaStub,
        TENANT_FIXTURE_ID,
        s.category,
        s.priority,
        s.wardId,
      );
      expect(actual.targetRoleCode).toBe(oracleExpected(s.category, s.priority, s.wardId));
    }
    expect(
      await resolveGrievanceRouting(prismaStub, TENANT_FIXTURE_ID, 'roads', 'low', null),
    ).toEqual({ targetRoleCode: 'municipality_clerk', assignUserId: null });
  });
});
