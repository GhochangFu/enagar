import { BadRequestException } from '@nestjs/common';

import {
  CITIZEN_PORTAL_TENANT_CODE,
  CITIZEN_PORTAL_TENANT_ID,
  tenantSeeds,
} from '../../modules/tenants/tenant.seed';
import { TenantsService } from '../../modules/tenants/tenants.service';

import {
  assertActiveMunicipalityTenantCode,
  citizenHubRowAccessibleByTenant,
  isCitizenSelfServicePrincipal,
  parseTenantScopeHeader,
  principalIsCitizenPortal,
  resolveCitizenMunicipalityForWrite,
  resolveMunicipalityTenantIdFromScopeCode,
} from './citizen-scope';

import type { AuthenticatedPrincipal } from './jwt-claims';

const portalPrincipal: AuthenticatedPrincipal = {
  subject: 's0',
  tenantId: CITIZEN_PORTAL_TENANT_ID,
  tenantCode: CITIZEN_PORTAL_TENANT_CODE,
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

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

  describe('resolveMunicipalityTenantIdFromScopeCode', () => {
    it('returns KMC id', () => {
      expect(resolveMunicipalityTenantIdFromScopeCode('kmc')).toBe(
        '11111111-1111-4111-8111-111111111111',
      );
    });

    it('returns undefined for unknown codes', () => {
      expect(resolveMunicipalityTenantIdFromScopeCode('ZZZ')).toBeUndefined();
    });
  });

  describe('citizenHubRowAccessibleByTenant', () => {
    it('allows portal subject match across tenant rows when unscoped', () => {
      expect(
        citizenHubRowAccessibleByTenant(
          portalPrincipal,
          {
            tenant_id: '11111111-1111-4111-8111-111111111111',
            citizen_subject: portalPrincipal.subject,
          },
          undefined,
        ),
      ).toBe(true);
    });

    it('scopes portal rows to resolved tenant id', () => {
      const scopedPortal = { ...portalPrincipal, subject: 'scoped-sub' };
      expect(
        citizenHubRowAccessibleByTenant(
          scopedPortal,
          { tenant_id: '22222222-2222-4222-8222-222222222222', citizen_subject: 'scoped-sub' },
          { municipalityTenantCode: 'HMC' },
        ),
      ).toBe(true);
      expect(
        citizenHubRowAccessibleByTenant(
          scopedPortal,
          { tenant_id: '11111111-1111-4111-8111-111111111111', citizen_subject: 'scoped-sub' },
          { municipalityTenantCode: 'HMC' },
        ),
      ).toBe(false);
    });
  });

  describe('resolveCitizenMunicipalityForWrite', () => {
    const catalogue = new TenantsService().list();

    const kmcPrincipal: AuthenticatedPrincipal = {
      subject: 'k',
      tenantId: '11111111-1111-4111-8111-111111111111',
      tenantCode: 'KMC',
      roles: ['citizen'],
      expiresAt: new Date('2026-05-08T00:00:00.000Z'),
    };

    it('requires header for portal principal', () => {
      expect(() => resolveCitizenMunicipalityForWrite(portalPrincipal, catalogue)).toThrow(
        BadRequestException,
      );
    });

    it('resolves KMC for portal + header', () => {
      expect(resolveCitizenMunicipalityForWrite(portalPrincipal, catalogue, 'KMC')).toEqual({
        tenantId: '11111111-1111-4111-8111-111111111111',
        tenantCode: 'KMC',
      });
    });

    it('uses JWT tenant for municipal principal', () => {
      expect(resolveCitizenMunicipalityForWrite(kmcPrincipal, catalogue)).toEqual({
        tenantId: kmcPrincipal.tenantId,
        tenantCode: 'KMC',
      });
    });
  });
});
