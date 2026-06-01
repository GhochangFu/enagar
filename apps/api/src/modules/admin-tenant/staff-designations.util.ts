import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { PrismaService } from '../../common/database/prisma.service';
import type { DesignationCapability } from '@enagar/workflow';

export type StaffDesignationContext = {
  codes: string[];
  capabilities: DesignationCapability[];
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

export async function loadStaffDesignationContext(
  prisma: PrismaService,
  principal: AuthenticatedPrincipal,
): Promise<StaffDesignationContext> {
  const subject = principal.subject.trim();
  const user = await prisma.user.findFirst({
    where: {
      tenantId: principal.tenantId,
      status: 'active',
      OR: [...(isUuid(subject) ? [{ keycloakUserId: subject }] : []), { username: subject }],
    },
    include: {
      userDesignations: {
        include: {
          designation: {
            select: {
              code: true,
              isDepartmentHead: true,
              canRejectMunicipal: true,
              isActive: true,
            },
          },
        },
      },
    },
  });
  if (!user) {
    return { codes: [], capabilities: [] };
  }

  const codes: string[] = [];
  const capabilities: DesignationCapability[] = [];
  for (const row of user.userDesignations) {
    if (!row.designation.isActive) {
      continue;
    }
    codes.push(row.designation.code);
    capabilities.push({
      code: row.designation.code,
      is_department_head: row.designation.isDepartmentHead,
      can_reject_municipal: row.designation.canRejectMunicipal,
    });
  }
  return { codes, capabilities };
}
