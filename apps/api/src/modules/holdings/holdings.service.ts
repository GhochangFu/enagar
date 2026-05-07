import { BadRequestException, Injectable } from '@nestjs/common';

import { holdingSeeds } from './holding.seed';

import type { HoldingLookupResponse, HoldingResponse } from './dto';
import type { HoldingSeed } from './holding.seed';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@Injectable()
export class HoldingsService {
  lookup(principal: AuthenticatedPrincipal, holdingNumber: string): HoldingLookupResponse {
    const tenantCode = this.requireTenantCode(principal);
    const normalized = normalizeHolding(holdingNumber);
    const holding = holdingSeeds.find(
      (candidate) =>
        candidate.tenant_code === tenantCode &&
        normalizeHolding(candidate.holding_number) === normalized,
    );

    return this.withAudit(holdingNumber, holding);
  }

  search(principal: AuthenticatedPrincipal, query: string): HoldingResponse[] {
    const tenantCode = this.requireTenantCode(principal);
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
