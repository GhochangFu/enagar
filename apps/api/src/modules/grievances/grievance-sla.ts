import type { PrismaClient } from '../../generated/prisma';

/**
 * Resolve SLA hours from tenant policies. Among applicable rows, prefer higher
 * specificity (category / priority matchers set), then lower `sort_order`.
 */
export async function resolveSlaHours(
  prisma: Pick<PrismaClient, 'slaPolicy'>,
  tenantId: string,
  category: string,
  grievancePriority: string,
): Promise<number> {
  const policies = await prisma.slaPolicy.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }],
  });

  const candidates = policies.filter((p) => {
    const catOk = !p.categoryMatch || p.categoryMatch === category;
    const priOk = !p.grievancePriorityMatch || p.grievancePriorityMatch === grievancePriority;
    return catOk && priOk;
  });

  if (candidates.length === 0) {
    return 72;
  }

  const specificity = (p: (typeof candidates)[0]): number =>
    (p.categoryMatch ? 2 : 0) + (p.grievancePriorityMatch ? 1 : 0);

  candidates.sort((a, b) => {
    const ds = specificity(b) - specificity(a);
    if (ds !== 0) {
      return ds;
    }
    return a.sortOrder - b.sortOrder;
  });

  const best = candidates[0];
  if (!best) {
    return 72;
  }
  return best.hoursToResolve;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
