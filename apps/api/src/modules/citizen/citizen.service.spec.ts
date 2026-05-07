import { TenantsService } from '../tenants/tenants.service';

import { CitizenService } from './citizen.service';

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
    service = new CitizenService(new TenantsService());
  });

  it('registers and returns a citizen profile bound to the JWT tenant', () => {
    const profile = service.register(principal, {
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
    });
  });

  it('selects a tenant and returns theme metadata for the empty home', () => {
    const result = service.selectTenant(principal, { tenant_code: 'HMC' });

    expect(result).toEqual({
      selected_tenant_code: 'HMC',
      tenant_name: 'Howrah Municipal Corporation',
      theme_color: '#1B5E20',
      ward_count: 66,
    });
  });

  it("keeps two tenants' citizen profiles isolated by JWT subject", () => {
    const tenantBPrincipal: AuthenticatedPrincipal = {
      subject: 'keycloak-user-2',
      tenantId: '22222222-2222-4222-8222-222222222222',
      tenantCode: 'HMC',
      roles: ['citizen'],
      expiresAt: new Date('2026-05-07T12:00:00.000Z'),
    };

    service.register(principal, {
      mobile: '9876543210',
      name: 'Tenant A Citizen',
      language_pref: 'en',
    });
    service.register(tenantBPrincipal, {
      mobile: '9123456789',
      name: 'Tenant B Citizen',
      language_pref: 'hi',
    });

    expect(service.getProfile(principal)).toMatchObject({
      tenant_code: 'KMC',
      mobile: '9876543210',
      name: 'Tenant A Citizen',
    });
    expect(service.getProfile(tenantBPrincipal)).toMatchObject({
      tenant_code: 'HMC',
      mobile: '9123456789',
      name: 'Tenant B Citizen',
    });
  });
});
