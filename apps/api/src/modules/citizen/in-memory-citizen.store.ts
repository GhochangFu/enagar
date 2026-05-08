import { Injectable } from '@nestjs/common';

import type { CitizenStore } from './citizen-store';
import type { CitizenProfileResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@Injectable()
export class InMemoryCitizenStore implements CitizenStore {
  private readonly profiles = new Map<string, CitizenProfileResponse>();

  async findByPrincipal(principal: AuthenticatedPrincipal): Promise<CitizenProfileResponse | null> {
    return cloneNullable(this.profiles.get(this.profileKey(principal)) ?? null);
  }

  async save(profile: CitizenProfileResponse): Promise<void> {
    this.profiles.set(this.profileKeyFromProfile(profile), cloneProfile(profile));
  }

  private profileKey(principal: AuthenticatedPrincipal): string {
    return `${principal.tenantId}:${principal.subject}`;
  }

  private profileKeyFromProfile(profile: CitizenProfileResponse): string {
    return `${profile.tenant_id}:${profile.keycloak_subject}`;
  }
}

function cloneNullable(profile: CitizenProfileResponse | null): CitizenProfileResponse | null {
  return profile ? cloneProfile(profile) : null;
}

function cloneProfile(profile: CitizenProfileResponse): CitizenProfileResponse {
  return { ...profile };
}
