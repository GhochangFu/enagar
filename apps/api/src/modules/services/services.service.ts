import { Injectable, NotFoundException } from '@nestjs/common';

import { tenantSeeds } from '../tenants/tenant.seed';

import {
  getEffectiveService,
  globalServices,
  resolveEffectiveServices,
  revenueHeads,
  serviceCategories,
} from './service-catalogue.seed';

import type {
  EffectiveServiceSummary,
  GlobalServiceSeed,
  RevenueHeadSeed,
  ServiceCategorySeed,
} from './service-catalogue.seed';

@Injectable()
export class ServicesService {
  listCategories(): ServiceCategorySeed[] {
    return [...serviceCategories].sort((left, right) => left.sort_order - right.sort_order);
  }

  listRevenueHeads(): RevenueHeadSeed[] {
    return [...revenueHeads].sort((left, right) => left.code.localeCompare(right.code));
  }

  listGlobalServices(): GlobalServiceSeed[] {
    return [...globalServices].sort((left, right) => left.code.localeCompare(right.code));
  }

  listTenantServices(tenantCode: string): EffectiveServiceSummary[] {
    this.assertTenantExists(tenantCode);

    return resolveEffectiveServices(tenantCode)
      .filter((service) => service.active)
      .map((service) => ({ ...service }));
  }

  getTenantService(tenantCode: string, serviceCode: string): EffectiveServiceSummary {
    this.assertTenantExists(tenantCode);

    const service = getEffectiveService(tenantCode, serviceCode);
    if (!service?.active) {
      throw new NotFoundException('Service not found');
    }

    return { ...service };
  }

  private assertTenantExists(tenantCode: string): void {
    const tenant = tenantSeeds.find(
      (candidate) => candidate.code.toLowerCase() === tenantCode.toLowerCase(),
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
  }
}
