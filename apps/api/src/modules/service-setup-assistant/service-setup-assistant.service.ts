import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { AdminStateService } from '../admin-state/admin-state.service';
import { AdminTenantService } from '../admin-tenant/admin-tenant.service';
import { ChatbotLlmService } from '../chatbot/chatbot-llm.service';

import { ReadinessChecklistService } from './readiness-checklist.service';
import {
  FORM_TOOL_RETRY_USER_MESSAGE,
  looksLikeFormFieldEditRequest,
} from './setup-assistant-message.util';
import { SetupSessionService } from './setup-session.service';
import { formatFormFieldsForPrompt } from './tools/normalize-proposed-fields';
import { parseToolCallsFromAssistantText } from './tools/tool-call-parser';
import { SetupToolRegistry } from './tools/tool-registry';

import type { StreamAuditContext } from '../chatbot/chatbot-llm.service';
import type { SetupToolContext, SetupToolPersona } from './tools/tool.types';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';
import type { EnagarFormField } from '@enagar/forms';
import type {
  SetupAssistantScope,
  SetupAssistantSseEvent,
  SetupAssistantStep,
  SetupSessionDto,
} from '@enagar/types';

type StreamMessageInput = {
  principal: AuthenticatedPrincipal;
  sessionId: string;
  message: string;
  persona: SetupToolPersona;
  serviceId?: string;
  globalServiceCode?: string;
};

@Injectable()
export class ServiceSetupAssistantService {
  private readonly log = new Logger(ServiceSetupAssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SetupSessionService,
    private readonly readiness: ReadinessChecklistService,
    private readonly adminTenant: AdminTenantService,
    private readonly adminState: AdminStateService,
    private readonly llm: ChatbotLlmService,
    private readonly tools: SetupToolRegistry,
  ) {}

  async *streamTenantMessage(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    sessionId: string,
    message: string,
  ): AsyncIterable<SetupAssistantSseEvent> {
    yield* this.streamMessage({
      principal,
      sessionId,
      message,
      persona: 'tenant',
      serviceId,
    });
  }

  async *streamStateMessage(
    principal: AuthenticatedPrincipal,
    globalServiceCode: string,
    sessionId: string,
    message: string,
  ): AsyncIterable<SetupAssistantSseEvent> {
    yield* this.streamMessage({
      principal,
      sessionId,
      message,
      persona: 'state',
      globalServiceCode,
    });
  }

  private async *streamMessage(input: StreamMessageInput): AsyncIterable<SetupAssistantSseEvent> {
    const sanitized = input.message.trim();
    if (!sanitized) {
      throw new BadRequestException('message is required');
    }

    const raw = await this.sessions.assertSessionAccess(
      input.sessionId,
      input.principal.tenantId,
      input.principal.subject,
    );
    if (input.persona === 'tenant') {
      if (!input.serviceId || raw.serviceId !== input.serviceId) {
        throw new BadRequestException('Session does not belong to this service');
      }
    } else if (!input.globalServiceCode || raw.globalServiceCode !== input.globalServiceCode) {
      throw new BadRequestException('Session does not belong to this global template');
    }

    const session = await this.sessions.getSession(
      input.sessionId,
      input.principal.tenantId,
      input.principal.subject,
    );
    const step = session.current_step as SetupAssistantStep;
    const scope = session.scope as SetupAssistantScope;

    if (step !== 2) {
      throw new BadRequestException('Message endpoint is only available on form step (2)');
    }

    yield {
      type: 'meta',
      session_id: input.sessionId,
      step,
    };

    const outbound = this.llm.prepareOutboundText(sanitized);
    const history = await this.loadHistory(input.sessionId);
    const messages = [...history, { role: 'user' as const, content: outbound.redactedUserText }];

    await this.prisma.serviceSetupMessage.create({
      data: {
        tenantId: input.principal.tenantId,
        sessionId: input.sessionId,
        role: 'user',
        content: sanitized,
      },
    });

    const systemPrompt = await this.buildSystemPrompt(input, step, scope);

    let assistantText = '';
    try {
      assistantText = yield* this.streamAssistantReply(input, systemPrompt, messages, outbound);
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'LLM stream failed';
      this.log.warn(`setup-assistant stream error session=${input.sessionId}: ${errMessage}`);
      yield { type: 'error', message: errMessage };
      return;
    }

    let { displayText, toolCalls } = parseToolCallsFromAssistantText(assistantText);

    if (toolCalls.length === 0 && looksLikeFormFieldEditRequest(sanitized)) {
      this.log.log(`setup-assistant retrying missing tool_calls session=${input.sessionId}`);
      const retryOutbound = this.llm.prepareOutboundText(FORM_TOOL_RETRY_USER_MESSAGE);
      const retryMessages = [
        ...messages,
        {
          role: 'assistant' as const,
          content: displayText || assistantText.trim() || 'Understood.',
        },
        { role: 'user' as const, content: retryOutbound.redactedUserText },
      ];
      try {
        const retryText = yield* this.streamAssistantReply(
          input,
          systemPrompt,
          retryMessages,
          retryOutbound,
        );
        assistantText = retryText;
        ({ displayText, toolCalls } = parseToolCallsFromAssistantText(assistantText));
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : 'LLM retry stream failed';
        this.log.warn(`setup-assistant retry error session=${input.sessionId}: ${errMessage}`);
      }
    }

    const toolCallPayload =
      toolCalls.length > 0 ? (toolCalls as unknown as Prisma.InputJsonValue) : undefined;

    const assistantRow = await this.prisma.serviceSetupMessage.create({
      data: {
        tenantId: input.principal.tenantId,
        sessionId: input.sessionId,
        role: 'assistant',
        content: displayText || assistantText,
        toolCalls: toolCallPayload,
      },
    });

    const toolCtx: SetupToolContext = {
      principal: input.principal,
      session,
      tenantId: input.principal.tenantId,
      serviceId: input.serviceId,
      globalServiceCode: input.globalServiceCode,
      step,
      scope,
    };

    const toolSummaries: string[] = [];
    for (const call of toolCalls) {
      let result;
      try {
        result = await this.tools.executeTool(input.persona, call.name, toolCtx, call.arguments);
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : 'Tool execution failed';
        result = { success: false, summary: errMessage };
      }

      await this.prisma.serviceSetupAuditLog.create({
        data: {
          sessionId: input.sessionId,
          tenantId: input.principal.tenantId,
          staffSubjectId: input.principal.subject,
          toolName: call.name,
          step,
          success: result.success,
          inputSummary: call.arguments as Prisma.InputJsonValue,
          errorMessage: result.success ? null : result.summary,
        },
      });

      yield {
        type: 'tool_result',
        name: call.name,
        success: result.success,
        summary: result.summary,
      };
      toolSummaries.push(`${call.name}: ${result.success ? 'OK' : 'Failed'} — ${result.summary}`);

      if (result.success && result.draftUpdated) {
        yield { type: 'draft_updated', layer: result.draftUpdated };
        await this.maybeMarkFormStepComplete(input, session);
      }
    }

    if (toolSummaries.length > 0) {
      const enriched = [displayText || assistantText.trim(), ...toolSummaries]
        .filter((line) => line.length > 0)
        .join('\n\n');
      await this.prisma.serviceSetupMessage.update({
        where: { id: assistantRow.id },
        data: { content: enriched },
      });
    }

    yield { type: 'done' };
  }

