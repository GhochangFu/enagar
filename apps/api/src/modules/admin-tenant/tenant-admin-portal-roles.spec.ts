import { ForbiddenException } from '@nestjs/common';

import { assertTenantPortalStaff } from './tenant-admin-portal-roles';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

function principal(roles: string[]): AuthenticatedPrincipal {
  return {
    subject: 'u1',
    tenantId: '00000000-0000-4000-a000-000000000002',
    tenantCode: 'KMC',
    roles,
    expiresAt: new Date(Date.now() + 60_000),
  };
}

describe('tenant-admin-portal-roles', () => {
  it('allows tenant_admin', () => {
    expect(() => assertTenantPortalStaff(principal(['tenant_admin']))).not.toThrow();
  });

  it('allows municipality_admin', () => {
    expect(() => assertTenantPortalStaff(principal(['municipality_admin']))).not.toThrow();
  });

  it('allows state_admin alongside other roles', () => {
    expect(() => assertTenantPortalStaff(principal(['citizen', 'state_admin']))).not.toThrow();
  });

  it('blocks tenant_clerk-only', () => {
    expect(() => assertTenantPortalStaff(principal(['tenant_clerk']))).toThrow(ForbiddenException);
  });

  it('blocks citizen-only', () => {
    expect(() => assertTenantPortalStaff(principal(['citizen']))).toThrow(ForbiddenException);
  });
});
