import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { ApplicationsService } from './applications.service';
import { CancelApplicationDto, CommentApplicationDto, CreateApplicationDto } from './dto';

import type { ApplicationResponse, ApplicationSummaryResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('applications')
@ApiBearerAuth()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  create(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateApplicationDto,
  ): ApplicationResponse {
    return this.applications.create(principal, dto);
  }

  @Get()
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal): ApplicationSummaryResponse[] {
    return this.applications.list(principal);
  }

  @Get(':docketNo')
  getByDocketNo(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('docketNo') docketNo: string,
  ): ApplicationResponse {
    return this.applications.getByDocketNo(principal, docketNo);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: CancelApplicationDto,
  ): ApplicationResponse {
    return this.applications.cancel(principal, id, dto);
  }

  @Post(':id/comment')
  comment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: CommentApplicationDto,
  ): ApplicationResponse {
    return this.applications.comment(principal, id, dto);
  }
}
