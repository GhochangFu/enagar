import { BadRequestException } from '@nestjs/common';

import { principalHasGrievanceStaffAccess } from '../../modules/grievances/grievance-staff-roles';
import { CITIZEN_PORTAL_TENANT_CODE, type TenantSummary } from '../../modules/tenants/tenant.seed';

import type { AuthenticatedPrincipal } from './jwt-claims';
import type { IncomingHttpHeaders } from 'node:http';

/** Client header: active municipality when operating inside a ULB workspace (Phase 2+). */
export const CITIZEN_MUNICIPALITY_SCOPE_HEADER = 'x-enagar-tenant-code';

export function parseTenantScopeHeader(headers: IncomingHttpHeaders): string | undefined {
  const raw = headers[CITIZEN_MUNICIPALITY_SCOPE_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function principalIsCitizenPortal(
  principal: AuthenticatedPrincipal | { tenantCode?: string },
): boolean {
  return principal.tenantCode?.toUpperCase() === CITIZEN_PORTAL_TENANT_CODE;
}

/** Citizen app user without grievance staff escalation (hub / self-service paths). */
export function isCitizenSelfServicePrincipal(
  principal: AuthenticatedPrincipal | { roles: string[] },
): boolean {
  return principal.roles.includes('citizen') && !principalHasGrievanceStaffAccess(principal.roles);
}

/** Resolve municipality code from header/DTO against catalogue; rejects portal & inactive tenants. */
export function assertActiveMunicipalityTenantCode(
  raw: string,
  catalogue: TenantSummary[],
): string {
  const needle = raw.trim().toUpperCase();
  const entry = catalogue.find((t) => t.is_active && t.code.toUpperCase() === needle);
  if (!entry) {
    throw new BadRequestException('Tenant not found');
  }
  if (entry.code === CITIZEN_PORTAL_TENANT_CODE) {
    throw new BadRequestException('Filings must target a municipality');
  }
  return entry.code;
}
