import { isGrievanceStaffRole, principalHasGrievanceStaffAccess } from './grievance-staff-roles';

describe('grievance staff roles (Hub H5.1 Keycloak parity)', () => {
  it('accepts municipality_* and tenant_clerk for staff endpoints', () => {
    expect(isGrievanceStaffRole('municipality_clerk')).toBe(true);
    expect(isGrievanceStaffRole('municipality_admin')).toBe(true);
    expect(isGrievanceStaffRole('tenant_clerk')).toBe(true);
    expect(isGrievanceStaffRole('tenant_admin')).toBe(true);
    expect(isGrievanceStaffRole('state_admin')).toBe(true);
  });

  it('rejects citizen-only and unknown roles', () => {
    expect(isGrievanceStaffRole('citizen')).toBe(false);
    expect(isGrievanceStaffRole('mayor')).toBe(false);
  });

  it('principalHasGrievanceStaffAccess matches if any role qualifies', () => {
    expect(principalHasGrievanceStaffAccess(['tenant_clerk'])).toBe(true);
    expect(principalHasGrievanceStaffAccess(['citizen', 'tenant_clerk'])).toBe(true);
    expect(principalHasGrievanceStaffAccess(['citizen'])).toBe(false);
  });
});
