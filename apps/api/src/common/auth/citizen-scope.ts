import { BadRequestException } from '@nestjs/common';

import { principalHasGrievanceStaffAccess } from '../../modules/grievances/grievance-staff-roles';
import {
  CITIZEN_PORTAL_TENANT_CODE,
  tenantSeeds,
  type TenantSummary,
} from '../../modules/tenants/tenant.seed';

import type { AuthenticatedPrincipal } from './jwt-claims';
import type { ApplicationReadScope } from '../../modules/applications/dto';
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

/** Maps an active ULB code to its tenant id for hub scoping (payments store, grievance queries). */
export function resolveMunicipalityTenantIdFromScopeCode(scopeCode: string): string | undefined {
  const needle = scopeCode.trim().toUpperCase();
  const entry = tenantSeeds.find(
    (tenant) =>
      tenant.is_active &&
      tenant.code !== CITIZEN_PORTAL_TENANT_CODE &&
      tenant.code.toUpperCase() === needle,
  );
  return entry?.id;
}

/**
 * Target municipal ULB for citizen **writes** (applications, grievances) when using Option A:
 * portal JWT must send {@link CITIZEN_MUNICIPALITY_SCOPE_HEADER}; municipal JWT uses claims.
 */
export function resolveCitizenMunicipalityForWrite(
  principal: AuthenticatedPrincipal,
  catalogue: TenantSummary[],
  municipalityScopeHeader?: string,
): { tenantId: string; tenantCode: string } {
  if (principalIsCitizenPortal(principal) && isCitizenSelfServicePrincipal(principal)) {
    const raw = municipalityScopeHeader?.trim();
    if (!raw) {
      throw new BadRequestException(
        'Active municipality is required. Send X-Enagar-Tenant-Code when filing with a portal (WBPORTAL) login.',
      );
    }
    const tenantCode = assertActiveMunicipalityTenantCode(raw, catalogue);
    const tenantId = resolveMunicipalityTenantIdFromScopeCode(tenantCode);
    if (!tenantId) {
      throw new BadRequestException('Invalid tenant scope');
    }
    return { tenantId, tenantCode };
  }
  if (!principal.tenantCode) {
    throw new BadRequestException('Tenant code claim is required');
  }
  return { tenantId: principal.tenantId, tenantCode: principal.tenantCode };
}

/**
 * Hub vs workspace access for rows keyed by municipal `tenant_id` and citizen `subject`
 * (payment rows, cross-tenant citizen APIs).
 */
export function citizenHubRowAccessibleByTenant(
  principal: AuthenticatedPrincipal,
  row: { tenant_id: string; citizen_subject: string },
  readScope?: ApplicationReadScope,
): boolean {
  if (row.citizen_subject !== principal.subject) {
    return false;
  }

  if (principalIsCitizenPortal(principal) && isCitizenSelfServicePrincipal(principal)) {
    const scoped = readScope?.municipalityTenantCode?.trim();
    if (scoped) {
      const tenantId = resolveMunicipalityTenantIdFromScopeCode(scoped);
      return tenantId ? row.tenant_id === tenantId : false;
    }
    return true;
  }

  return row.tenant_id === principal.tenantId;
}
