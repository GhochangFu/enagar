import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { JwtVerifierService } from './common/auth/jwt-verifier.service';
import { DatabaseModule } from './common/database/database.module';
import { DocumentScanModule } from './common/document-scan/document-scan.module';
import { ObjectStorageModule } from './common/object-storage/object-storage.module';
import { TenantContextMiddleware } from './common/tenant-context.middleware';
import { AdminStateModule } from './modules/admin-state/admin-state.module';
import { AdminTenantModule } from './modules/admin-tenant/admin-tenant.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { CitizenModule } from './modules/citizen/citizen.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { FinanceModule } from './modules/finance/finance.module';
import { GrievancesModule } from './modules/grievances/grievances.module';
import { HealthModule } from './modules/health/health.module';
import { HoldingsModule } from './modules/holdings/holdings.module';
import { LeaseInvoicesModule } from './modules/lease-invoices/lease-invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RentalAssetsModule } from './modules/rental-assets/rental-assets.module';
import { RentalDocumentsModule } from './modules/rental-documents/rental-documents.module';
import { ServicesModule } from './modules/services/services.module';
import { TenantConfigModule } from './modules/tenant-config/tenant-config.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TransparencyModule } from './modules/transparency/transparency.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, colorize: true },
              },
        // Redact obvious PII from request logs. Full DPDP-grade redaction
        // happens at the chatbot layer (ADR-0008); this list is the
        // edge-server safety net.
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.aadhaar_number',
            'req.body.mobile',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    DatabaseModule,
    ObjectStorageModule,
    DocumentScanModule,
    AuthModule,
    BookingsModule,
    ChatbotModule,
    AdminStateModule,
    AdminTenantModule,
    ApplicationsModule,
    CitizenModule,
    DocumentsModule,
    FinanceModule,
    GrievancesModule,
    HealthModule,
    HoldingsModule,
    LeaseInvoicesModule,
    PaymentsModule,
    RentalAssetsModule,
    RentalDocumentsModule,
    ServicesModule,
    TenantConfigModule,
    TenantsModule,
    TransparencyModule,
  ],
  providers: [
    JwtVerifierService,
    TenantContextMiddleware,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
