import { BadRequestException } from '@nestjs/common';

import { CITIZEN_PORTAL_TENANT_CODE, CITIZEN_PORTAL_TENANT_ID } from '../tenants/tenant.seed';
import { TenantsService } from '../tenants/tenants.service';

import { HoldingsService } from './holdings.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

const kmcCitizen: AuthenticatedPrincipal = {
  subject: 'citizen-a',
  tenantId: '11111111-1111-4111-8111-111111111111',
  tenantCode: 'KMC',
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

const hmcCitizen: AuthenticatedPrincipal = {
  subject: 'citizen-b',
  tenantId: '22222222-2222-4222-8222-222222222222',
  tenantCode: 'HMC',
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

const portalCitizen: AuthenticatedPrincipal = {
  subject: 'portal-1',
  tenantId: CITIZEN_PORTAL_TENANT_ID,
  tenantCode: CITIZEN_PORTAL_TENANT_CODE,
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

describe('HoldingsService', () => {
  let service: HoldingsService;

  beforeEach(() => {
    service = new HoldingsService(new TenantsService());
  });

  it('looks up a tenant holding and returns audit semantics', async () => {
    const result = await service.lookup(kmcCitizen, 'KMC-064-PARK-12B');

    expect(result.found).toBe(true);
    expect(result.holding?.owner_display_name).toBe('Ananya Sen');
    expect(result.audit.outcome).toBe('found');
  });

  it('does not leak holding records across tenants', async () => {
    const result = await service.lookup(hmcCitizen, 'KMC-064-PARK-12B');

    expect(result.found).toBe(false);
    expect(result.holding).toBeNull();
    expect(result.audit.outcome).toBe('not_found');
  });

  it('searches within tenant scope and rejects broad queries', async () => {
    expect(await service.search(kmcCitizen, 'Park')).toHaveLength(1);
    expect(await service.search(hmcCitizen, 'Park')).toHaveLength(0);
    await expect(service.search(kmcCitizen, 'Pa')).rejects.toThrow(BadRequestException);
  });

  it('requires municipal scope header for portal citizens', async () => {
    await expect(service.lookup(portalCitizen, 'KMC-064-PARK-12B')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('resolves holdings for portal citizens using the scope header', async () => {
    const result = await service.lookup(portalCitizen, 'KMC-064-PARK-12B', 'KMC');

    expect(result.found).toBe(true);
    expect(await service.search(portalCitizen, 'Park', 'KMC')).toHaveLength(1);
  });
});
