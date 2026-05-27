import { randomUUID } from 'node:crypto';

import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import {
  CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  resolveCitizenMunicipalityForWrite,
} from '../../common/auth/citizen-scope';
import { PrismaService } from '../../common/database/prisma.service';
import { TenantsService } from '../tenants/tenants.service';

import { ChatbotConsentService } from './chatbot-consent.service';
import { ChatbotContextService } from './chatbot-context.service';
import { ChatbotLlmService } from './chatbot-llm.service';
import { assertChatbotInputAllowed } from './guardrails';
import { formatKbOnlyReply } from './kb-only-reply';
import { detectChatbotLanguage } from './language';
import { buildSystemPrompt, chunksToCitations } from './prompt';
import { RagRetrievalService } from './rag-retrieval.service';

import type { ChatbotQueryDto } from './dto/chatbot-query.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';
import type {
  ChatbotHistoryResponse,
  ChatbotLanguage,
  ChatbotSseDone,
  ChatbotSseError,
  ChatbotSseMeta,
  ChatbotSseToken,
  TenantConfig,
} from '@enagar/types';

export type ChatbotSseEvent =
  | { event: 'meta'; data: ChatbotSseMeta }
  | { event: 'token'; data: ChatbotSseToken }
  | { event: 'done'; data: ChatbotSseDone }
  | { event: 'error'; data: ChatbotSseError };

@Injectable()
export class ChatbotService {
  private readonly log = new Logger(ChatbotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
    private readonly rag: RagRetrievalService,
    private readonly context: ChatbotContextService,
    private readonly llm: ChatbotLlmService,
    private readonly consent: ChatbotConsentService,
  ) {}

  async resolveWriteScope(
    principal: AuthenticatedPrincipal,
    municipalityHeader?: string,
  ): Promise<{ tenantId: string; tenantCode: string }> {
    return resolveCitizenMunicipalityForWrite(
      principal,
      await this.tenants.list(),
      municipalityHeader,
    );
  }

  async getConsentForPrincipal(principal: AuthenticatedPrincipal, municipalityHeader?: string) {
    const { tenantId } = await this.resolveWriteScope(principal, municipalityHeader);
    return this.consent.getConsent({
      tenantId,
      citizenSubject: principal.subject,
    });
  }

  async recordConsentForPrincipal(
    principal: AuthenticatedPrincipal,
    dto: { mode: 'llm' | 'kb_only'; accepted: boolean },
    municipalityHeader?: string,
  ) {
    const { tenantId } = await this.resolveWriteScope(principal, municipalityHeader);
    return this.consent.recordConsent({
      tenantId,
      citizenSubject: principal.subject,
      mode: dto.mode,
      accepted: dto.accepted,
    });
  }

