import { randomUUID } from 'node:crypto';

import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { TenantsService } from '../tenants/tenants.service';

import { CITIZEN_STORE } from './citizen-store';

import type { CitizenStore } from './citizen-store';
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
  constructor(
    private readonly tenants: TenantsService,
    @Inject(CITIZEN_STORE)
    private readonly store: CitizenStore,
  ) {}

  async register(
    principal: AuthenticatedPrincipal,
    dto: RegisterCitizenDto,
  ): Promise<CitizenProfileResponse> {
    const existing = await this.store.findByPrincipal(principal);
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

    await this.store.save(profile);
    return profile;
  }

  getProfile(principal: AuthenticatedPrincipal): Promise<CitizenProfileResponse> {
    return this.getOrCreateProfile(principal);
  }

  updateProfile(
    principal: AuthenticatedPrincipal,
    dto: UpdateCitizenProfileDto,
  ): Promise<CitizenProfileResponse> {
    return this.updateStoredProfile(principal, dto);
  }

  private async updateStoredProfile(
    principal: AuthenticatedPrincipal,
    dto: UpdateCitizenProfileDto,
  ): Promise<CitizenProfileResponse> {
    const profile = await this.getOrCreateProfile(principal);
    const updated = {
      ...profile,
      name: dto.name ?? profile.name,
      holding_number: dto.holding_number ?? profile.holding_number,
    };

    await this.store.save(updated);
    return updated;
  }

  async updateLanguage(
    principal: AuthenticatedPrincipal,
    dto: UpdateCitizenLanguageDto,
  ): Promise<CitizenProfileResponse> {
    const profile = await this.getOrCreateProfile(principal);
    const updated = { ...profile, language_pref: dto.language_pref };

    await this.store.save(updated);
    return updated;
  }

  async selectTenant(
    principal: AuthenticatedPrincipal,
    dto: SelectTenantDto,
  ): Promise<{
    selected_tenant_code: string;
    tenant_name: string;
    theme_color: string;
    ward_count: number;
  }> {
    const tenant = this.tenants.getConfig(dto.tenant_code);
    const profile = await this.getOrCreateProfile(principal);

    if (!tenant.is_active) {
      throw new NotFoundException('Tenant not found');
    }

    await this.store.save({
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

  private async getOrCreateProfile(
    principal: AuthenticatedPrincipal,
  ): Promise<CitizenProfileResponse> {
    const existing = await this.store.findByPrincipal(principal);
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

    await this.store.save(profile);
    return profile;
  }
}
