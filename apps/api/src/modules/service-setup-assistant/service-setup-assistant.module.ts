import { Module } from '@nestjs/common';

import { AdminTenantModule } from '../admin-tenant/admin-tenant.module';

import { ReadinessChecklistService } from './readiness-checklist.service';
import { ServiceSetupAssistantController } from './service-setup-assistant.controller';
import { SetupSessionService } from './setup-session.service';

@Module({
  imports: [AdminTenantModule],
  controllers: [ServiceSetupAssistantController],
  providers: [SetupSessionService, ReadinessChecklistService],
})
export class ServiceSetupAssistantModule {}
