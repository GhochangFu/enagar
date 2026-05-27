import { Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import { Public } from '../../common/auth/public.decorator';

import { ChatbotFeedbackService } from './chatbot-feedback.service';
import { ChatbotLlmService } from './chatbot-llm.service';
import { ChatbotService, CITIZEN_MUNICIPALITY_SCOPE_HEADER } from './chatbot.service';
import { ChatbotConsentDto } from './dto/chatbot-consent.dto';
import { ChatbotFeedbackDto } from './dto/chatbot-feedback.dto';
import { ChatbotQueryDto } from './dto/chatbot-query.dto';

import type { LlmHealthResponse } from './chatbot-llm.service';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type {
  ChatbotConsentResponse,
  ChatbotFeedbackResponse,
  ChatbotHistoryResponse,
} from '@enagar/types';
import type { Response } from 'express';

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(
    private readonly llm: ChatbotLlmService,
    private readonly chatbot: ChatbotService,
    private readonly feedback: ChatbotFeedbackService,
  ) {}

  @Public()
  @Get('llm/health')
  @ApiOperation({ summary: 'LLM provider health (ADR-0008 adapter)' })
  llmHealth(
    @Query('tenant_code') tenantCode?: string,
    @Headers('x-tenant-code') headerCode?: string,
  ): Promise<LlmHealthResponse> {
    return this.llm.getLlmHealth((tenantCode ?? headerCode ?? 'KMC').trim());
  }

  @ApiBearerAuth()
  @ApiHeader({ name: CITIZEN_MUNICIPALITY_SCOPE_HEADER, required: false })
  @Get('consent')
  @ApiOperation({ summary: 'Sahayak consent status for active municipality' })
  getConsent(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityHeader: string | undefined,
  ): Promise<ChatbotConsentResponse> {
    return this.chatbot.getConsentForPrincipal(principal, municipalityHeader);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: CITIZEN_MUNICIPALITY_SCOPE_HEADER, required: false })
  @Post('consent')
  @ApiOperation({ summary: 'Record Sahayak consent (LLM or KB-only)' })
  postConsent(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: ChatbotConsentDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityHeader: string | undefined,
  ): Promise<ChatbotConsentResponse> {
    return this.chatbot.recordConsentForPrincipal(principal, dto, municipalityHeader);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: CITIZEN_MUNICIPALITY_SCOPE_HEADER, required: false })
  @Post('feedback')
  @ApiOperation({ summary: 'Thumbs up/down on a Sahayak reply' })
  async postFeedback(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: ChatbotFeedbackDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityHeader: string | undefined,
  ): Promise<ChatbotFeedbackResponse> {
    const { tenantId } = await this.chatbot.resolveWriteScope(principal, municipalityHeader);
    return this.feedback.record({
      tenantId,
      citizenSubject: principal.subject,
      sessionKey: dto.session_id,
      rating: dto.rating,
      assistantMessageId: dto.assistant_message_id,
    });
  }

  @ApiBearerAuth()
  @ApiHeader({
    name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
    required: false,
    description: 'ULB scope when JWT is the statewide citizen portal (Option A).',
  })
  @Post('query')
  @ApiOperation({ summary: 'Sahayak query — SSE stream (meta, token, done)' })
  async query(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: ChatbotQueryDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityHeader: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const evt of this.chatbot.streamQuery(principal, dto, municipalityHeader)) {
        res.write(`event: ${evt.event}\ndata: ${JSON.stringify(evt.data)}\n\n`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Chatbot query failed';
      const status =
        typeof (error as { getStatus?: () => number }).getStatus === 'function'
          ? (error as { getStatus: () => number }).getStatus()
          : 500;
      if (!res.headersSent) {
        res.status(status);
      }
      res.write(`event: error\ndata: ${JSON.stringify({ code: 'chatbot_error', message })}\n\n`);
    } finally {
      res.end();
    }
  }

  @ApiBearerAuth()
  @ApiHeader({
    name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
    required: false,
  })
  @Get('history/:session_id')
  @ApiOperation({ summary: 'Chat session history (redacted user messages)' })
  getHistory(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('session_id') sessionId: string,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityHeader: string | undefined,
  ): Promise<ChatbotHistoryResponse> {
    return this.chatbot.getHistory(principal, sessionId, municipalityHeader);
  }
}
