/**
 * Executable smoke mirror for Sprint 3.2 — portal JWT + KMC-scoped draft,
 * initiate (idempotent), stub complete, receipt HTTP read. No live server or Postgres required.
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

import { PrismaService } from '../../common/database/prisma.service';
import { DocumentsModule } from '../documents/documents.module';
import { CITIZEN_PORTAL_TENANT_CODE, CITIZEN_PORTAL_TENANT_ID } from '../tenants/tenant.seed';

import { PaymentsModule } from './payments.module';
import { StubPaymentGateway } from './stub-payment.gateway';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

const CITIZEN_KMC_UUID = '11111111-1111-4111-8111-111111111111';

const portalSmoke: AuthenticatedPrincipal = {
  subject: 'smoke-pay-portal',
  tenantId: CITIZEN_PORTAL_TENANT_ID,
  tenantCode: CITIZEN_PORTAL_TENANT_CODE,
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

const birthCertificateForm = {
  applicant_name: 'Smoke User',
  mobile: '9876543210',
  child_name: 'Child',
  date_of_birth: '2026-01-01',
  relationship: 'parent',
  hospital_discharge: {
    name: 'birth-proof.pdf',
    mime_type: 'application/pdf',
    size_mb: 1,
  },
};

function prismaSmokeMock(): Partial<PrismaService> {
  return {
    glPosting: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('Payment portal HTTP smoke (Sprint 3.2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env.PAYMENT_STORE_PROVIDER;
    delete process.env.APPLICATION_STORE_PROVIDER;

    const moduleRef = await Test.createTestingModule({
      imports: [PaymentsModule, DocumentsModule],
      providers: [
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: ExecutionContext): boolean => {
              const req = context.switchToHttp().getRequest<{
                headers: { authorization?: string };
                auth?: AuthenticatedPrincipal;
              }>();
              const token = req.headers.authorization?.replace(/^Bearer /i, '');
              if (token === 'portal-pay-smoke') {
                req.auth = portalSmoke;
                return true;
              }
              throw new UnauthorizedException('Invalid test token');
            },
          } satisfies CanActivate,
        },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaSmokeMock())
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

  it('draft KMC → submit → initiate ×2 → stub complete → receipt (municipal tenant, not WBPORTAL)', async () => {
    const auth = () => ({
      Authorization: 'Bearer portal-pay-smoke',
    });
    const kmcScope = 'x-enagar-tenant-code';

    const draft = (
      await request(app.getHttpServer())
        .post('/api/applications/drafts')
        .set(auth())
        .set(kmcScope, 'KMC')
        .send({
          service_code: 'birth-cert',
          form_data: birthCertificateForm,
        })
        .expect(201)
    ).body;

    expect(draft.tenant_id).toBe(CITIZEN_KMC_UUID);
    expect(draft.tenant_code).toBe('KMC');

    const intent = (
      await request(app.getHttpServer())
        .post('/api/documents/upload-intent')
        .set(auth())
        .send({
          application_id: draft.id,
          document_code: 'hospital_discharge',
          original_name: 'Birth Proof.pdf',
          mime_type: 'application/pdf',
          size_mb: 1,
        })
        .expect(201)
    ).body;

    await request(app.getHttpServer())
      .post(`/api/documents/${intent.id}/scan-result`)
      .set(auth())
      .send({ scan_status: 'clean', scan_provider: 'portal-smoke' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/applications/${draft.id}/submit`)
      .set(auth())
      .expect(201);

    const idemKey = `smoke-idem-${Date.now()}`;
    const payBody = {
      application_id: draft.id,
      amount_paise: 5000,
      method: 'upi',
    };

    const first = (
      await request(app.getHttpServer())
        .post('/api/payments/initiate')
        .set(auth())
        .set('Idempotency-Key', idemKey)
        .send(payBody)
        .expect(201)
    ).body;

    expect(first.tenant_id).toBe(CITIZEN_KMC_UUID);
    expect(first.tenant_id).not.toBe(CITIZEN_PORTAL_TENANT_ID);

    const second = (
      await request(app.getHttpServer())
        .post('/api/payments/initiate')
        .set(auth())
        .set('Idempotency-Key', idemKey)
        .send(payBody)
        .expect(201)
    ).body;

    expect(second.id).toBe(first.id);

    const ledger = (
      await request(app.getHttpServer())
        .post('/api/payments/stub/complete')
        .set(auth())
        .send({
          payment_id: first.id,
          gateway_order_id: StubPaymentGateway.expectedOrderIdForPayment(first.id),
        })
        .expect(201)
    ).body;

    expect(String(ledger.receipt.receipt_number).toUpperCase()).toContain('KMC');

    await request(app.getHttpServer())
      .get(`/api/payments/${first.id}/receipt`)
      .set(auth())
      .expect(200)
      .expect((res) => {
        expect(res.body.payment_id).toBe(first.id);
        expect(String(res.body.receipt_number).toUpperCase()).toContain('KMC');
      });

    await request(app.getHttpServer())
      .get('/api/payments')
      .set(auth())
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((row: { id: string }) => row.id === first.id)).toBe(true);
      });
  });
});
