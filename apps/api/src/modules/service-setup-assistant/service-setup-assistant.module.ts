import { Module } from '@nestjs/common';

import { AdminStateModule } from '../admin-state/admin-state.module';
import { AdminTenantModule } from '../admin-tenant/admin-tenant.module';
import { ChatbotModule } from '../chatbot/chatbot.module';

import { ReadinessChecklistService } from './readiness-checklist.service';
import { ServiceSetupAssistantController } from './service-setup-assistant.controller';
import { ServiceSetupAssistantService } from './service-setup-assistant.service';
import { SetupSessionService } from './setup-session.service';
import { StateFormAssistantController } from './state-form-assistant.controller';
import { StateGlobalFormTools } from './tools/state-global-form.tools';
import { TenantFormTools } from './tools/tenant-form.tools';
import { SetupToolRegistry } from './tools/tool-registry';

@Module({
  imports: [AdminTenantModule, AdminStateModule, ChatbotModule],
  controllers: [ServiceSetupAssistantController, StateFormAssistantController],
  providers: [
    SetupSessionService,
    ReadinessChecklistService,
    ServiceSetupAssistantService,
    TenantFormTools,
    StateGlobalFormTools,
    SetupToolRegistry,
  ],
})
export class ServiceSetupAssistantModule {}
