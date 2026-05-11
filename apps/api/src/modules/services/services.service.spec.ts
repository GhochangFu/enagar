import { performance } from 'node:perf_hooks';

import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  globalServices,
  revenueHeads,
  serviceCategories,
  tenantServiceOverrides,
} from './service-catalogue.seed';
import { ServicesService } from './services.service';

describe('ServicesService', () => {
  const service = new ServicesService();

  it('returns the 14 canonical service categories with translations', () => {
    const categories = service.listCategories();

    expect(categories).toHaveLength(14);
    expect(categories[0]).toMatchObject({
      code: 'certificates',
      name: {
        en: expect.any(String),
        bn: expect.any(String),
        hi: expect.any(String),
      },
    });
  });

  it('resolves default global services for a tenant', () => {
    const services = service.listTenantServices('KMC');

    expect(services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenant_code: 'KMC',
          code: 'prop-tax',
          source: 'global',
        }),
      ]),
    );
  });

  it('applies fee and SLA overrides without changing immutable service identity', () => {
    const birthCertificate = service.getTenantService('KMC', 'birth-cert');

    expect(birthCertificate).toMatchObject({
      code: 'birth-cert',
      category_code: 'certificates',
      source: 'tenant_override',
      sla_days: 5,
      fee_config: {
        urgent_amount_paise: 15000,
      },
      pushes_to_digilocker: true,
    });
  });

  it('hides disabled tenant services from citizen-safe reads', () => {
    expect(service.listTenantServices('HMC').some((item) => item.code === 'community-hall')).toBe(
      false,
    );
    expect(() => service.getTenantService('HMC', 'community-hall')).toThrow(NotFoundException);
  });

  it('includes tenant-only custom services only for that tenant', () => {
    expect(service.getTenantService('KMC', 'pet-licence')).toMatchObject({
      source: 'tenant_only',
      tenant_code: 'KMC',
    });
    expect(service.listTenantServices('HMC').some((item) => item.code === 'pet-licence')).toBe(
      false,
    );
  });

  it('rejects unknown tenants and unknown service codes', () => {
    expect(() => service.listTenantServices('NOPE')).toThrow(NotFoundException);
    expect(() => service.getTenantService('KMC', 'missing-service')).toThrow(NotFoundException);
  });

  it('resolves tenant catalogues within a local smoke budget', () => {
    const start = performance.now();

    for (let index = 0; index < 500; index += 1) {
      service.listTenantServices(index % 2 === 0 ? 'KMC' : 'HMC');
    }

    expect(performance.now() - start).toBeLessThan(100);
  });

  it('maps catalogue revenue heads to GL accounting codes', () => {
    const birth = service.getTenantService('KMC', 'birth-cert');
    expect(service.resolveLedgerCodesForService(birth)).toEqual({
      revenue_head_code: 'cert-fee',
      accounting_code: 'RH-CERT',
    });
  });

  it('blocks GL lookups when catalogue revenue heads are absent', () => {
    const sanitation = service.getTenantService('KMC', 'sanitation-grievance');
    expect(() => service.resolveLedgerCodesForService(sanitation)).toThrow(BadRequestException);
  });
});

describe('Sprint 2.1 service catalogue seed integrity', () => {
  it('keeps service category codes unique and translated', () => {
    expectUnique(serviceCategories.map((category) => category.code));

    for (const category of serviceCategories) {
      expect(category.name).toEqual({
        en: expect.any(String),
        bn: expect.any(String),
        hi: expect.any(String),
      });
    }
  });

  it('keeps revenue head codes unique and translated', () => {
    expectUnique(revenueHeads.map((head) => head.code));

    for (const head of revenueHeads) {
      expect(head.name).toEqual({
        en: expect.any(String),
        bn: expect.any(String),
        hi: expect.any(String),
      });
    }
  });

  it('keeps global service references valid', () => {
    const categoryCodes = new Set(serviceCategories.map((category) => category.code));
    const revenueHeadCodes = new Set(revenueHeads.map((head) => head.code));

    expectUnique(globalServices.map((item) => item.code));

    for (const item of globalServices) {
      expect(categoryCodes.has(item.category_code)).toBe(true);
      if (item.revenue_head_code) {
        expect(revenueHeadCodes.has(item.revenue_head_code)).toBe(true);
      }
      expect(item.name.en).toBeTruthy();
      expect(item.name.bn).toBeTruthy();
      expect(item.name.hi).toBeTruthy();
    }
  });

  it('keeps tenant overrides pointed at known global or tenant-only services', () => {
    const globalServiceCodes = new Set(globalServices.map((item) => item.code));
    const categoryCodes = new Set(serviceCategories.map((category) => category.code));

    for (const override of tenantServiceOverrides) {
      if (override.tenant_only) {
        expect(override.category_code ? categoryCodes.has(override.category_code) : true).toBe(
          true,
        );
      } else {
        expect(globalServiceCodes.has(override.service_code)).toBe(true);
      }
    }
  });
});

function expectUnique(values: string[]): void {
  expect(new Set(values).size).toBe(values.length);
}
