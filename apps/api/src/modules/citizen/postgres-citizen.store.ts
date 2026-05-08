import { Injectable } from '@nestjs/common';

import type { CitizenStore } from './citizen-store';
import type { CitizenProfileResponse, LanguageCode } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { PrismaService } from '../../common/database/prisma.service';

interface CitizenRow {
  id: string;
  tenantId: string;
  keycloakSubject: string | null;
  mobile: string;
  name: string | null;
  holdingNumber: string | null;
  languagePref: string;
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

  async findByPrincipal(principal: AuthenticatedPrincipal): Promise<CitizenProfileResponse | null> {
    const row = await this.db.citizen.findFirst({
      where: {
        tenantId: principal.tenantId,
        keycloakSubject: principal.subject,
      },
    });
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
      },
      update: {
        mobile: profile.mobile,
        name: profile.name,
        holdingNumber: profile.holding_number,
        languagePref: profile.language_pref,
      },
    });
  }
}

function toProfile(row: CitizenRow, tenantCode: string | undefined): CitizenProfileResponse {
  return {
    id: row.id,
    keycloak_subject: row.keycloakSubject ?? '',
    tenant_id: row.tenantId,
    tenant_code: tenantCode,
    mobile: row.mobile,
    name: row.name,
    holding_number: row.holdingNumber,
    language_pref: row.languagePref as LanguageCode,
    selected_tenant_code: tenantCode,
  };
}
