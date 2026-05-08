import type { CitizenProfileResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

export const CITIZEN_STORE = 'CITIZEN_STORE';

export interface CitizenStore {
  findByPrincipal(principal: AuthenticatedPrincipal): Promise<CitizenProfileResponse | null>;
  save(profile: CitizenProfileResponse): Promise<void>;
}
