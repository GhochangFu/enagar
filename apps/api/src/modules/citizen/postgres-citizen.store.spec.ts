import { PostgresCitizenStore } from './postgres-citizen.store';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { PrismaService } from '../../common/database/prisma.service';

const principal: AuthenticatedPrincipal = {
  subject: 'keycloak-user-1',
  tenantId: '11111111-1111-4111-8111-111111111111',
  tenantCode: 'KMC',
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

describe('PostgresCitizenStore', () => {
  it('finds a citizen profile by tenant and Keycloak subject', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tenantId: principal.tenantId,
      keycloakSubject: principal.subject,
      mobile: '9876543210',
      name: 'Aritra Sen',
      holdingNumber: '64/PARK-ST/12B',
      languagePref: 'bn',
    });
    const store = new PostgresCitizenStore({
      citizen: {
        findFirst,
      },
    } as unknown as PrismaService);

    const profile = await store.findByPrincipal(principal);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: principal.tenantId,
        keycloakSubject: principal.subject,
      },
    });
    expect(profile).toMatchObject({
      keycloak_subject: principal.subject,
      tenant_id: principal.tenantId,
      tenant_code: 'KMC',
      mobile: '9876543210',
      language_pref: 'bn',
    });
  });

  it('upserts a citizen profile using tenant and Keycloak subject', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const store = new PostgresCitizenStore({
      citizen: {
        upsert,
      },
    } as unknown as PrismaService);

    await store.save({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      keycloak_subject: principal.subject,
      tenant_id: principal.tenantId,
      tenant_code: 'KMC',
      mobile: '9876543210',
      name: 'Aritra Sen',
      holding_number: '64/PARK-ST/12B',
      language_pref: 'bn',
      selected_tenant_code: 'KMC',
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        tenantId_keycloakSubject: {
          tenantId: principal.tenantId,
          keycloakSubject: principal.subject,
        },
      },
      create: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tenantId: principal.tenantId,
        keycloakSubject: principal.subject,
        mobile: '9876543210',
        name: 'Aritra Sen',
        holdingNumber: '64/PARK-ST/12B',
        languagePref: 'bn',
      },
      update: {
        mobile: '9876543210',
        name: 'Aritra Sen',
        holdingNumber: '64/PARK-ST/12B',
        languagePref: 'bn',
      },
    });
  });
});
