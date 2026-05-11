import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'authorization',
      'content-type',
      'x-tenant-code',
      'x-enagar-tenant-code',
      'idempotency-key',
    ],
  });
  app.use(helmet());
  app.setGlobalPrefix('api', { exclude: ['health', 'healthz', 'ready'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // OpenAPI is mounted only outside production unless explicitly enabled.
  if (process.env.SWAGGER_ENABLED !== 'false') {
    const swagger = new DocumentBuilder()
      .setTitle('eNagarSeba API')
      .setDescription('Multi-tenant municipal services backend (Phase 0 scaffold).')
      .setVersion('0.0.0')
      .addBearerAuth()
      .build();
    const doc = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('docs', app, doc, { useGlobalPrefix: false });
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.info(`[api] listening on http://localhost:${port} (docs: /docs)`);
}

void bootstrap();
