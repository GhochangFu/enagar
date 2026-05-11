import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { ApplicationsModule } from '../applications/applications.module';
import { GrievancesModule } from '../grievances/grievances.module';
import { PaymentsModule } from '../payments/payments.module';
import { TenantsModule } from '../tenants/tenants.module';

import { CitizenHubDashboardService } from './citizen-hub-dashboard.service';
import { CITIZEN_STORE } from './citizen-store';
import { CitizenController } from './citizen.controller';
import { CitizenService } from './citizen.service';
import { InMemoryCitizenStore } from './in-memory-citizen.store';
import { PostgresCitizenStore } from './postgres-citizen.store';

@Module({
  imports: [DatabaseModule, TenantsModule, ApplicationsModule, PaymentsModule, GrievancesModule],
  controllers: [CitizenController],
  providers: [
    InMemoryCitizenStore,
    PostgresCitizenStore,
    {
      provide: CITIZEN_STORE,
      useExisting: PostgresCitizenStore,
    },
    CitizenService,
    CitizenHubDashboardService,
  ],
})
export class CitizenModule {}
