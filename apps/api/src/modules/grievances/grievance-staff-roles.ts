/** JWT `role` values that may operate staff grievance endpoints (Sprint 4.1). */
export const GRIEVANCE_STAFF_ROLES = new Set<string>([
  'municipality_clerk',
  'municipality_admin',
  'tenant_admin',
  'state_admin',
]);

export function isGrievanceStaffRole(role: string): boolean {
  return GRIEVANCE_STAFF_ROLES.has(role);
}

export function principalHasGrievanceStaffAccess(roles: string[]): boolean {
  return roles.some((r) => isGrievanceStaffRole(r));
}
