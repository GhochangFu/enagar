import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { AdminTenantService } from './admin-tenant.service';
import { PatchTenantServiceDto } from './dto/patch-tenant-service.dto';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('admin-tenant')
@ApiBearerAuth()
@Controller('admin/tenant')
export class AdminTenantController {
  constructor(private readonly adminTenant: AdminTenantService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Tenant-scoped KPI snapshot for the admin portal dashboard' })
  getDashboard(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.getDashboard(principal);
  }

  @Get('services')
  @ApiOperation({ summary: 'List Postgres-backed tenant services (`services` table)' })
  listServices(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.adminTenant.listServices(principal);
  }

  @Patch('services/:serviceId')
  @ApiOperation({
    summary: 'Patch catalogue fields for one tenant service (active flag, labels, SLA days)',
  })
  patchService(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('serviceId') serviceId: string,
    @Body() dto: PatchTenantServiceDto,
  ) {
    return this.adminTenant.patchService(principal, serviceId, dto);
  }
}
