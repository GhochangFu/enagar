import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { ChatbotContextService } from './chatbot-context.service';

import type { ChatbotConsentMode, ChatbotConsentResponse } from '@enagar/types';

export const CHATBOT_DISCLOSURE_VERSION = '2026-05';

@Injectable()
export class ChatbotConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: ChatbotContextService,
  ) {}

  async getConsent(params: {
    tenantId: string;
    citizenSubject: string;
  }): Promise<ChatbotConsentResponse> {
    const citizenId = await this.resolveCitizenId(params.tenantId, params.citizenSubject);
    if (!citizenId) {
      return {
        accepted: false,
        mode: null,
        disclosure_version: CHATBOT_DISCLOSURE_VERSION,
        updated_at: null,
      };
    }

    const row = await this.prisma.chatbotConsent.findUnique({
      where: {
        tenantId_citizenId: { tenantId: params.tenantId, citizenId },
      },
    });

    if (!row) {
      return {
        accepted: false,
        mode: null,
        disclosure_version: CHATBOT_DISCLOSURE_VERSION,
        updated_at: null,
      };
    }

    return {
      accepted: true,
      mode: row.mode as ChatbotConsentMode,
      disclosure_version: row.disclosureVersion,
      updated_at: row.updatedAt.toISOString(),
    };
  }

  async recordConsent(params: {
    tenantId: string;
    citizenSubject: string;
    mode: ChatbotConsentMode;
    accepted: boolean;
  }): Promise<ChatbotConsentResponse> {
    if (!params.accepted) {
      throw new BadRequestException('Consent must be accepted to use Sahayak');
    }
    if (params.mode !== 'llm' && params.mode !== 'kb_only') {
      throw new BadRequestException('Invalid consent mode');
    }

    const citizenId = await this.requireCitizenId(params.tenantId, params.citizenSubject);

    const row = await this.prisma.chatbotConsent.upsert({
      where: {
        tenantId_citizenId: { tenantId: params.tenantId, citizenId },
      },
      create: {
        tenantId: params.tenantId,
        citizenId,
        mode: params.mode,
        disclosureVersion: CHATBOT_DISCLOSURE_VERSION,
      },
      update: {
        mode: params.mode,
        disclosureVersion: CHATBOT_DISCLOSURE_VERSION,
      },
    });

    return {
      accepted: true,
      mode: row.mode as ChatbotConsentMode,
      disclosure_version: row.disclosureVersion,
      updated_at: row.updatedAt.toISOString(),
    };
  }

  private async resolveCitizenId(tenantId: string, citizenSubject: string): Promise<string | null> {
    const ctx = await this.context.buildCitizenSummary({ tenantId, citizenSubject });
    return ctx.citizenId;
  }

  private async requireCitizenId(tenantId: string, citizenSubject: string): Promise<string> {
    const citizenId = await this.resolveCitizenId(tenantId, citizenSubject);
    if (!citizenId) {
      throw new NotFoundException(
        'Citizen profile required — complete registration for this municipality first',
      );
    }
    return citizenId;
  }
}
