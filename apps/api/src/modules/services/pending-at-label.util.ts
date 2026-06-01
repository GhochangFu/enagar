import type { Prisma, PrismaClient } from '../../generated/prisma';

type PrismaLike = Pick<PrismaClient, 'tenantDesignation'>;

export type PendingAtInput = {
  pending_designation?: string | null;
  pending_role: string | null;
};

const LEGACY_PENDING_ROLE_LABELS: Record<string, string> = {
  citizen: 'Citizen',
  tenant_clerk: 'Municipal clerk',
  municipality_clerk: 'Municipal clerk',
  tenant_admin: 'Municipality admin',
  municipality_admin: 'Municipality admin',
  front_office: 'Front office',
  'front-office': 'Front office',
  reviewer: 'Reviewer',
  system: 'System',
};

function pickEnLabel(json: Prisma.JsonValue | null | undefined, fallback: string): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    if (typeof record.en === 'string' && record.en.trim()) {
      return record.en.trim();
    }
  }
  return fallback;
}

export function formatPendingAtLabelFromDesignationRow(row: {
  code: string;
  name: Prisma.JsonValue;
  department: { name: Prisma.JsonValue; code: string } | null;
}): string {
  const designationName = pickEnLabel(row.name, row.code);
  if (row.department) {
    const departmentName = pickEnLabel(row.department.name, row.department.code);
    return `${designationName} — ${departmentName}`;
  }
  return designationName;
}

export function legacyPendingRoleLabel(pendingRole: string | null): string | null {
  if (!pendingRole?.trim()) {
    return null;
  }
  const key = pendingRole.trim();
  return LEGACY_PENDING_ROLE_LABELS[key] ?? key.replace(/_/g, ' ');
}

export function resolvePendingAtLabelSync(
  input: PendingAtInput,
  designationByCode: Map<
    string,
    {
      code: string;
      name: Prisma.JsonValue;
      department: { name: Prisma.JsonValue; code: string } | null;
    }
  >,
): string | null {
  const code = input.pending_designation?.trim();
  if (code) {
    const row = designationByCode.get(code);
    if (row) {
      return formatPendingAtLabelFromDesignationRow(row);
    }
    return code.replace(/_/g, ' ');
  }
  return legacyPendingRoleLabel(input.pending_role);
}

export async function loadDesignationLabelMap(
  prisma: PrismaLike,
  tenantId: string,
  designationCodes: string[],
): Promise<
  Map<
    string,
    {
      code: string;
      name: Prisma.JsonValue;
      department: { name: Prisma.JsonValue; code: string } | null;
    }
  >
> {
  const codes = [...new Set(designationCodes.map((c) => c.trim()).filter(Boolean))];
  if (codes.length === 0) {
    return new Map();
  }
  const rows = await prisma.tenantDesignation.findMany({
    where: { tenantId, code: { in: codes }, isActive: true },
    select: {
      code: true,
      name: true,
      department: { select: { code: true, name: true } },
    },
  });
  return new Map(rows.map((row) => [row.code, row]));
}

export async function attachPendingAtLabels<T extends PendingAtInput & { tenant_id?: string }>(
  prisma: PrismaLike,
  tenantId: string,
  rows: T[],
): Promise<(T & { pending_at_label: string | null })[]> {
  const designationCodes = rows
    .map((row) => row.pending_designation)
    .filter((code): code is string => Boolean(code?.trim()));
  const byCode = await loadDesignationLabelMap(prisma, tenantId, designationCodes);
  return rows.map((row) => ({
    ...row,
    pending_at_label: resolvePendingAtLabelSync(row, byCode),
  }));
}
