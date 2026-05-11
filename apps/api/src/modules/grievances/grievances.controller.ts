import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import {
  AssignGrievanceDto,
  CreateGrievanceDto,
  GrievanceCommentDto,
  GrievanceFeedbackDto,
  UpdateGrievanceStatusDto,
} from './dto';
import { GrievancesService } from './grievances.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('grievances (Phase 4 Sprint 4.1)')
@ApiBearerAuth()
@Controller('grievances')
export class GrievancesController {
  constructor(private readonly grievances: GrievancesService) {}

  @Post()
  @ApiOperation({ summary: 'File a grievance (citizen)' })
  create(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Body() dto: CreateGrievanceDto) {
    return this.grievances.create(principal, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List grievances (citizen: own only; staff: whole tenant)',
  })
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.grievances.list(principal);
  }

  @Post('staff/sweep-sla')
  @ApiOperation({
    summary: 'Mark SLA breaches for open grievances past due (staff)',
  })
  sweepSla(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.grievances.sweepSlaBreaches(principal);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Grievance detail + timeline' })
  getById(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.grievances.getById(principal, id);
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

  @Post(':id/feedback')
  @ApiOperation({ summary: 'Submit rating after resolved (citizen)' })
  submitFeedback(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: GrievanceFeedbackDto,
  ) {
    return this.grievances.submitFeedback(principal, id, dto);
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
