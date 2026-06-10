import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';

import {
  CreateLeaseAgreementDto,
  CreateRentalAssetDto,
  QueryRentalAssetsDto,
  UpdateLeaseAgreementDto,
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
   * Patch mutable fields on a lease agreement. Exposed from the rental-assets
   * grid's inline "edit lessor phone" affordance so an operator can attach a
   * phone to a lease that was created before the `lessorPhone` field existed
   * (or fix a typo) without opening the full amendment flow. Only
   * `lessorPhone` is writable through this endpoint by design.
   */
  @Patch('agreements/:id')
  @ApiOperation({ summary: 'Patch lease agreement fields (lessorPhone only)' })
  updateAgreement(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateLeaseAgreementDto,
  ) {
    assertTenantPortalStaff(principal);
    if (!principal.tenantCode) {
      throw new BadRequestException('Tenant code is required');
    }
    return this.rentalAssetsService.updateAgreement(principal.tenantCode, id, dto);
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
