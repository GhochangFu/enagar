import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { TenantsModule } from '../tenants/tenants.module';

import { ChatbotAuditService } from './audit';
import { ChatbotConsentService } from './chatbot-consent.service';
import { ChatbotContextService } from './chatbot-context.service';
import { ChatbotFeedbackService } from './chatbot-feedback.service';
import { ChatbotLlmService } from './chatbot-llm.service';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { RagRetrievalService } from './rag-retrieval.service';

@Module({
  imports: [DatabaseModule, TenantsModule],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    ChatbotLlmService,
    ChatbotAuditService,
    ChatbotConsentService,
    ChatbotFeedbackService,
    ChatbotContextService,
    RagRetrievalService,
  ],
  exports: [ChatbotService, ChatbotLlmService, ChatbotAuditService],
})
export class ChatbotModule {}
