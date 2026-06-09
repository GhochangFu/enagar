import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';

import {
  CreateLeaseAgreementDto,
  CreateRentalAssetDto,
  QueryRentalAssetsDto,
} from './dto/rental-assets.dto';
import { LeaseSchedulerService } from './lease-scheduler.service';
import { RentalAssetsService } from './rental-assets.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('rental-assets')
@ApiBearerAuth()
@Controller('rental-assets')
export class RentalAssetsController {
  constructor(
    private readonly rentalAssetsService: RentalAssetsService,
    private readonly leaseScheduler: LeaseSchedulerService,
  ) {}

  @Post()
  createAsset(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateRentalAssetDto,
  ) {
    if (!principal.tenantCode) {
      throw new BadRequestException('Tenant code is required');
    }
    return this.rentalAssetsService.createAsset(principal.tenantCode, dto);
  }

  @Get()
  getAssets(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: QueryRentalAssetsDto,
  ) {
    if (!principal.tenantCode) {
      throw new BadRequestException('Tenant code is required');
    }
    return this.rentalAssetsService.getAssets(principal.tenantCode, query);
  }

  @Post('agreements')
  createAgreement(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateLeaseAgreementDto,
  ) {
    if (!principal.tenantCode) {
      throw new BadRequestException('Tenant code is required');
    }
    return this.rentalAssetsService.createAgreement(principal.tenantCode, dto);
  }

  /**
   * Manual trigger for the daily lease scheduler pipeline (invoice generation
   * for upcoming periods + PENDING→OVERDUE flip with optional late-fee). The
   * nightly `@Cron` in `LeaseSchedulerService` keeps doing the same work at
   * 02:00; this endpoint lets a tenant operator force-run it on demand from
   * the Rental Invoices ledger page. Gated to the same staff roles that may
   * read the ledger.
   */
  @Post('scheduler/run')
  @ApiOperation({
    summary: 'Run the lease scheduler now (invoice generation + overdue flip)',
  })
  async runScheduler(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    assertTenantPortalStaff(principal);
    return this.leaseScheduler.runOnce('manual');
  }
}
