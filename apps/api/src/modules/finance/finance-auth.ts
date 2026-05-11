import { ForbiddenException } from '@nestjs/common';

import { FINANCE_APPROVAL_ROLES } from './finance-roles';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

export function assertFinanceStaff(principal: AuthenticatedPrincipal): void {
  const allowed = principal.roles.some((role) => FINANCE_APPROVAL_ROLES.has(role));
  if (!allowed) {
    throw new ForbiddenException('Finance staff role required');
  }
}
