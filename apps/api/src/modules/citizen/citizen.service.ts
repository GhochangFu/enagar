import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';

import { TenantsService } from '../tenants/tenants.service';

import type {
  CitizenProfileResponse,
  RegisterCitizenDto,
  SelectTenantDto,
  UpdateCitizenLanguageDto,
  UpdateCitizenProfileDto,
} from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@Injectable()
export class CitizenService {
  private readonly profiles = new Map<string, CitizenProfileResponse>();

  constructor(private readonly tenants: TenantsService) {}

  register(principal: AuthenticatedPrincipal, dto: RegisterCitizenDto): CitizenProfileResponse {
    const existing = this.profiles.get(principal.subject);
    const profile: CitizenProfileResponse = {
      id: existing?.id ?? randomUUID(),
      keycloak_subject: principal.subject,
      tenant_id: principal.tenantId,
      tenant_code: principal.tenantCode,
      mobile: dto.mobile,
      name: dto.name ?? existing?.name ?? null,
      holding_number: existing?.holding_number ?? null,
      language_pref: dto.language_pref ?? existing?.language_pref ?? 'en',
      selected_tenant_code: existing?.selected_tenant_code ?? principal.tenantCode,
    };

    this.profiles.set(principal.subject, profile);
    return profile;
  }

  getProfile(principal: AuthenticatedPrincipal): CitizenProfileResponse {
    return this.getOrCreateProfile(principal);
  }

  updateProfile(
    principal: AuthenticatedPrincipal,
    dto: UpdateCitizenProfileDto,
  ): CitizenProfileResponse {
    const profile = this.getOrCreateProfile(principal);
    const updated = {
      ...profile,
      name: dto.name ?? profile.name,
      holding_number: dto.holding_number ?? profile.holding_number,
    };

    this.profiles.set(principal.subject, updated);
    return updated;
  }

  updateLanguage(
    principal: AuthenticatedPrincipal,
    dto: UpdateCitizenLanguageDto,
  ): CitizenProfileResponse {
    const profile = this.getOrCreateProfile(principal);
    const updated = { ...profile, language_pref: dto.language_pref };

    this.profiles.set(principal.subject, updated);
    return updated;
  }

  selectTenant(
    principal: AuthenticatedPrincipal,
    dto: SelectTenantDto,
  ): {
    selected_tenant_code: string;
    tenant_name: string;
    theme_color: string;
    ward_count: number;
  } {
    const tenant = this.tenants.getConfig(dto.tenant_code);
    const profile = this.getOrCreateProfile(principal);

    if (!tenant.is_active) {
      throw new NotFoundException('Tenant not found');
    }

    this.profiles.set(principal.subject, {
      ...profile,
      selected_tenant_code: tenant.code,
    });

    return {
      selected_tenant_code: tenant.code,
      tenant_name: tenant.name,
      theme_color: tenant.theme_color,
      ward_count: tenant.ward_count,
    };
  }

  private getOrCreateProfile(principal: AuthenticatedPrincipal): CitizenProfileResponse {
    const existing = this.profiles.get(principal.subject);
    if (existing) {
      return existing;
    }

    const profile: CitizenProfileResponse = {
      id: randomUUID(),
      keycloak_subject: principal.subject,
      tenant_id: principal.tenantId,
      tenant_code: principal.tenantCode,
      mobile: '',
      name: null,
      holding_number: null,
      language_pref: 'en',
      selected_tenant_code: principal.tenantCode,
    };

    this.profiles.set(principal.subject, profile);
    return profile;
  }
}
