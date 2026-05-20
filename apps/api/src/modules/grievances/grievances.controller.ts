import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CITIZEN_MUNICIPALITY_SCOPE_HEADER } from '../../common/auth/citizen-scope';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import {
  AssignGrievanceDto,
  CreateGrievanceDto,
  CreateGrievanceEvidenceUploadIntentDto,
  GrievanceCommentDto,
  GrievanceFeedbackDto,
  GrievanceReopenDto,
  RegisterGrievanceAttachmentDto,
  UpdateGrievanceStatusDto,
} from './dto';
import { GrievancesService } from './grievances.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { ApplicationReadScope } from '../applications/dto';

function readScopeFromHeader(value?: string): ApplicationReadScope | undefined {
  const trimmed = value?.trim();
  return trimmed ? { municipalityTenantCode: trimmed } : undefined;
}

@ApiTags('grievances (Phase 4 Sprints 4.1 / 4.3)')
@ApiBearerAuth()
@ApiHeader({
  name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  description:
    'Portal (WBPORTAL) JWT: required when creating a grievance — target ULB code (e.g. KMC). Same as list/detail scoping for reads. Staff ignore this header.',
  required: false,
})
@Controller('grievances')
export class GrievancesController {
  constructor(private readonly grievances: GrievancesService) {}

  @Get('catalogue')
  @ApiOperation({
    summary: 'Active grievance categories for scoped municipality',
    description: 'Requires JWT. Pass `x-enagar-tenant-code` (portal) or use staff tenant context.',
  })
  getCatalogue(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.grievances.getCatalogueForPrincipal(principal, municipalityTenantCode);
  }

  @Post('evidence/upload-intent')
  @ApiOperation({ summary: 'Create upload target for grievance photo/video evidence (citizen)' })
  createEvidenceUploadIntent(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateGrievanceEvidenceUploadIntentDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.grievances.createEvidenceUploadIntent(principal, dto, municipalityTenantCode);
  }

  @Post()
  @ApiOperation({ summary: 'File a grievance (citizen)' })
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateGrievanceDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.grievances.create(principal, dto, municipalityTenantCode);
  }

  @Get()
  @ApiOperation({
    summary: 'List grievances (citizen: own only; staff: whole tenant)',
  })
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.grievances.list(principal, readScopeFromHeader(municipalityTenantCode));
  }

  @Post('staff/sweep-sla')
  @ApiOperation({
    summary: 'Mark SLA breaches for open grievances past due (staff)',
  })
  sweepSla(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.grievances.sweepSlaBreaches(principal);
  }

  @Post(':id/attachments/register')
  @ApiOperation({
    summary: 'Register object-storage key after upload (citizen; portal scope supported)',
  })
  registerAttachment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: RegisterGrievanceAttachmentDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.grievances.registerCitizenAttachment(
      principal,
      id,
      dto,
      readScopeFromHeader(municipalityTenantCode),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Grievance detail + timeline' })
  getById(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.grievances.getById(principal, id, readScopeFromHeader(municipalityTenantCode));
  }

  @Post(':id/comment')
  @ApiOperation({ summary: 'Append timeline comment (owner or staff)' })
  addComment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: GrievanceCommentDto,
  ) {
    return this.grievances.addComment(principal, id, dto);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Re-open resolved grievance within 7 days (citizen)' })
  reopenCitizen(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: GrievanceReopenDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.grievances.reopenCitizenCase(
      principal,
      id,
      dto,
      readScopeFromHeader(municipalityTenantCode),
    );
  }

  @Post(':id/feedback')
  @ApiOperation({ summary: 'Submit rating after resolved (citizen)' })
  submitFeedback(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: GrievanceFeedbackDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.grievances.submitFeedback(
      principal,
      id,
      dto,
      readScopeFromHeader(municipalityTenantCode),
    );
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign to staff user (staff)' })
  assign(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: AssignGrievanceDto,
  ) {
    return this.grievances.assign(principal, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change status with lifecycle guard (staff)' })
  updateStatus(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateGrievanceStatusDto,
  ) {
    return this.grievances.updateStatus(principal, id, dto);
  }
}
