import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { ServicesService } from '../services/services.service';
import { TenantsService } from '../tenants/tenants.service';

import { CITIZEN_STORE } from './citizen-store';

import type { CitizenStore } from './citizen-store';
import type {
  CitizenNotificationResponse,
  CitizenPreferencesResponse,
  CitizenProfileResponse,
  PatchCitizenPreferencesDto,
  PinnedServicePreference,
  PinnedServicePreferenceDto,
  RegisterCitizenDto,
  RegisterPushTokenDto,
  SelectTenantDto,
  UpdateCitizenLanguageDto,
  UpdateCitizenProfileDto,
} from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@Injectable()
export class CitizenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
    private readonly catalogue: ServicesService,
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
      pinned_tenant_codes: [...(existing?.pinned_tenant_codes ?? [])],
      pinned_services: (existing?.pinned_services ?? []).map((row) => ({ ...row })),
    };

    await this.store.save(profile);
    return profile;
  }

  getProfile(principal: AuthenticatedPrincipal): Promise<CitizenProfileResponse> {
    return this.getOrCreateProfile(principal);
  }

  async getPreferences(principal: AuthenticatedPrincipal): Promise<CitizenPreferencesResponse> {
    const profile = await this.getOrCreateProfile(principal);
    return profileToPreferenceSlice(profile);
  }

  async patchPreferences(
    principal: AuthenticatedPrincipal,
    dto: PatchCitizenPreferencesDto,
  ): Promise<CitizenPreferencesResponse> {
    const profile = await this.getOrCreateProfile(principal);

    const nextPins =
      dto.pinned_tenant_codes !== undefined
        ? await this.normalizePinnedTenantCodes(dto.pinned_tenant_codes)
        : [...profile.pinned_tenant_codes];

    const nextServices =
      dto.pinned_services !== undefined
        ? await this.normalizePinnedServices(dto.pinned_services)
        : profile.pinned_services.map((row) => ({ ...row }));

    const updated: CitizenProfileResponse = {
      ...profile,
      pinned_tenant_codes: nextPins,
      pinned_services: nextServices,
    };

    await this.store.save(updated);
    return profileToPreferenceSlice(updated);
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
    const tenant = await this.tenants.getConfig(dto.tenant_code);
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

  async listNotifications(
    principal: AuthenticatedPrincipal,
  ): Promise<CitizenNotificationResponse[]> {
    const sub = principal.subject?.trim();
    if (!sub) {
      throw new UnauthorizedException('Subject required');
    }
    if (!principal.roles.includes('citizen')) {
      throw new ForbiddenException('Citizen role required');
    }

    const rows = await this.prisma.notification.findMany({
      where: { citizen: { keycloakSubject: sub } },
      orderBy: { sentAt: 'desc' },
      take: 100,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        deepLink: true,
        isRead: true,
        sentAt: true,
        readAt: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      deep_link: r.deepLink,
      is_read: r.isRead,
      sent_at: r.sentAt.toISOString(),
      read_at: r.readAt?.toISOString() ?? null,
    }));
  }

  async registerPushToken(
    principal: AuthenticatedPrincipal,
    dto: RegisterPushTokenDto,
  ): Promise<{ ok: true }> {
    const sub = principal.subject?.trim();
    if (!sub) {
      throw new UnauthorizedException('Subject required');
    }
    if (!principal.roles.includes('citizen')) {
      throw new ForbiddenException('Citizen role required');
    }

    const profile = await this.getOrCreateProfile(principal);

    await this.prisma.citizenPushDevice.upsert({
      where: {
        citizenId_token: {
          citizenId: profile.id,
          token: dto.token,
        },
      },
      create: {
        tenantId: profile.tenant_id,
        citizenId: profile.id,
        platform: dto.platform,
        token: dto.token,
      },
      update: {
        platform: dto.platform,
      },
    });

    return { ok: true };
  }

  async markNotificationRead(
    principal: AuthenticatedPrincipal,
    notificationId: string,
  ): Promise<{ ok: true }> {
    const sub = principal.subject?.trim();
    if (!sub) {
      throw new UnauthorizedException('Subject required');
    }
    if (!principal.roles.includes('citizen')) {
      throw new ForbiddenException('Citizen role required');
    }

    const rowFirst = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        citizen: { keycloakSubject: sub },
      },
    });
    if (!rowFirst) {
      throw new NotFoundException('Notification not found');
    }
    if (!rowFirst.isRead) {
      await this.prisma.notification.update({
        where: { id: rowFirst.id },
        data: { isRead: true, readAt: new Date() },
      });
    }
    return { ok: true };
  }

  /** Maps each incoming code (post-DTO uniqueness) onto an operational municipality from `GET /tenants`. */
  private async normalizePinnedTenantCodes(rawCodes: string[]): Promise<string[]> {
    if (!rawCodes.length) {
      throw new BadRequestException('At least one pinned municipality is required');
    }
    if (rawCodes.length > 15) {
      throw new BadRequestException('At most 15 pinned municipalities are allowed');
    }

    const seen = new Set<string>();
    const ordered: string[] = [];

    for (const raw of rawCodes) {
      const canonical = await this.resolveOperationalTenantCode(raw.trim());
      const key = canonical.toLowerCase();

      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate municipality pin: ${canonical}`);
      }

      seen.add(key);
      ordered.push(canonical);
    }

    return ordered;
  }

  private async normalizePinnedServices(
    entries: PinnedServicePreferenceDto[],
  ): Promise<PinnedServicePreference[]> {
    const seenPairKeys = new Set<string>();
    const ordered: PinnedServicePreference[] = [];

    for (const row of entries) {
      const tenantCode = await this.resolveOperationalTenantCode(row.tenant_code.trim());
      const summary = await this.catalogue.getTenantService(tenantCode, row.service_code.trim());
      const pairKey = `${tenantCode.toLowerCase()}:${summary.code.toLowerCase()}`;
      if (seenPairKeys.has(pairKey)) {
        continue;
      }
      seenPairKeys.add(pairKey);
      ordered.push({ tenant_code: tenantCode, service_code: summary.code });
    }

    return ordered;
  }

  private async resolveOperationalTenantCode(raw: string): Promise<string> {
    const catalogue = await this.tenants.list();
    const match = catalogue.find((tenant) => tenant.code.toLowerCase() === raw.toLowerCase());

    if (!match) {
      throw new BadRequestException(`Unknown or inactive municipality: ${raw}`);
    }

    return match.code;
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
      pinned_tenant_codes: [],
      pinned_services: [],
    };

    await this.store.save(profile);
    return profile;
  }
}

function profileToPreferenceSlice(profile: CitizenProfileResponse): CitizenPreferencesResponse {
  return {
    pinned_tenant_codes: [...profile.pinned_tenant_codes],
    pinned_services: profile.pinned_services.map((row) => ({ ...row })),
  };
}
