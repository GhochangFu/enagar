import { CITIZEN_PORTAL_TENANT_ID } from '../tenants/tenant.seed';

import { PostgresCitizenStore } from './postgres-citizen.store';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { PrismaService } from '../../common/database/prisma.service';

const emptyPins = { pinnedTenantCodes: [], pinnedServices: [] };

const municipalPrincipal: AuthenticatedPrincipal = {
  subject: 'keycloak-user-1',
  tenantId: '11111111-1111-4111-8111-111111111111',
  tenantCode: 'KMC',
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

const portalPrincipal: AuthenticatedPrincipal = {
  subject: 'dev-citizen-9876543210',
  tenantId: CITIZEN_PORTAL_TENANT_ID,
  tenantCode: 'WBPORTAL',
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

describe('PostgresCitizenStore', () => {
  it('returns portal-linked profile when Option A JWT is used', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenantId: CITIZEN_PORTAL_TENANT_ID,
      keycloakSubject: portalPrincipal.subject,
      mobile: '9876543210',
      name: null,
      holdingNumber: null,
      languagePref: 'en',
      selectedTenantCode: 'HMC',
      ...emptyPins,
    });
    const findFirst = jest.fn();

    const store = new PostgresCitizenStore({
      citizen: {
        findUnique,
        findFirst,
      },
    } as unknown as PrismaService);

    const profile = await store.findByPrincipal(portalPrincipal);

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_keycloakSubject: {
          tenantId: CITIZEN_PORTAL_TENANT_ID,
          keycloakSubject: portalPrincipal.subject,
        },
      },
    });
    expect(findFirst).not.toHaveBeenCalled();
    expect(profile).toMatchObject({
      keycloak_subject: portalPrincipal.subject,
      tenant_code: 'WBPORTAL',
      selected_tenant_code: 'HMC',
      pinned_tenant_codes: [],
      pinned_services: [],
    });
  });

  it('falls back to most recently updated municipal row when portal composite row is absent', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const findFirst = jest.fn().mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      tenantId: municipalPrincipal.tenantId,
      keycloakSubject: portalPrincipal.subject,
      mobile: '9876543210',
      name: 'Legacy',
      holdingNumber: null,
      languagePref: 'bn',
      selectedTenantCode: null,
      ...emptyPins,
    });

    const store = new PostgresCitizenStore({
      citizen: {
        findUnique,
        findFirst,
      },
    } as unknown as PrismaService);

    const profile = await store.findByPrincipal(portalPrincipal);

    expect(findFirst).toHaveBeenCalledWith({
      where: { keycloakSubject: portalPrincipal.subject },
      orderBy: { updatedAt: 'desc' },
    });
    expect(profile?.tenant_id).toBe(municipalPrincipal.tenantId);
    expect(profile?.tenant_code).toBe('WBPORTAL');
    expect(profile?.selected_tenant_code).toBeUndefined();
  });

  it('still resolves municipal-jwt principals once portal-first lookup misses', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const findFirst = jest.fn().mockResolvedValue({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      tenantId: municipalPrincipal.tenantId,
      keycloakSubject: municipalPrincipal.subject,
      mobile: '9876543210',
      name: 'A',
      holdingNumber: '64/PARK-ST/12B',
      languagePref: 'bn',
      selectedTenantCode: null,
      pinnedTenantCodes: ['KMC'],
      pinnedServices: [{ tenant_code: 'KMC', service_code: 'birth-cert' }],
    });

    const store = new PostgresCitizenStore({
      citizen: {
        findUnique,
        findFirst,
      },
    } as unknown as PrismaService);

    const profile = await store.findByPrincipal(municipalPrincipal);

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_keycloakSubject: {
          tenantId: CITIZEN_PORTAL_TENANT_ID,
          keycloakSubject: municipalPrincipal.subject,
        },
      },
    });
    expect(findFirst).toHaveBeenCalled();
    expect(profile).toMatchObject({
      keycloak_subject: municipalPrincipal.subject,
      tenant_id: municipalPrincipal.tenantId,
      tenant_code: 'KMC',
      mobile: '9876543210',
      language_pref: 'bn',
      pinned_tenant_codes: ['KMC'],
      pinned_services: [{ tenant_code: 'KMC', service_code: 'birth-cert' }],
    });
  });

  it('upserts citizen profile including selectedTenantCode and pin JSON', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const store = new PostgresCitizenStore({
      citizen: {
        upsert,
      },
    } as unknown as PrismaService);

    await store.save({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      keycloak_subject: municipalPrincipal.subject,
      tenant_id: municipalPrincipal.tenantId,
      tenant_code: 'KMC',
      mobile: '9876543210',
      name: 'Aritra Sen',
      holding_number: '64/PARK-ST/12B',
      language_pref: 'bn',
      selected_tenant_code: 'HMC',
      pinned_tenant_codes: ['KMC', 'HMC'],
      pinned_services: [{ tenant_code: 'KMC', service_code: 'birth-cert' }],
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        tenantId_keycloakSubject: {
          tenantId: municipalPrincipal.tenantId,
          keycloakSubject: municipalPrincipal.subject,
        },
      },
      create: expect.objectContaining({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tenantId: municipalPrincipal.tenantId,
        keycloakSubject: municipalPrincipal.subject,
        mobile: '9876543210',
        name: 'Aritra Sen',
        holdingNumber: '64/PARK-ST/12B',
        languagePref: 'bn',
        selectedTenantCode: 'HMC',
        pinnedTenantCodes: ['KMC', 'HMC'],
        pinnedServices: [{ tenant_code: 'KMC', service_code: 'birth-cert' }],
      }),
      update: expect.objectContaining({
        mobile: '9876543210',
        name: 'Aritra Sen',
        holdingNumber: '64/PARK-ST/12B',
        languagePref: 'bn',
        selectedTenantCode: 'HMC',
        pinnedTenantCodes: ['KMC', 'HMC'],
        pinnedServices: [{ tenant_code: 'KMC', service_code: 'birth-cert' }],
      }),
    });
  });
});
