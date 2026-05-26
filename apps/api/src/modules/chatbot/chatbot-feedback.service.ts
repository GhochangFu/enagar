import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { ChatbotContextService } from './chatbot-context.service';

import type { ChatbotFeedbackResponse } from '@enagar/types';

@Injectable()
export class ChatbotFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: ChatbotContextService,
  ) {}

  async record(params: {
    tenantId: string;
    citizenSubject: string;
    sessionKey: string;
    rating: number;
    assistantMessageId?: string;
  }): Promise<ChatbotFeedbackResponse> {
    if (params.rating !== 1 && params.rating !== -1) {
      throw new BadRequestException('rating must be 1 or -1');
    }

    const citizenCtx = await this.context.buildCitizenSummary({
      tenantId: params.tenantId,
      citizenSubject: params.citizenSubject,
    });

    const row = await this.prisma.chatbotFeedback.create({
      data: {
        tenantId: params.tenantId,
        sessionKey: params.sessionKey,
        citizenId: citizenCtx.citizenId,
        rating: params.rating,
        assistantMessageId: params.assistantMessageId ?? null,
      },
      select: { id: true },
    });

    return { id: row.id, recorded: true };
  }
}
