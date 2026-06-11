import { BadRequestException, Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';

import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';
import { TenantConfigService } from './tenant-config.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('tenant-config')
@ApiBearerAuth()
@Controller('tenants/:tenantCode/config')
export class TenantConfigController {
  constructor(private readonly service: TenantConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get tenant config (late fee, etc.)' })
  async get(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tenantCode') tenantCode: string,
  ) {
    assertTenantPortalStaff(principal);
    if (principal.tenantCode !== tenantCode) {
      throw new BadRequestException('Cross-tenant access denied');
    }
    if (!principal.tenantId) throw new BadRequestException('Tenant id is required');
    return this.service.getConfig(principal.tenantId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update tenant config (late fee in paise)' })
  async update(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('tenantCode') tenantCode: string,
    @Body() dto: UpdateTenantConfigDto,
  ) {
    assertTenantPortalStaff(principal);
    if (principal.tenantCode !== tenantCode) {
      throw new BadRequestException('Cross-tenant access denied');
    }
    if (!principal.tenantId || !principal.subject)
      throw new BadRequestException('Principal incomplete');
    return this.service.updateLateFee(principal.tenantId, principal.subject, dto.lateFeePaise);
  }
}
