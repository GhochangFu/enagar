import { Module } from '@nestjs/common';

import { AdminStateModule } from '../admin-state/admin-state.module';
import { AdminTenantModule } from '../admin-tenant/admin-tenant.module';
import { ChatbotModule } from '../chatbot/chatbot.module';

import { ReadinessChecklistService } from './readiness-checklist.service';
import { ServiceSetupAssistantController } from './service-setup-assistant.controller';
import { ServiceSetupAssistantService } from './service-setup-assistant.service';
import { SetupSessionService } from './setup-session.service';
import { StateFormAssistantController } from './state-form-assistant.controller';
import { IntentTools } from './tools/intent.tools';
import { ReviewTools } from './tools/review.tools';
import { StateGlobalFormTools } from './tools/state-global-form.tools';
import { TenantConfigTools } from './tools/tenant-config.tools';
import { TenantFormTools } from './tools/tenant-form.tools';
import { TenantWorkflowTools } from './tools/tenant-workflow.tools';
import { SetupToolRegistry } from './tools/tool-registry';

@Module({
  imports: [AdminTenantModule, AdminStateModule, ChatbotModule],
  controllers: [ServiceSetupAssistantController, StateFormAssistantController],
  providers: [
    SetupSessionService,
    ReadinessChecklistService,
    ServiceSetupAssistantService,
    TenantFormTools,
    TenantWorkflowTools,
    TenantConfigTools,
    IntentTools,
    ReviewTools,
    StateGlobalFormTools,
    SetupToolRegistry,
  ],
})
export class ServiceSetupAssistantModule {}
