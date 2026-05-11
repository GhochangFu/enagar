import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';

import { CITIZEN_MUNICIPALITY_SCOPE_HEADER } from '../../common/auth/citizen-scope';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { ApplicationsService } from './applications.service';
import { CancelApplicationDto, CommentApplicationDto, CreateApplicationDto } from './dto';

import type { ApplicationReadScope, ApplicationResponse, ApplicationSummaryResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

function readScopeFromHeader(value?: string): ApplicationReadScope | undefined {
  const trimmed = value?.trim();
  return trimmed ? { municipalityTenantCode: trimmed } : undefined;
}

@ApiTags('applications')
@ApiBearerAuth()
@ApiHeader({
  name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  description:
    'Optional active ULB (municipal tenant code). With portal JWT, omit on hub to see all municipalities; send when scoped to one ULB.',
  required: false,
})
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponse> {
    return this.applications.create(principal, dto);
  }

  @Post('drafts')
  createDraft(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponse> {
    return this.applications.createDraft(principal, dto);
  }

  @Get()
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): Promise<ApplicationSummaryResponse[]> {
    return this.applications.list(principal, readScopeFromHeader(municipalityTenantCode));
  }

  @Get(':docketNo')
  getByDocketNo(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('docketNo') docketNo: string,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): Promise<ApplicationResponse> {
    return this.applications.getByDocketNo(
      principal,
      docketNo,
      readScopeFromHeader(municipalityTenantCode),
    );
  }

  @Post(':id/cancel')
  cancel(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: CancelApplicationDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): Promise<ApplicationResponse> {
    return this.applications.cancel(
      principal,
      id,
      dto,
      readScopeFromHeader(municipalityTenantCode),
    );
  }

  @Post(':id/submit')
  submitDraft(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): Promise<ApplicationResponse> {
    return this.applications.submitDraft(principal, id, {
      readScope: readScopeFromHeader(municipalityTenantCode),
    });
  }

  @Post(':id/comment')
  comment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: CommentApplicationDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): Promise<ApplicationResponse> {
    return this.applications.comment(
      principal,
      id,
      dto,
      readScopeFromHeader(municipalityTenantCode),
    );
  }
}
