import { Controller, Get, Param } from '@nestjs/common';
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

  @Get('tenants/:tenantCode')
  listTenantServices(@Param('tenantCode') tenantCode: string): EffectiveServiceSummary[] {
    return this.services.listTenantServices(tenantCode);
  }

  @Get('tenants/:tenantCode/:serviceCode')
  getTenantService(
    @Param('tenantCode') tenantCode: string,
    @Param('serviceCode') serviceCode: string,
  ): EffectiveServiceSummary {
    return this.services.getTenantService(tenantCode, serviceCode);
  }
}
