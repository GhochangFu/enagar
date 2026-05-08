import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { TenantsModule } from '../tenants/tenants.module';

import { CITIZEN_STORE } from './citizen-store';
import { CitizenController } from './citizen.controller';
import { CitizenService } from './citizen.service';
import { InMemoryCitizenStore } from './in-memory-citizen.store';
import { PostgresCitizenStore } from './postgres-citizen.store';

@Module({
  imports: [DatabaseModule, TenantsModule],
  controllers: [CitizenController],
  providers: [
    InMemoryCitizenStore,
    PostgresCitizenStore,
    {
      provide: CITIZEN_STORE,
      useExisting: PostgresCitizenStore,
    },
    CitizenService,
  ],
})
export class CitizenModule {}