  private async *streamAssistantReply(
    input: StreamMessageInput,
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    outbound: StreamAuditContext,
  ): AsyncGenerator<SetupAssistantSseEvent, string> {
    let assistantText = '';
    for await (const chunk of this.llm.streamForSetupAssistant(
      {
        systemPrompt,
        messages,
        maxTokens: Number(process.env.SETUP_ASSISTANT_MAX_TOKENS ?? 2048),
        temperature: Number(process.env.SETUP_ASSISTANT_TEMPERATURE ?? 0.2),
        tenantId: input.principal.tenantId,
        citizenId: null,
        sessionId: input.sessionId,
      },
      outbound,
    )) {
      if (chunk.done) {
        break;
      }
      if (chunk.delta) {
        assistantText += chunk.delta;
        yield { type: 'token', delta: chunk.delta };
      }
    }
    return assistantText;
  }

  private async maybeMarkFormStepComplete(
    input: StreamMessageInput,
    session: SetupSessionDto,
  ): Promise<void> {
    if (input.persona === 'tenant' && input.serviceId) {
      const checklist = await this.readiness.forService(input.principal.tenantId, input.serviceId);
      const formValid =
        checklist.items.find((item) => item.key === 'form_draft_valid')?.status === 'green';
      if (formValid) {
        await this.sessions.markStepComplete(
          session.id,
          input.principal.tenantId,
          input.principal.subject,
          2,
        );
      }
      return;
    }

    if (input.persona === 'state' && input.globalServiceCode) {
      const template = await this.adminState.getGlobalServiceTemplate(
        input.principal,
        input.globalServiceCode,
      );
      if (template.has_usable_form_schema) {
        await this.sessions.markStepComplete(
          session.id,
          input.principal.tenantId,
          input.principal.subject,
          2,
        );
      }
    }
  }

  private async loadHistory(
    sessionId: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const maxTurns = Number(process.env.SETUP_ASSISTANT_HISTORY_TURNS ?? 6);
    const rows = await this.prisma.serviceSetupMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: maxTurns * 2,
    });
    return rows.reverse().map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
    }));
  }

  private async buildSystemPrompt(
    input: StreamMessageInput,
    step: SetupAssistantStep,
    scope: SetupAssistantScope,
  ): Promise<string> {
    const tools = this.tools.formatToolsForPrompt(input.persona, scope, step);
    if (input.persona === 'tenant') {
      if (!input.serviceId) {
        throw new NotFoundException('serviceId required');
      }
      const designer = await this.adminTenant.getServiceDesigner(input.principal, input.serviceId);
      const draftSchema = designer.form_draft?.form_schema;
      const fields: EnagarFormField[] =
        draftSchema &&
        typeof draftSchema === 'object' &&
        !Array.isArray(draftSchema) &&
        Array.isArray((draftSchema as { fields?: unknown }).fields)
          ? ((draftSchema as unknown as { fields: EnagarFormField[] }).fields ?? [])
          : [];
      return this.renderPrompt('system-tenant-form.md', {
        TOOLS: tools,
        SERVICE_ID: input.serviceId,
        SERVICE_CODE: designer.service.code,
        SCOPE: scope,
        STEP: String(step),
        CURRENT_FORM_FIELDS: formatFormFieldsForPrompt(fields),
      });
    }

    if (!input.globalServiceCode) {
      throw new NotFoundException('globalServiceCode required');
    }
    return this.renderPrompt('system-state-form.md', {
      TOOLS: tools,
      GLOBAL_CODE: input.globalServiceCode,
    });
  }

  private renderPrompt(fileName: string, vars: Record<string, string>): string {
    const path = join(__dirname, 'prompts', fileName);
    let text = readFileSync(path, 'utf8');
    for (const [key, value] of Object.entries(vars)) {
      text = text.replaceAll(`{{${key}}}`, value);
    }
    return text;
  }
}
