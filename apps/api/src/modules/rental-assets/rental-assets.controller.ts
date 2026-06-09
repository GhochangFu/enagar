import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import {
  CreateLeaseAgreementDto,
  CreateRentalAssetDto,
  QueryRentalAssetsDto,
} from './dto/rental-assets.dto';
import { RentalAssetsService } from './rental-assets.service';

@ApiTags('rental-assets')
@ApiBearerAuth()
@Controller('rental-assets')
export class RentalAssetsController {
  constructor(private readonly rentalAssetsService: RentalAssetsService) {}

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
}