  async *streamQuery(
    principal: AuthenticatedPrincipal,
    dto: ChatbotQueryDto,
    municipalityHeader?: string,
  ): AsyncIterable<ChatbotSseEvent> {
    const sanitized = assertChatbotInputAllowed(dto.message);
    const { tenantId, tenantCode } = resolveCitizenMunicipalityForWrite(
      principal,
      await this.tenants.list(),
      municipalityHeader,
    );

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, code: true, name: true, config: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const config = tenant.config as TenantConfig;
    if (config.chatbot?.enabled === false) {
      throw new ForbiddenException('Chatbot is disabled for this municipality');
    }

    const language = detectChatbotLanguage(sanitized, dto.language);
    const sessionKey = dto.session_id?.trim() || randomUUID();
    const outbound = this.llm.prepareOutboundText(sanitized);

    const citizenCtx = await this.context.buildCitizenSummary({
      tenantId,
      citizenSubject: principal.subject,
    });
    const helpline = await this.context.resolveTenantHelpline(tenantId);

    const chunks = await this.rag.search({
      tenantCode: tenantCode ?? tenant.code,
      query: sanitized,
    });
    const citations = chunksToCitations(chunks);

    const consent = await this.consent.getConsent({
      tenantId,
      citizenSubject: principal.subject,
    });
    if (!consent.accepted || !consent.mode) {
      throw new ForbiddenException(
        'Sahayak consent required — accept the disclosure before chatting',
      );
    }

    const session = await this.ensureSession({
      tenantId,
      citizenId: citizenCtx.citizenId,
      sessionKey,
      language,
    });

    const history = await this.loadHistoryMessages(session.id);
    const systemPrompt = buildSystemPrompt({
      tenantName: tenant.name,
      helpline: helpline.phone,
      language,
      citizenSummary: citizenCtx.summary,
      applicationSummary: citizenCtx.applications,
      grievanceSummary: citizenCtx.grievances,
      paymentSummary: citizenCtx.payments,
      chunks,
    });

    await this.prisma.chatbotMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: outbound.redactedUserText,
        citations: [],
      },
    });

    yield {
      event: 'meta',
      data: {
        session_id: sessionKey,
        language,
        citations,
      },
    };

    const messages = [...history, { role: 'user' as const, content: outbound.redactedUserText }];

    let assistantText = '';
    let finishReason: string | undefined;

    if (consent.mode === 'kb_only') {
      assistantText = formatKbOnlyReply({
        language,
        chunks,
        citations,
        grievanceSummary: citizenCtx.grievances,
        applicationSummary: citizenCtx.applications,
        paymentSummary: citizenCtx.payments,
      });
      const parts = assistantText.match(/[\s\S]{1,80}/g) ?? [assistantText];
      for (const part of parts) {
        yield { event: 'token', data: { delta: part } };
      }
      finishReason = 'stop';
    } else {
      try {
        for await (const chunk of this.llm.streamWithAudit(
          {
            systemPrompt,
            messages,
            maxTokens: Number(process.env.CHATBOT_MAX_TOKENS ?? 1024),
            temperature: Number(process.env.CHATBOT_TEMPERATURE ?? 0.2),
            tenantId,
            citizenId: citizenCtx.citizenId,
            sessionId: sessionKey,
          },
          outbound,
        )) {
          if (chunk.done) {
            finishReason = chunk.finishReason;
            break;
          }
          if (chunk.delta) {
            assistantText += chunk.delta;
            yield { event: 'token', data: { delta: chunk.delta } };
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'LLM stream failed';
        this.log.warn(`chatbot stream error tenant=${tenantCode}: ${message}`);
        yield {
          event: 'error',
          data: { code: 'llm_error', message },
        };
        return;
      }
    }

    await this.prisma.chatbotMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: assistantText,
        citations: citations as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.chatbotSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date(), language },
    });

    this.log.log(
      `chatbot_query tenant=${tenantCode} session=${sessionKey} citations=${citations.length} chars=${assistantText.length}`,
    );

    yield {
      event: 'done',
      data: { session_id: sessionKey, finish_reason: finishReason },
    };
  }

  async getHistory(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    municipalityHeader?: string,
  ): Promise<ChatbotHistoryResponse> {
    const { tenantId } = resolveCitizenMunicipalityForWrite(
      principal,
      await this.tenants.list(),
      municipalityHeader,
    );

    const session = await this.prisma.chatbotSession.findFirst({
      where: { tenantId, sessionKey: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        citizen: { select: { keycloakSubject: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.citizen?.keycloakSubject && session.citizen.keycloakSubject !== principal.subject) {
      throw new ForbiddenException('Session access denied');
    }

    return {
      session_id: session.sessionKey,
      messages: session.messages.map((row) => ({
        role: row.role as 'user' | 'assistant',
        content: row.content,
        citations:
          row.role === 'assistant'
            ? (row.citations as ChatbotHistoryResponse['messages'][0]['citations'])
            : undefined,
        created_at: row.createdAt.toISOString(),
      })),
    };
  }

  private async ensureSession(params: {
    tenantId: string;
    citizenId: string | null;
    sessionKey: string;
    language: ChatbotLanguage;
  }) {
    return this.prisma.chatbotSession.upsert({
      where: {
        tenantId_sessionKey: {
          tenantId: params.tenantId,
          sessionKey: params.sessionKey,
        },
      },
      create: {
        tenantId: params.tenantId,
        citizenId: params.citizenId,
        sessionKey: params.sessionKey,
        language: params.language,
      },
      update: {
        citizenId: params.citizenId ?? undefined,
        language: params.language,
      },
    });
  }

  private async loadHistoryMessages(
    sessionId: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const maxTurns = Number(process.env.CHATBOT_HISTORY_TURNS ?? 6);
    const rows = await this.prisma.chatbotMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: maxTurns * 2,
    });
    return rows.reverse().map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
    }));
  }
}

export { CITIZEN_MUNICIPALITY_SCOPE_HEADER };
