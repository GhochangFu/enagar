import { ForbiddenException } from '@nestjs/common';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

/** Roles allowed to use Tenant Admin Portal APIs (JWT-scoped to principal tenant). */
export const TENANT_ADMIN_PORTAL_ROLES = [
  'tenant_admin',
  'state_admin',
  'municipality_admin',
] as const;

const portalRoleSet = new Set<string>(TENANT_ADMIN_PORTAL_ROLES);

export function assertTenantPortalStaff(principal: AuthenticatedPrincipal): void {
  const allowed = principal.roles.some((role) => portalRoleSet.has(role));
  if (!allowed) {
    throw new ForbiddenException(
      'Tenant admin portal requires tenant_admin, municipality_admin, or state_admin',
    );
  }
}

/** Masters / Operations configuration writes (grievance catalogue, SLA, routing). */
export function assertTenantPortalAdminWrite(principal: AuthenticatedPrincipal): void {
  assertTenantPortalStaff(principal);
}
