import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ServicesService } from '../services/services.service';
import { TenantsService } from '../tenants/tenants.service';

import { CitizenService } from './citizen.service';
import { InMemoryCitizenStore } from './in-memory-citizen.store';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

describe('CitizenService', () => {
  const principal: AuthenticatedPrincipal = {
    subject: 'keycloak-user-1',
    tenantId: '11111111-1111-4111-8111-111111111111',
    tenantCode: 'KMC',
    roles: ['citizen'],
    expiresAt: new Date('2026-05-07T12:00:00.000Z'),
  };

  let service: CitizenService;

  beforeEach(() => {
    service = new CitizenService(
      new TenantsService(),
      new ServicesService(),
      new InMemoryCitizenStore(),
    );
  });

  it('registers and returns a citizen profile bound to the JWT tenant', async () => {
    const profile = await service.register(principal, {
      mobile: '9876543210',
      name: 'Aritra Sen',
      language_pref: 'bn',
    });

    expect(profile).toMatchObject({
      keycloak_subject: principal.subject,
      tenant_id: principal.tenantId,
      tenant_code: 'KMC',
      mobile: '9876543210',
      name: 'Aritra Sen',
      language_pref: 'bn',
      pinned_tenant_codes: [],
      pinned_services: [],
    });
  });

  it('selects a tenant and returns theme metadata for the empty home', async () => {
    const result = await service.selectTenant(principal, { tenant_code: 'HMC' });

    expect(result).toEqual({
      selected_tenant_code: 'HMC',
      tenant_name: 'Howrah Municipal Corporation',
      theme_color: '#1B5E20',
      ward_count: 66,
    });
  });

  it("keeps two tenants' citizen profiles isolated by JWT subject", async () => {
    const tenantBPrincipal: AuthenticatedPrincipal = {
      subject: 'keycloak-user-2',
      tenantId: '22222222-2222-4222-8222-222222222222',
      tenantCode: 'HMC',
      roles: ['citizen'],
      expiresAt: new Date('2026-05-07T12:00:00.000Z'),
    };

    await service.register(principal, {
      mobile: '9876543210',
      name: 'Tenant A Citizen',
      language_pref: 'en',
    });
    await service.register(tenantBPrincipal, {
      mobile: '9123456789',
      name: 'Tenant B Citizen',
      language_pref: 'hi',
    });

    await expect(service.getProfile(principal)).resolves.toMatchObject({
      tenant_code: 'KMC',
      mobile: '9876543210',
      name: 'Tenant A Citizen',
    });
    await expect(service.getProfile(tenantBPrincipal)).resolves.toMatchObject({
      tenant_code: 'HMC',
      mobile: '9123456789',
      name: 'Tenant B Citizen',
    });
  });

  it('patches pinned municipalities and rejects portal + duplicate codes', async () => {
    await service.register(principal, { mobile: '9876543210', language_pref: 'en' });

    await expect(
      service.patchPreferences(principal, { pinned_tenant_codes: ['WBPORTAL'] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.patchPreferences(principal, { pinned_tenant_codes: ['KMC', 'kmC'] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.patchPreferences(principal, {
        pinned_tenant_codes: Array.from({ length: 16 }, () => 'KMC'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.patchPreferences(principal, { pinned_tenant_codes: ['KMC'] }),
    ).resolves.toMatchObject({ pinned_tenant_codes: ['KMC'], pinned_services: [] });
  });

  it('patches favourite services using an active catalogue pair', async () => {
    await service.register(principal, { mobile: '9876543210', language_pref: 'en' });
    await service.patchPreferences(principal, { pinned_tenant_codes: ['KMC'] });

    await expect(
      service.patchPreferences(principal, {
        pinned_services: [{ tenant_code: 'KMC', service_code: 'birth-cert' }],
      }),
    ).resolves.toMatchObject({
      pinned_services: [{ tenant_code: 'KMC', service_code: 'birth-cert' }],
    });

    await expect(
      service.patchPreferences(principal, {
        pinned_services: [{ tenant_code: 'KMC', service_code: 'no-such-service' }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
