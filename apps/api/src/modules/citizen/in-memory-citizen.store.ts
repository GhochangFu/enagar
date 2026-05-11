import { Injectable } from '@nestjs/common';

import type { CitizenStore } from './citizen-store';
import type { CitizenProfileResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@Injectable()
export class InMemoryCitizenStore implements CitizenStore {
  /** One logical profile per `keycloak_subject` (portal Option A semantics). */
  private readonly profiles = new Map<string, CitizenProfileResponse>();

  async findByPrincipal(principal: AuthenticatedPrincipal): Promise<CitizenProfileResponse | null> {
    return cloneNullable(this.profiles.get(principal.subject) ?? null);
  }

  async save(profile: CitizenProfileResponse): Promise<void> {
    this.profiles.set(profile.keycloak_subject, cloneProfile(profile));
  }
}

function cloneNullable(profile: CitizenProfileResponse | null): CitizenProfileResponse | null {
  return profile ? cloneProfile(profile) : null;
}

function cloneProfile(profile: CitizenProfileResponse): CitizenProfileResponse {
  return { ...profile };
}
