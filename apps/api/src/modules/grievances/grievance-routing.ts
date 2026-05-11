import type { PrismaClient } from '../../generated/prisma';

export type GrievanceRoutingResult = {
  targetRoleCode: string;
  assignUserId: string | null;
};

/**
 * First matching rule wins (lowest sort_order). Wildcards: null category_match matches any;
 * null grievance_priority_match matches any; ward must match when present on rule.
 */
export async function resolveGrievanceRouting(
  prisma: Pick<PrismaClient, 'grievanceRoutingRule'>,
  tenantId: string,
  category: string,
  grievancePriority: string,
  wardId: string | null,
): Promise<GrievanceRoutingResult> {
  const rules = await prisma.grievanceRoutingRule.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }],
  });

  for (const rule of rules) {
    if (rule.categoryMatch && rule.categoryMatch !== category) {
      continue;
    }
    if (rule.grievancePriorityMatch && rule.grievancePriorityMatch !== grievancePriority) {
      continue;
    }
    if (rule.wardId && rule.wardId !== wardId) {
      continue;
    }
    return {
      targetRoleCode: rule.targetRoleCode,
      assignUserId: rule.assignUserId,
    };
  }

  return { targetRoleCode: 'municipality_clerk', assignUserId: null };
}
