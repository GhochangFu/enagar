import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { CitizenService } from './citizen.service';
import {
  RegisterCitizenDto,
  SelectTenantDto,
  UpdateCitizenLanguageDto,
  UpdateCitizenProfileDto,
} from './dto';

import type { CitizenProfileResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('citizen')
@ApiBearerAuth()
@Controller('citizen')
export class CitizenController {
  constructor(private readonly citizens: CitizenService) {}

  @Post('register')
  register(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: RegisterCitizenDto,
  ): CitizenProfileResponse {
    return this.citizens.register(principal, dto);
  }

  @Get('profile')
  getProfile(@CurrentPrincipal() principal: AuthenticatedPrincipal): CitizenProfileResponse {
    return this.citizens.getProfile(principal);
  }

  @Patch('profile')
  updateProfile(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateCitizenProfileDto,
  ): CitizenProfileResponse {
    return this.citizens.updateProfile(principal, dto);
  }

  @Patch('language')
  updateLanguage(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: UpdateCitizenLanguageDto,
  ): CitizenProfileResponse {
    return this.citizens.updateLanguage(principal, dto);
  }

  @Post('select-tenant')
  selectTenant(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: SelectTenantDto,
  ): {
    selected_tenant_code: string;
    tenant_name: string;
    theme_color: string;
    ward_count: number;
  } {
    return this.citizens.selectTenant(principal, dto);
  }
}
