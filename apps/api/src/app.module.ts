import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { TenantContextMiddleware } from './common/tenant-context.middleware';
import { HealthModule } from './modules/health/health.module';

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
    HealthModule,
  ],
  providers: [TenantContextMiddleware],
})
export class AppModule {}
