import { ForbiddenException } from '@nestjs/common';

import { assertDepositTransition } from './deposit-lifecycle';
import { assertFinanceStaff } from './finance-auth';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

describe('deposit-lifecycle', () => {
  it('allows held → eligible_for_release', () => {
    expect(() => assertDepositTransition('held', 'eligible_for_release')).not.toThrow();
  });

  it('forbids held → refunded', () => {
    expect(() => assertDepositTransition('held', 'refunded')).toThrow('Illegal deposit transition');
  });

  it('finance staff gate passes for tenant_admin', () => {
    const principal = {
      subject: 'staff-1',
      tenantId: '00000000-0000-4000-a000-000000000002',
      tenantCode: 'KMC',
      roles: ['tenant_admin'],
      expiresAt: new Date(Date.now() + 60_000),
    } satisfies AuthenticatedPrincipal;
    expect(() => assertFinanceStaff(principal)).not.toThrow();
  });

  it('finance staff gate blocks citizen-only roles', () => {
    const principal = {
      subject: 'c-1',
      tenantId: '00000000-0000-4000-a000-000000000003',
      tenantCode: 'KMC',
      roles: ['citizen'],
      expiresAt: new Date(Date.now() + 60_000),
    } satisfies AuthenticatedPrincipal;
    expect(() => assertFinanceStaff(principal)).toThrow(ForbiddenException);
  });
});
