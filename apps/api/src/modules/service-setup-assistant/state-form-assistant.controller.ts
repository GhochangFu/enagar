import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import { assertStateAdmin } from '../admin-state/admin-state.contracts';
import { AdminStateService } from '../admin-state/admin-state.service';

import { SetupAssistantMessageDto } from './dto/message.dto';
import { CreateSetupSessionDto, PatchSetupSessionStepDto } from './dto/session.dto';
import { ReadinessChecklistService } from './readiness-checklist.service';
import { ServiceSetupAssistantService } from './service-setup-assistant.service';
import { SetupSessionService } from './setup-session.service';
import { streamSetupAssistantSse } from './sse.util';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Response } from 'express';

@ApiTags('service-setup-assistant')
@ApiBearerAuth()
@Controller('admin/state/global-service-library/:code/setup-assistant')
export class StateFormAssistantController {
  constructor(
    private readonly adminState: AdminStateService,
    private readonly sessions: SetupSessionService,
    private readonly readiness: ReadinessChecklistService,
    private readonly assistant: ServiceSetupAssistantService,
  ) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create state form setup-assistant session' })
  async createSession(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Body() _dto: CreateSetupSessionDto,
  ) {
    assertStateAdmin(principal);
    await this.adminState.getGlobalServiceTemplate(principal, code);
    return this.sessions.createStateFormSession({
      tenantId: principal.tenantId,
      globalServiceCode: code,
      staffSubjectId: principal.subject,
    });
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get state form setup-assistant session' })
  async getSession(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Param('sessionId') sessionId: string,
  ) {
    assertStateAdmin(principal);
    const session = await this.sessions.getSession(
      sessionId,
      principal.tenantId,
      principal.subject,
    );
    const raw = await this.sessions.assertSessionAccess(
      sessionId,
      principal.tenantId,
      principal.subject,
    );
    if (raw.globalServiceCode !== code) {
      throw new ForbiddenException('Session does not belong to this global template');
    }
    const checklist = await this.readiness.forGlobalTemplate(principal, code);
    return { session, checklist };
  }

  @Patch('sessions/:sessionId/step')
  @ApiOperation({ summary: 'Update setup-assistant current step (form scope)' })
  async patchSessionStep(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: PatchSetupSessionStepDto,
  ) {
    assertStateAdmin(principal);
    const raw = await this.sessions.assertSessionAccess(
      sessionId,
      principal.tenantId,
      principal.subject,
    );
    if (raw.globalServiceCode !== code) {
      throw new ForbiddenException('Session does not belong to this global template');
    }
    return this.sessions.setCurrentStep(
      sessionId,
      principal.tenantId,
      principal.subject,
      dto.current_step,
    );
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Readiness checklist for global form template' })
  getReadiness(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('code') code: string) {
    assertStateAdmin(principal);
    return this.readiness.forGlobalTemplate(principal, code);
  }

  @Post('sessions/:sessionId/message')
  @ApiOperation({ summary: 'State form setup assistant chat (SSE)' })
  async postMessage(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('code') code: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: SetupAssistantMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    assertStateAdmin(principal);
    await streamSetupAssistantSse(
      res,
      this.assistant.streamStateMessage(principal, code, sessionId, dto.message),
    );
  }
}
