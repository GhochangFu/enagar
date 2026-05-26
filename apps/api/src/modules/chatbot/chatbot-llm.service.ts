import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { ChatbotAuditService } from './audit';
import { GeminiProvider, OllamaProvider, OpenAIProvider } from './providers';
import { hashRedactedQuery, redactPii, restorePii } from './redaction';

import type {
  ILLMProvider,
  LLMProviderName,
  LLMRequest,
  LLMStreamChunk,
  TenantConfig,
} from '@enagar/types';

export type LlmHealthResponse = {
  provider: LLMProviderName;
  model: string;
  ok: boolean;
  latency_ms: number;
  dpa_signed: boolean;
};

export type StreamAuditContext = {
  redactedUserText: string;
  redactionCount: number;
  restoreMap: Record<string, string>;
};

@Injectable()
export class ChatbotLlmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ChatbotAuditService,
  ) {}

  /** ADR-0008 precedence: tenant config > LLM_PROVIDER env > default. */
  resolveProviderName(chatbot?: TenantConfig['chatbot']): LLMProviderName {
    if (chatbot?.provider) {
      return chatbot.provider;
    }
    const env = process.env.LLM_PROVIDER?.toLowerCase();
    if (env === 'openai' || env === 'gemini' || env === 'ollama') {
      return env;
    }
    if (process.env.OPENAI_API_KEY?.trim()) {
      return 'openai';
    }
    if (process.env.GEMINI_API_KEY?.trim()) {
      return 'gemini';
    }
    return process.env.NODE_ENV === 'production' ? 'openai' : 'ollama';
  }

  createProvider(name: LLMProviderName, modelOverride?: string): ILLMProvider {
    switch (name) {
      case 'openai':
        return new OpenAIProvider(modelOverride);
      case 'gemini':
        return new GeminiProvider(modelOverride);
      case 'ollama':
        return new OllamaProvider(modelOverride);
      default: {
        const exhaustive: never = name;
        return exhaustive;
      }
    }
  }

  assertDpaAllowsProviderCall(chatbot?: TenantConfig['chatbot']): void {
    if (chatbot?.dpa_signed === true) {
      return;
    }
    if (process.env.CHATBOT_DPA_SKIP_DEV === 'true' && process.env.NODE_ENV !== 'production') {
      return;
    }
    throw new ForbiddenException(
      'Chatbot LLM calls are blocked until tenants.config.chatbot.dpa_signed is true',
    );
  }

  prepareOutboundText(rawUserText: string): StreamAuditContext {
    const { redacted, map, count } = redactPii(rawUserText);
    return {
      redactedUserText: redacted,
      redactionCount: count,
      restoreMap: map,
    };
  }

  async resolveTenantChatbotConfig(
    tenantCode: string,
  ): Promise<{ tenantId: string; chatbot: TenantConfig['chatbot'] }> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { code: { equals: tenantCode, mode: 'insensitive' } },
      select: { id: true, config: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantCode}`);
    }
    const config = tenant.config as TenantConfig;
    return { tenantId: tenant.id, chatbot: config.chatbot };
  }

  async getLlmHealth(tenantCode: string): Promise<LlmHealthResponse> {
    const { chatbot } = await this.resolveTenantChatbotConfig(tenantCode);
    const providerName = this.resolveProviderName(chatbot);
    const provider = this.createProvider(providerName, chatbot?.model);
    const health = await provider.health();
    return {
      provider: provider.name,
      model: provider.model,
      ok: health.ok,
      latency_ms: health.latencyMs,
      dpa_signed: chatbot?.dpa_signed === true,
    };
  }

  resolveFallbackProviderName(
    primary: LLMProviderName,
    chatbot?: TenantConfig['chatbot'],
  ): LLMProviderName | null {
    const configured =
      chatbot?.fallback_provider ??
      (process.env.CHATBOT_FALLBACK_PROVIDER as LLMProviderName | undefined);
    if (
      configured &&
      configured !== primary &&
      (configured === 'openai' || configured === 'gemini' || configured === 'ollama')
    ) {
      return configured;
    }
    return null;
  }

  /**
   * Streams from the active provider after redacting outbound user text and
   * restores placeholders in model output. Persists audit on completion (7.2).
   * On transport failure, retries once with {@link resolveFallbackProviderName} (7.3).
   */
  async *streamWithAudit(
    req: LLMRequest,
    outbound: StreamAuditContext,
  ): AsyncIterable<LLMStreamChunk> {
    const { chatbot } = await this.resolveTenantChatbotConfigById(req.tenantId);
    this.assertDpaAllowsProviderCall(chatbot);

    const primaryName = this.resolveProviderName(chatbot);
    const fallbackName = this.resolveFallbackProviderName(primaryName, chatbot);
    const started = Date.now();
    const queryHash = hashRedactedQuery(outbound.redactedUserText);

    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let usedProvider = this.createProvider(primaryName, chatbot?.model);

    const attemptStream = async function* (provider: ILLMProvider): AsyncGenerator<LLMStreamChunk> {
      for await (const chunk of provider.stream(req)) {
        yield chunk;
      }
    };

    try {
      for await (const chunk of this.collectStream(attemptStream(usedProvider), outbound)) {
        if (chunk.done) {
          inputTokens = chunk.inputTokens;
          outputTokens = chunk.outputTokens;
          yield { ...chunk, delta: '' };
          break;
        }
        if (chunk.delta) {
          yield chunk;
        }
      }
    } catch (primaryError) {
      if (!fallbackName) {
        throw primaryError;
      }
      usedProvider = this.createProvider(fallbackName, chatbot?.model);
      for await (const chunk of this.collectStream(attemptStream(usedProvider), outbound)) {
        if (chunk.done) {
          inputTokens = chunk.inputTokens;
          outputTokens = chunk.outputTokens;
          yield { ...chunk, delta: '' };
          break;
        }
        if (chunk.delta) {
          yield chunk;
        }
      }
    }

    await this.audit.record({
      tenantId: req.tenantId,
      citizenId: req.citizenId,
      sessionId: req.sessionId,
      provider: usedProvider.name,
      model: usedProvider.model,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - started,
      redactionCount: outbound.redactionCount,
      queryHash,
    });
  }

  private async *collectStream(
    source: AsyncIterable<LLMStreamChunk>,
    outbound: StreamAuditContext,
  ): AsyncIterable<LLMStreamChunk> {
    for await (const chunk of source) {
      const delta = chunk.delta ? restorePii(chunk.delta, outbound.restoreMap) : '';
      yield { ...chunk, delta: chunk.done ? '' : delta };
    }
  }

  private async resolveTenantChatbotConfigById(
    tenantId: string,
  ): Promise<{ chatbot: TenantConfig['chatbot'] }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { config: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }
    const config = tenant.config as TenantConfig;
    return { chatbot: config.chatbot };
  }
}
