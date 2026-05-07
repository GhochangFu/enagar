import { Injectable, NotFoundException } from '@nestjs/common';

import { tenantSeeds, type TenantConfigResponse, type TenantSummary } from './tenant.seed';

@Injectable()
export class TenantsService {
  list(): TenantSummary[] {
    return tenantSeeds.filter((tenant) => tenant.is_active);
  }

  getConfig(idOrCode: string): TenantConfigResponse {
    const tenant = tenantSeeds.find(
      (candidate) =>
        candidate.id === idOrCode || candidate.code.toLowerCase() === idOrCode.toLowerCase(),
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      ...tenant,
      config: {
        default_language: 'en',
        service_summary: {
          total_services: 76,
          categories: 14,
        },
        feature_flags: {
          digilocker_enabled: false,
          tenant_switcher_enabled: true,
        },
      },
    };
  }
}
