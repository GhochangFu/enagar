import { BadRequestException } from '@nestjs/common';

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

describe('HoldingsService', () => {
  let service: HoldingsService;

  beforeEach(() => {
    service = new HoldingsService();
  });

  it('looks up a tenant holding and returns audit semantics', () => {
    const result = service.lookup(kmcCitizen, 'KMC-064-PARK-12B');

    expect(result.found).toBe(true);
    expect(result.holding?.owner_display_name).toBe('Ananya Sen');
    expect(result.audit.outcome).toBe('found');
  });

  it('does not leak holding records across tenants', () => {
    const result = service.lookup(hmcCitizen, 'KMC-064-PARK-12B');

    expect(result.found).toBe(false);
    expect(result.holding).toBeNull();
    expect(result.audit.outcome).toBe('not_found');
  });

  it('searches within tenant scope and rejects broad queries', () => {
    expect(service.search(kmcCitizen, 'Park')).toHaveLength(1);
    expect(service.search(hmcCitizen, 'Park')).toHaveLength(0);
    expect(() => service.search(kmcCitizen, 'Pa')).toThrow(BadRequestException);
  });
});
