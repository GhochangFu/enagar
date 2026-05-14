/**
 * JWT `role` values that may operate staff grievance endpoints (Sprint 4.1).
 *
 * **Hub H5.1:** Keycloak realm export (`infrastructure/keycloak/realm-export.json`) also defines
 * **`tenant_clerk`** (legacy label). Tokens may emit **`tenant_clerk`** or **`municipality_*`**;
 * both are accepted here. Routing / SLA seed tables still use **`municipality_clerk`** as a
 * business role code where applicable.
 */
export const GRIEVANCE_STAFF_ROLES = new Set<string>([
  'municipality_clerk',
  'municipality_admin',
  'tenant_clerk',
  'tenant_admin',
  'state_admin',
]);

export function isGrievanceStaffRole(role: string): boolean {
  return GRIEVANCE_STAFF_ROLES.has(role);
}

export function principalHasGrievanceStaffAccess(roles: string[]): boolean {
  return roles.some((r) => isGrievanceStaffRole(r));
}
