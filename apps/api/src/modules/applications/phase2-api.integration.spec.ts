import {
  UnauthorizedException,
  ValidationPipe,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { DocumentsModule } from '../documents/documents.module';
import { HoldingsModule } from '../holdings/holdings.module';
import { ServicesModule } from '../services/services.module';

import { ApplicationsModule } from './applications.module';

import type { ApplicationResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { UploadIntentResponse } from '../documents/dto';

const citizenA: AuthenticatedPrincipal = {
  subject: 'citizen-a',
  tenantId: '11111111-1111-4111-8111-111111111111',
  tenantCode: 'KMC',
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

const citizenB: AuthenticatedPrincipal = {
  subject: 'citizen-b',
  tenantId: '22222222-2222-4222-8222-222222222222',
  tenantCode: 'HMC',
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

const birthCertificateForm = {
  applicant_name: 'Citizen A',
  mobile: '9876543210',
  child_name: 'Child A',
  date_of_birth: '2026-01-01',
  relationship: 'parent',
  hospital_discharge: {
    name: 'birth-proof.pdf',
    mime_type: 'application/pdf',
    size_mb: 1,
  },
};

describe('Phase 2 API integration contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ApplicationsModule, DocumentsModule, HoldingsModule, ServicesModule],
      providers: [
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext): boolean => {
              const requestWithAuth = context.switchToHttp().getRequest<{
                headers: { authorization?: string };
                auth?: AuthenticatedPrincipal;
              }>();
              const token = requestWithAuth.headers.authorization?.replace(/^Bearer /, '');

              if (token === 'citizen-a') {
                requestWithAuth.auth = citizenA;
                return true;
              }
              if (token === 'citizen-b') {
                requestWithAuth.auth = citizenB;
                return true;
              }
              throw new UnauthorizedException('Invalid test token');
            },
          } satisfies CanActivate,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health', 'healthz', 'ready'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('covers service catalogue, draft document upload, final submit, and tenant leaks', async () => {
    await request(app.getHttpServer())
      .get('/api/services/tenants/KMC')
      .set('authorization', 'Bearer citizen-a')
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.arrayContaining([expect.objectContaining({ code: 'birth-cert' })]),
        );
      });

    const draft = (
      await request(app.getHttpServer())
        .post('/api/applications/drafts')
        .set('authorization', 'Bearer citizen-a')
        .send({
          service_code: 'birth-cert',
          form_data: birthCertificateForm,
        })
        .expect(201)
    ).body as ApplicationResponse;

    expect(draft.status).toBe('draft');

    await request(app.getHttpServer())
      .post(`/api/applications/${draft.id}/submit`)
      .set('authorization', 'Bearer citizen-a')
      .expect(400);

    const intent = (
      await request(app.getHttpServer())
        .post('/api/documents/upload-intent')
        .set('authorization', 'Bearer citizen-a')
        .send({
          application_id: draft.id,
          document_code: 'hospital_discharge',
          original_name: 'Birth Proof.pdf',
          mime_type: 'application/pdf',
          size_mb: 1,
        })
        .expect(201)
    ).body as UploadIntentResponse;

    await request(app.getHttpServer())
      .post(`/api/documents/${intent.id}/scan-result`)
      .set('authorization', 'Bearer citizen-b')
      .send({ scan_status: 'clean' })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/documents/${intent.id}/scan-result`)
      .set('authorization', 'Bearer citizen-a')
      .send({ scan_status: 'clean', scan_provider: 'integration-test' })
      .expect(201);

    const submitted = (
      await request(app.getHttpServer())
        .post(`/api/applications/${draft.id}/submit`)
        .set('authorization', 'Bearer citizen-a')
        .expect(201)
    ).body as ApplicationResponse;

    expect(submitted.status).toBe('submitted');
    expect(submitted.timeline.map((item) => item.verb)).toEqual([
      'draft-created',
      'submit',
      'sla-armed',
    ]);

    await request(app.getHttpServer())
      .get(`/api/applications/${submitted.docket_no}`)
      .set('authorization', 'Bearer citizen-b')
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/holdings/KMC-064-PARK-12B')
      .set('authorization', 'Bearer citizen-a')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ found: true });
      });

    await request(app.getHttpServer())
      .get('/api/holdings/KMC-064-PARK-12B')
      .set('authorization', 'Bearer citizen-b')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ found: false, holding: null });
      });
  });
});
