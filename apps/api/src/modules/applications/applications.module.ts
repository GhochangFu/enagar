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
      // Default to the Postgres store whenever a `DATABASE_URL` is available so
      // dev/demo processes see existing filings, payment schedules, and
      // generated dockets. The in-memory store is opt-in for tests / offline
      // runs that need to avoid the database.
      provide: APPLICATION_STORE,
      useFactory: (
        inMemoryStore: InMemoryApplicationStore,
        postgresStore: PostgresApplicationStore,
      ) => {
        const explicit = process.env.APPLICATION_STORE_PROVIDER?.trim().toLowerCase();
        if (explicit === 'in-memory' || explicit === 'memory' || explicit === 'in_memory') {
          return inMemoryStore;
        }
        if (explicit === 'postgres') {
          return postgresStore;
        }
        return process.env.DATABASE_URL ? postgresStore : inMemoryStore;
      },
      inject: [InMemoryApplicationStore, PostgresApplicationStore],
    },
    ApplicationsService,
  ],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
