import { BadRequestException, Injectable } from '@nestjs/common';

import {
  assertActiveMunicipalityTenantCode,
  CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  isCitizenSelfServicePrincipal,
  principalIsCitizenPortal,
} from '../../common/auth/citizen-scope';
import { TenantsService } from '../tenants/tenants.service';

import { holdingSeeds } from './holding.seed';

import type { HoldingLookupResponse, HoldingResponse } from './dto';
import type { HoldingSeed } from './holding.seed';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@Injectable()
export class HoldingsService {
  constructor(private readonly tenants: TenantsService) {}

  async lookup(
    principal: AuthenticatedPrincipal,
    holdingNumber: string,
    municipalityScopeHeader?: string,
  ): Promise<HoldingLookupResponse> {
    const tenantCode = await this.resolveWorkspacesTenantCode(principal, municipalityScopeHeader);
    const normalized = normalizeHolding(holdingNumber);
    const holding = holdingSeeds.find(
      (candidate) =>
        candidate.tenant_code === tenantCode &&
        normalizeHolding(candidate.holding_number) === normalized,
    );

    return this.withAudit(holdingNumber, holding);
  }

  async search(
    principal: AuthenticatedPrincipal,
    query: string,
    municipalityScopeHeader?: string,
  ): Promise<HoldingResponse[]> {
    const tenantCode = await this.resolveWorkspacesTenantCode(principal, municipalityScopeHeader);
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 3) {
      throw new BadRequestException('Search query must be at least 3 characters');
    }

    return holdingSeeds
      .filter(
        (candidate) =>
          candidate.tenant_code === tenantCode &&
          (candidate.holding_number.toLowerCase().includes(normalized) ||
            candidate.owner_display_name.toLowerCase().includes(normalized) ||
            candidate.locality.toLowerCase().includes(normalized)),
      )
      .slice(0, 10)
      .map(toHoldingResponse);
  }

  private withAudit(
    holdingNumber: string,
    holding: HoldingSeed | undefined,
  ): HoldingLookupResponse {
    return {
      found: Boolean(holding),
      holding: holding ? toHoldingResponse(holding) : null,
      audit: {
        holding_number: holdingNumber,
        outcome: holding ? 'found' : 'not_found',
        source: 'local_mirror',
        created_at: new Date().toISOString(),
      },
    };
  }

  private async resolveWorkspacesTenantCode(
    principal: AuthenticatedPrincipal,
    municipalityScopeHeader?: string,
  ): Promise<string> {
    if (principalIsCitizenPortal(principal) && isCitizenSelfServicePrincipal(principal)) {
      if (!municipalityScopeHeader?.trim()) {
        throw new BadRequestException(
          `Portal citizen requests require ${CITIZEN_MUNICIPALITY_SCOPE_HEADER} header for holdings`,
        );
      }
      return assertActiveMunicipalityTenantCode(municipalityScopeHeader, await this.tenants.list());
    }
    return this.requireTenantCode(principal);
  }

  private requireTenantCode(principal: AuthenticatedPrincipal): string {
    if (!principal.tenantCode) {
      throw new BadRequestException('Tenant code claim is required');
    }
    return principal.tenantCode;
  }
}

function normalizeHolding(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function toHoldingResponse(seed: HoldingSeed): HoldingResponse {
  return {
    holding_number: seed.holding_number,
    owner_display_name: seed.owner_display_name,
    ward_number: seed.ward_number,
    locality: seed.locality,
    address: { ...seed.address },
    property_type: seed.property_type,
    outstanding_amount: seed.outstanding_amount,
    source: seed.source,
    source_updated_at: seed.source_updated_at,
  };
}
