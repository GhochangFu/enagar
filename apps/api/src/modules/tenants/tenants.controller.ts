import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/auth/public.decorator';

import { TenantsService } from './tenants.service';

import type { TenantConfigResponse, TenantSummary } from './tenant.seed';
import type { TenantPublicBanner } from './tenants.service';

@ApiTags('tenants')
@Public()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  list(): TenantSummary[] {
    return this.tenants.list();
  }

  @Get(':id/config')
  getConfig(@Param('id') id: string): TenantConfigResponse {
    return this.tenants.getConfig(id);
  }

  @Get(':id/banners')
  listBanners(@Param('id') id: string): Promise<TenantPublicBanner[]> {
    return this.tenants.listActiveBanners(id);
  }
}
