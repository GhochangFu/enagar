/**
 * Manual smoke-test mirror: portal hub vs workspace + holdings scope (Sprint 2.1).
 * Runs without a live server — uses supertest + mocked auth guard.
 */
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

import { CITIZEN_MUNICIPALITY_SCOPE_HEADER } from '../../common/auth/citizen-scope';
import { PrismaService } from '../../common/database/prisma.service';
import { DocumentScanQueueService } from '../../common/document-scan/document-scan.queue';
import { DocumentsModule } from '../documents/documents.module';
import { createMockApplicationDocumentPrisma } from '../documents/testing/mock-application-document-prisma';
import { createMockDocumentScanQueue } from '../documents/testing/mock-document-scan-queue';
import { HoldingsModule } from '../holdings/holdings.module';
import { ServicesModule } from '../services/services.module';
import { CITIZEN_PORTAL_TENANT_CODE, CITIZEN_PORTAL_TENANT_ID } from '../tenants/tenant.seed';

import { APPLICATION_STORE } from './application-store';
import { ApplicationsModule } from './applications.module';
import { InMemoryApplicationStore } from './in-memory-application.store';

import type { ApplicationResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { FormSubmission } from '@enagar/forms';

const citizenKmc: AuthenticatedPrincipal = {
  subject: 'citizen-kmc',
  tenantId: '11111111-1111-4111-8111-111111111111',
  tenantCode: 'KMC',
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

const portalCitizen: AuthenticatedPrincipal = {
  subject: 'hub-smoke-user',
  tenantId: CITIZEN_PORTAL_TENANT_ID,
  tenantCode: CITIZEN_PORTAL_TENANT_CODE,
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

function stubApplication(
  partial: Pick<
    ApplicationResponse,
    'id' | 'docket_no' | 'tenant_id' | 'tenant_code' | 'citizen_subject'
  >,
): ApplicationResponse {
  const now = new Date().toISOString();
  return {
    ...partial,
    service_code: 'birth-cert',
    service_name: 'Birth Certificate',
    form_version: 1,
    workflow_code: 'cert-issuance-v1',
    workflow_version: 1,
    current_stage: 'submitted',
    status: 'submitted',
    status_label: 'Submitted',
    pending_role: 'reviewer',
    payment_status: 'pending',
    form_data: {} as FormSubmission,
    submitted_at: now,
    timeline: [],
    comments: [],
    documents: [],
  };
}

describe('Hub scope HTTP smoke (Sprint 2.1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const store = new InMemoryApplicationStore();
    await store.save(
      stubApplication({
        id: 'kmc-hub',
        docket_no: 'WBM/KMC/birth-cert/2026/hub01',
        tenant_id: citizenKmc.tenantId,
        tenant_code: 'KMC',
        citizen_subject: portalCitizen.subject,
      }),
    );
    await store.save(
      stubApplication({
        id: 'hmc-hub',
        docket_no: 'WBM/HMC/birth-cert/2026/hub02',
        tenant_id: '22222222-2222-4222-8222-222222222222',
        tenant_code: 'HMC',
        citizen_subject: portalCitizen.subject,
      }),
    );
    await store.save(
      stubApplication({
        id: 'kmc-only',
        docket_no: 'WBM/KMC/birth-cert/2026/muni01',
        tenant_id: citizenKmc.tenantId,
        tenant_code: 'KMC',
        citizen_subject: citizenKmc.subject,
      }),
    );

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

              if (token === 'portal') {
                requestWithAuth.auth = portalCitizen;
                return true;
              }
              if (token === 'kmc-citizen') {
                requestWithAuth.auth = citizenKmc;
                return true;
              }
              throw new UnauthorizedException('Invalid test token');
            },
          } satisfies CanActivate,
        },
      ],
    })
      .overrideProvider(APPLICATION_STORE)
      .useValue(store)
      .overrideProvider(PrismaService)
      .useValue(createMockApplicationDocumentPrisma())
      .overrideProvider(DocumentScanQueueService)
      .useValue(createMockDocumentScanQueue())
      .compile();

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

  it('portal: hub lists all ULBs for same subject', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/applications')
      .set('authorization', 'Bearer portal');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });

  it('portal: workspace header filters to one ULB', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/applications')
      .set('authorization', 'Bearer portal')
      .set(CITIZEN_MUNICIPALITY_SCOPE_HEADER, 'KMC');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].tenant_code).toBe('KMC');
  });

  it('portal: cross-ULB docket ok unscoped; 404 when scoped to wrong ULB', async () => {
    const docket = 'WBM/HMC/birth-cert/2026/hub02';
    const pathSegment = encodeURIComponent(docket);

    await request(app.getHttpServer())
      .get(`/api/applications/${pathSegment}`)
      .set('authorization', 'Bearer portal')
      .expect(200)
      .expect((res) => {
        expect(res.body.tenant_code).toBe('HMC');
      });

    await request(app.getHttpServer())
      .get(`/api/applications/${pathSegment}`)
      .set('authorization', 'Bearer portal')
      .set(CITIZEN_MUNICIPALITY_SCOPE_HEADER, 'KMC')
      .expect(404);
  });

  it('portal: holdings require scope header', async () => {
    await request(app.getHttpServer())
      .get('/api/holdings/KMC-064-PARK-12B')
      .set('authorization', 'Bearer portal')
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/holdings/KMC-064-PARK-12B')
      .set('authorization', 'Bearer portal')
      .set(CITIZEN_MUNICIPALITY_SCOPE_HEADER, 'KMC')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ found: true });
      });
  });

  it('municipal JWT: list stays tenant-bound; header ignored for access model', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/applications')
      .set('authorization', 'Bearer kmc-citizen')
      .set(CITIZEN_MUNICIPALITY_SCOPE_HEADER, 'HMC');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].docket_no).toBe('WBM/KMC/birth-cert/2026/muni01');
  });
});
