import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { ApplicationsModule } from '../applications/applications.module';
import { ServicesModule } from '../services/services.module';
import { TenantsModule } from '../tenants/tenants.module';

import { InMemoryPaymentStore } from './in-memory-payment.store';
import { PAYMENT_STORE } from './payment-store';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PostgresPaymentStore } from './postgres-payment.store';
import { PublicReceiptsController } from './public-receipts.controller';
import { ReceiptVerificationService } from './receipt-verification.service';
import { StubPaymentGateway } from './stub-payment.gateway';

@Module({
  imports: [ApplicationsModule, DatabaseModule, ServicesModule, TenantsModule],
  controllers: [PaymentsController, PublicReceiptsController],
  providers: [
    InMemoryPaymentStore,
    PostgresPaymentStore,
    ReceiptVerificationService,
    StubPaymentGateway,
    {
      provide: 'IPaymentGateway',
      useExisting: StubPaymentGateway,
    },
    {
      provide: PAYMENT_STORE,
      useFactory: (inMemoryStore: InMemoryPaymentStore, postgresStore: PostgresPaymentStore) =>
        process.env.PAYMENT_STORE_PROVIDER === 'postgres' ? postgresStore : inMemoryStore,
      inject: [InMemoryPaymentStore, PostgresPaymentStore],
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
