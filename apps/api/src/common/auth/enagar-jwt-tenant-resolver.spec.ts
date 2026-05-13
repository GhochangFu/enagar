import {
  JwtTenantClaimError,
  resolveEnagarTenantFromJwtPayload,
} from './enagar-jwt-tenant-resolver';

import type { JWTPayload } from 'jose';

describe('resolveEnagarTenantFromJwtPayload (Hub H5.1 JWT claim synonyms)', () => {
  const base = (): JWTPayload => ({
    iss: 'http://localhost:8080/realms/enagar',
    sub: 'operator-1',
    exp: Math.floor(Date.now() / 1000) + 60,
  });

  it('accepts snake_case tenant_id (canonical)', () => {
    expect(
      resolveEnagarTenantFromJwtPayload({
        ...base(),
        tenant_id: '11111111-1111-4111-8111-111111111111',
        tenant_code: 'KMC',
      }),
    ).toEqual({
      tenantId: '11111111-1111-4111-8111-111111111111',
      tenantCode: 'KMC',
    });
  });

  it('accepts camelCase tenantId when tenant_id is absent', () => {
    expect(
      resolveEnagarTenantFromJwtPayload({
        ...base(),
        tenantId: '44444444-4444-4444-8444-444444444444',
        tenantCode: 'BMC',
      }),
    ).toEqual({
      tenantId: '44444444-4444-4444-8444-444444444444',
      tenantCode: 'BMC',
    });
  });

  it('prefers tenant_id when only one side is set (snake wins over empty camel)', () => {
    expect(
      resolveEnagarTenantFromJwtPayload({
        ...base(),
        tenant_id: '55555555-5555-4555-8555-555555555555',
      }),
    ).toMatchObject({
      tenantId: '55555555-5555-4555-8555-555555555555',
    });
  });

  it('rejects when tenant_id and tenantId disagree', () => {
    expect(() =>
      resolveEnagarTenantFromJwtPayload({
        ...base(),
        tenant_id: '11111111-1111-4111-8111-111111111111',
        tenantId: '22222222-2222-4222-8222-222222222222',
      }),
    ).toThrow(JwtTenantClaimError);
  });

  it('rejects when tenant_code and tenantCode disagree', () => {
    expect(() =>
      resolveEnagarTenantFromJwtPayload({
        ...base(),
        tenant_id: '11111111-1111-4111-8111-111111111111',
        tenant_code: 'KMC',
        tenantCode: 'HMC',
      }),
    ).toThrow(JwtTenantClaimError);
  });

  it('rejects missing tenant identifiers', () => {
    expect(() => resolveEnagarTenantFromJwtPayload(base())).toThrow(JwtTenantClaimError);
  });
});
