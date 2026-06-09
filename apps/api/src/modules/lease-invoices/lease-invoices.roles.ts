import { ForbiddenException } from '@nestjs/common';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

/**
 * Lease invoice operations are restricted to tenant staff.
 *
 * Mirrors `GRIEVANCE_STAFF_ROLES` (grievance-staff-roles.ts) and the
 * `tenant-admin-portal-roles.ts` role set. The set must match the JWT
 * `role` claim values minted by Keycloak for tenant operators:
 *   - `municipality_admin` (KMC/HMC municipality administrators)
 *   - `tenant_admin`      (tenant admin staff)
 *   - `tenant_clerk`      (legacy label, hub issue 5.1)
 *   - `state_admin`       (state oversight)
 *
 * Note: do NOT add generic `admin`/`staff`/`finance` — those are not JWT role
 * values in this system. The previous EN-18 implementation used those
 * placeholder strings, which produced a 403 in production for every operator.
 */
const LEASE_INVOICE_STAFF_ROLES = new Set<string>([
  'municipality_admin',
  'tenant_admin',
  'tenant_clerk',
  'municipality_clerk',
  'state_admin',
]);

export function hasLeaseInvoiceStaffAccess(principal: AuthenticatedPrincipal): boolean {
  return principal.roles.some((role) => LEASE_INVOICE_STAFF_ROLES.has(role));
}

export function assertLeaseInvoiceStaffAccess(principal: AuthenticatedPrincipal): void {
  if (!hasLeaseInvoiceStaffAccess(principal)) {
    throw new ForbiddenException(
      'Lease invoice operations require municipality_admin, tenant_admin, tenant_clerk, or state_admin role.',
    );
  }
}
