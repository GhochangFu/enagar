import { BadRequestException } from '@nestjs/common';

import { CITIZEN_PORTAL_TENANT_CODE, tenantSeeds } from '../../modules/tenants/tenant.seed';

import {
  assertActiveMunicipalityTenantCode,
  isCitizenSelfServicePrincipal,
  parseTenantScopeHeader,
  principalIsCitizenPortal,
} from './citizen-scope';

import type { AuthenticatedPrincipal } from './jwt-claims';

describe('citizen-scope', () => {
  const catalogue = tenantSeeds;

  describe('parseTenantScopeHeader', () => {
    it('reads lowercase header key', () => {
      expect(
        parseTenantScopeHeader({
          'x-enagar-tenant-code': ' kmc ',
        }),
      ).toBe('kmc');
    });

    it('returns undefined when missing', () => {
      expect(parseTenantScopeHeader({})).toBeUndefined();
    });
  });

  describe('principalIsCitizenPortal', () => {
    it('detects WBPORTAL', () => {
      expect(
        principalIsCitizenPortal({
          tenantCode: 'WBPORTAL',
        } as AuthenticatedPrincipal),
      ).toBe(true);
      expect(principalIsCitizenPortal({ tenantCode: 'KMC' } as AuthenticatedPrincipal)).toBe(false);
    });
  });

  describe('isCitizenSelfServicePrincipal', () => {
    it('citizen without staff escalation', () => {
      expect(isCitizenSelfServicePrincipal({ roles: ['citizen'] } as AuthenticatedPrincipal)).toBe(
        true,
      );
      expect(isCitizenSelfServicePrincipal({ roles: ['citizen', 'tenant_admin'] })).toBe(false);
    });
  });

  describe('assertActiveMunicipalityTenantCode', () => {
    it('accepts municipal codes', () => {
      expect(assertActiveMunicipalityTenantCode('kmc', catalogue)).toBe('KMC');
    });

    it('rejects portal', () => {
      expect(() =>
        assertActiveMunicipalityTenantCode(CITIZEN_PORTAL_TENANT_CODE, catalogue),
      ).toThrow(BadRequestException);
    });

    it('rejects unknown', () => {
      expect(() => assertActiveMunicipalityTenantCode('ZZZ', catalogue)).toThrow(
        BadRequestException,
      );
    });
  });
});
