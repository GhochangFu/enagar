import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/auth/public.decorator';

import { ServicesService } from './services.service';

import type {
  EffectiveServiceSummary,
  GlobalServiceSeed,
  RevenueHeadSeed,
  ServiceCategorySeed,
} from './service-catalogue.seed';

@ApiTags('services')
@Public()
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get('categories')
  listCategories(): ServiceCategorySeed[] {
    return this.services.listCategories();
  }

  @Get('revenue-heads')
  listRevenueHeads(): RevenueHeadSeed[] {
    return this.services.listRevenueHeads();
  }

  @Get('global')
  listGlobalServices(): GlobalServiceSeed[] {
    return this.services.listGlobalServices();
  }

  @Get('catalogue')
  listCatalogue(
    @Query('tenant_code') tenantCode: string,
    @Query('category') globalCategory?: string,
    @Query('department_id') departmentId?: string,
  ): Promise<EffectiveServiceSummary[]> {
    return this.services.listTenantServices(tenantCode, {
      globalCategory,
      departmentId,
    });
  }

  @Get('tenants/:tenantCode')
  listTenantServices(
    @Param('tenantCode') tenantCode: string,
    @Query('global_category') globalCategory?: string,
    @Query('department_id') departmentId?: string,
  ): Promise<EffectiveServiceSummary[]> {
    return this.services.listTenantServices(tenantCode, {
      globalCategory,
      departmentId,
    });
  }

  @Get('tenants/:tenantCode/:serviceCode')
  getTenantService(
    @Param('tenantCode') tenantCode: string,
    @Param('serviceCode') serviceCode: string,
  ): Promise<EffectiveServiceSummary> {
    return this.services.getTenantService(tenantCode, serviceCode);
  }
}
