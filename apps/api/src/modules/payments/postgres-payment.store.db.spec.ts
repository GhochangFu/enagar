import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../common/database/prisma.service';
import { PostgresApplicationStore } from '../applications/postgres-application.store';
import { CITIZEN_PORTAL_TENANT_CODE, tenantSeeds } from '../tenants/tenant.seed';
import { TenantsService } from '../tenants/tenants.service';

import { STUB_GATEWAY_DEBIT_ACCOUNT_CODE } from './payment-financial.constants';
import { PostgresPaymentStore } from './postgres-payment.store';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { ApplicationResponse } from '../applications/dto';

const describeDb = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

/** Must be after `created_at` at insert time (DB: `expires_at > created_at`). */
function idempotencyExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

describeDb('PostgresPaymentStore DB integration', () => {
  const prisma = new PrismaService();
  const applicationStore = new PostgresApplicationStore(prisma);
  const paymentStore = new PostgresPaymentStore(prisma, {
    list: async () =>
      tenantSeeds.filter((t) => t.is_active && t.code !== CITIZEN_PORTAL_TENANT_CODE),
  } as TenantsService);
  const tenantId = randomUUID();
  const tenantCode = `P${Date.now().toString().slice(-8)}`;
  const serviceCode = 'birth-cert-pay-db';
  const citizenSubject = `citizen-pay-${Date.now()}`;
  const applicationId = randomUUID();
  const settleApplicationId = randomUUID();
  const docketNo = `WBM/${tenantCode}/${serviceCode}/2026/00001`;
  const paymentId = randomUUID();
  const requestFingerprint = 'a'.repeat(64);

  const application: ApplicationResponse = {
    id: applicationId,
    docket_no: docketNo,
    tenant_id: tenantId,
    tenant_code: tenantCode,
    citizen_subject: citizenSubject,
    service_code: serviceCode,
    service_name: 'Birth Certificate',
    form_version: 1,
    workflow_code: 'cert-issuance-v1',
    workflow_version: 1,
    current_stage: 'front-office-review',
    status: 'submitted',
    status_label: 'Front-office review',
    pending_role: 'front-office',
    payment_status: 'pending',
    form_data: { applicant_name: 'Aritra Sen' },
    submitted_at: '2026-05-08T10:00:00.000Z',
    timeline: [],
    comments: [],
    documents: [],
  };

  beforeAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });

    const tenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        code: tenantCode,
        name: 'Phase 3.1A Payment Test Tenant',
        languagesEnabled: ['en', 'bn', 'hi'],
      },
    });
    const department = await prisma.tenantDepartment.create({
      data: {
        tenantId: tenant.id,
        code: 'birth-death',
        name: { en: 'Birth & Death', bn: 'Birth & Death', hi: 'Birth & Death' },
      },
    });
    const category = await prisma.tenantServiceCategory.create({
      data: {
        tenantId: tenant.id,
        departmentId: department.id,
        code: 'cert',
        name: { en: 'Test', bn: 'Test', hi: 'Test' },
      },
    });
    await prisma.citizen.create({
      data: {
        tenantId: tenant.id,
        keycloakSubject: citizenSubject,
        mobile: '9876500002',
        name: 'Aritra Sen',
      },
    });
    await prisma.tenantService.create({
      data: {
        tenantId: tenant.id,
        code: serviceCode,
        categoryId: category.id,
        departmentId: department.id,
        globalCategoryCode: 'cert',
        name: { en: 'Birth Certificate', bn: 'Birth Certificate', hi: 'Birth Certificate' },
        description: { en: 'Test service', bn: 'Test service', hi: 'Test service' },
        effectiveFeeConfig: { amount_paise: 5000, currency: 'INR' },
        requiredDocuments: [],
      },
    });
    await applicationStore.save(application);
    await applicationStore.save({
      ...application,
      id: settleApplicationId,
      docket_no: `WBM/${tenantCode}/${serviceCode}/2026/00002`,
    });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('persists a payment and idempotency key for an existing application FK', async () => {
    const payment = await paymentStore.createPendingPayment({
      id: paymentId,
      tenantId,
      citizenSubject,
      applicationId,
      feeCode: 'application',
      amountPaise: 5000,
      method: 'upi',
      gateway: 'stub',
      gatewayOrderId: `stub_order_${paymentId}`,
      redirectUrl: '/payments/stub/complete',
      idempotencyKey: 'same-key',
      requestFingerprint,
      expiresAt: idempotencyExpiry(),
    });

    expect(payment).toMatchObject({
      id: paymentId,
      application_id: applicationId,
      status: 'requires_action',
      gateway_order_id: `stub_order_${paymentId}`,
    });
    await expect(
      paymentStore.findIdempotencyRecord(
        {
          subject: citizenSubject,
          tenantId,
          tenantCode,
          roles: ['citizen'],
          expiresAt: new Date('2026-05-08T00:00:00.000Z'),
        },
        'same-key',
      ),
    ).resolves.toEqual({
      fingerprint: requestFingerprint,
      paymentId,
    });
    await expect(paymentStore.findActivePaymentByApplication(applicationId)).resolves.toMatchObject(
      {
        id: paymentId,
      },
    );
  });

  it('settles stub capture with receipt + gl rows (Sprint 3.2)', async () => {
    const settlePaymentId = randomUUID();

    await paymentStore.createPendingPayment({
      id: settlePaymentId,
      tenantId,
      citizenSubject,
      applicationId: settleApplicationId,
      feeCode: 'application',
      amountPaise: 5000,
      method: 'upi',
      gateway: 'stub',
      gatewayOrderId: `stub_order_${settlePaymentId}`,
      redirectUrl: '/payments/stub/complete',
      idempotencyKey: `settle-${settlePaymentId}`,
      requestFingerprint,
      expiresAt: idempotencyExpiry(),
    });

    const principal = {
      subject: citizenSubject,
      tenantId,
      tenantCode,
      roles: ['citizen'],
      expiresAt: new Date('2026-05-08T00:00:00.000Z'),
    } satisfies AuthenticatedPrincipal;

    const ledger = await paymentStore.settleStubLedger(
      principal,
      settlePaymentId,
      `stub_order_${settlePaymentId}`,
      {
        revenueHeadCode: 'cert-fee',
        accountingCode: 'RH-CERT',
        serviceCode,
      },
    );

    expect(ledger.payment.status).toBe('settled');
    await expect(
      prisma.glPosting.findFirst({ where: { paymentId: settlePaymentId } }),
    ).resolves.toMatchObject({
      debitAccountCode: STUB_GATEWAY_DEBIT_ACCOUNT_CODE,
      creditAccountCode: 'RH-CERT',
      amountPaise: 5000,
    });
    await expect(
      prisma.receipt.findFirst({ where: { paymentId: settlePaymentId } }),
    ).resolves.toMatchObject({
      revenueHeadCode: 'cert-fee',
    });
    await expect(
      paymentStore.findReceiptForPayment(principal, settlePaymentId),
    ).resolves.not.toBeNull();
  });
});
