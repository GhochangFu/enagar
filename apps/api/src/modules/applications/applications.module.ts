import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { ServicesModule } from '../services/services.module';
import { TenantsModule } from '../tenants/tenants.module';

import { APPLICATION_STORE } from './application-store';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { InMemoryApplicationStore } from './in-memory-application.store';
import { PostgresApplicationStore } from './postgres-application.store';

@Module({
  imports: [DatabaseModule, ServicesModule, TenantsModule],
  controllers: [ApplicationsController],
  providers: [
    InMemoryApplicationStore,
    PostgresApplicationStore,
    {
      provide: APPLICATION_STORE,
      useFactory: (
        inMemoryStore: InMemoryApplicationStore,
        postgresStore: PostgresApplicationStore,
      ) => (process.env.APPLICATION_STORE_PROVIDER === 'postgres' ? postgresStore : inMemoryStore),
      inject: [InMemoryApplicationStore, PostgresApplicationStore],
    },
    ApplicationsService,
  ],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
