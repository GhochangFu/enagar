import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { CITIZEN_PORTAL_TENANT_ID } from '../tenants/tenant.seed';

import type { CitizenStore } from './citizen-store';
import type { CitizenProfileResponse, LanguageCode } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

interface CitizenRow {
  id: string;
  tenantId: string;
  keycloakSubject: string | null;
  mobile: string;
  name: string | null;
  holdingNumber: string | null;
  languagePref: string;
  selectedTenantCode: string | null;
}

/**
 * Postgres persistence adapter shape for citizen profiles.
 *
 * It becomes the active store after the store contracts are made async and the
 * modules are switched in citizen -> application -> payment order.
 */
@Injectable()
export class PostgresCitizenStore implements CitizenStore {
  constructor(private readonly db: PrismaService) {}

  /** Prefer portal-row profile (Option A); else most recently updated row for this subject. */
  async findByPrincipal(principal: AuthenticatedPrincipal): Promise<CitizenProfileResponse | null> {
    const subject = principal.subject;
    let row: CitizenRow | null = null;

    if (subject) {
      row = await this.db.citizen.findUnique({
        where: {
          tenantId_keycloakSubject: {
            tenantId: CITIZEN_PORTAL_TENANT_ID,
            keycloakSubject: subject,
          },
        },
      });
    }

    if (!row && subject) {
      row = await this.db.citizen.findFirst({
        where: { keycloakSubject: subject },
        orderBy: { updatedAt: 'desc' },
      });
    }

    return row ? toProfile(row, principal.tenantCode) : null;
  }

  async save(profile: CitizenProfileResponse): Promise<void> {
    await this.db.citizen.upsert({
      where: {
        tenantId_keycloakSubject: {
          tenantId: profile.tenant_id,
          keycloakSubject: profile.keycloak_subject,
        },
      },
      create: {
        id: profile.id,
        tenantId: profile.tenant_id,
        keycloakSubject: profile.keycloak_subject,
        mobile: profile.mobile,
        name: profile.name,
        holdingNumber: profile.holding_number,
        languagePref: profile.language_pref,
        selectedTenantCode: profile.selected_tenant_code ?? null,
      },
      update: {
        mobile: profile.mobile,
        name: profile.name,
        holdingNumber: profile.holding_number,
        languagePref: profile.language_pref,
        selectedTenantCode: profile.selected_tenant_code ?? null,
      },
    });
  }
}

function toProfile(
  row: CitizenRow,
  principalTenantCode: string | undefined,
): CitizenProfileResponse {
  return {
    id: row.id,
    keycloak_subject: row.keycloakSubject ?? '',
    tenant_id: row.tenantId,
    tenant_code: principalTenantCode,
    mobile: row.mobile,
    name: row.name,
    holding_number: row.holdingNumber,
    language_pref: row.languagePref as LanguageCode,
    selected_tenant_code: row.selectedTenantCode ?? undefined,
  };
}
