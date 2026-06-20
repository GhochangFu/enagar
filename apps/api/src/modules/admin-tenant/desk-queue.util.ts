import type { Prisma } from '../../generated/prisma';

export function deskApplicationInMyQueue(
  row: { pending_role: string | null; pending_designation: string | null },
  roles: string[],
  designationCodes: string[],
): boolean {
  if (row.pending_designation) {
    return designationCodes.includes(row.pending_designation);
  }
  return row.pending_role ? roles.includes(row.pending_role) : false;
}

/** Prisma filter for open applications in the staff "my" queue (designation union + legacy roles). */
export function deskMyQueueWhereClause(
  roles: string[],
  designationCodes: string[],
): Prisma.ApplicationWhereInput['OR'] {
  const or: Prisma.ApplicationWhereInput[] = [];
  if (designationCodes.length > 0) {
    or.push({ pendingDesignation: { in: designationCodes } });
  }
  if (roles.length > 0) {
    or.push({
      pendingDesignation: null,
      pendingRole: { in: roles },
    });
  }
  return or.length > 0 ? or : [{ id: { in: [] } }];
}
