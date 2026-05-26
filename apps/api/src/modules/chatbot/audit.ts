import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import type { LLMProviderName } from '@enagar/types';

export type ChatbotAuditInput = {
  tenantId: string;
  citizenId: string | null;
  sessionId: string;
  provider: LLMProviderName;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  redactionCount: number;
  queryHash: string;
  requestId?: string;
};

@Injectable()
export class ChatbotAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: ChatbotAuditInput): Promise<{ id: string; requestId: string }> {
    const row = await this.prisma.chatbotAuditLog.create({
      data: {
        tenantId: entry.tenantId,
        citizenId: entry.citizenId,
        sessionId: entry.sessionId,
        provider: entry.provider,
        model: entry.model,
        inputTokens: entry.inputTokens ?? null,
        outputTokens: entry.outputTokens ?? null,
        latencyMs: entry.latencyMs,
        redactionCount: entry.redactionCount,
        queryHash: entry.queryHash,
        ...(entry.requestId ? { requestId: entry.requestId } : {}),
      },
      select: { id: true, requestId: true },
    });
    return row;
  }
}
