import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { InMemoryApplicationStore } from '../applications/in-memory-application.store';
import { ServicesService } from '../services/services.service';
import { CITIZEN_PORTAL_TENANT_CODE, CITIZEN_PORTAL_TENANT_ID } from '../tenants/tenant.seed';
import { TenantsService } from '../tenants/tenants.service';

import { InMemoryPaymentStore } from './in-memory-payment.store';
import { PaymentsService } from './payments.service';
import { StubPaymentGateway } from './stub-payment.gateway';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

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

describe('PaymentsService', () => {
  let applications: ApplicationsService;
  let payments: PaymentsService;
  let prisma: { glPosting: { findMany: jest.Mock } };

  beforeEach(() => {
    prisma = {
      glPosting: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const services = new ServicesService();
    applications = new ApplicationsService(
      services,
      new TenantsService(),
      new InMemoryApplicationStore(),
    );
    payments = new PaymentsService(
      applications,
      services,
      new StubPaymentGateway(),
      new InMemoryPaymentStore(),
      prisma as unknown as PrismaService,
    );
  });

  it('initiates a stub payment for a fixed-fee application', async () => {
    const application = await applications.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    const payment = await payments.initiate(
      citizenA,
      {
        application_id: application.id,
        amount_paise: 5000,
        method: 'upi',
      },
      'birth-cert-payment-1',
    );

    expect(payment.status).toBe('requires_action');
    expect(payment.gateway).toBe('stub');
    expect(payment.redirect_url).toContain(payment.id);
    await expect(
      applications.getByDocketNo(citizenA, application.docket_no),
    ).resolves.toMatchObject({
      payment_status: 'pending',
    });
  });

  it('returns the same payment for an idempotent retry', async () => {
    const application = await applications.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });
    const dto = {
      application_id: application.id,
      amount_paise: 5000,
      method: 'upi' as const,
    };

    const first = await payments.initiate(citizenA, dto, 'retry-key');
    const second = await payments.initiate(citizenA, dto, 'retry-key');

    expect(second.id).toBe(first.id);
    await expect(payments.list(citizenA)).resolves.toHaveLength(1);
  });

  it('rejects idempotency key reuse with a different request body', async () => {
    const application = await applications.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });
    await payments.initiate(
      citizenA,
      {
        application_id: application.id,
        amount_paise: 5000,
        method: 'upi',
      },
      'same-key',
    );

    await expect(
      payments.initiate(
        citizenA,
        {
          application_id: application.id,
          amount_paise: 5000,
          method: 'card',
        },
        'same-key',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects cross-tenant payment reads and mutations as not found', async () => {
    const application = await applications.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });
    const payment = await payments.initiate(
      citizenA,
      {
        application_id: application.id,
        amount_paise: 5000,
        method: 'upi',
      },
      'tenant-key',
    );

    await expect(payments.getById(citizenB, payment.id)).rejects.toThrow(NotFoundException);
    await expect(
      payments.initiate(
        citizenB,
        {
          application_id: application.id,
          amount_paise: 5000,
          method: 'upi',
        },
        'cross-tenant-key',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects mismatched or unsupported fee amounts', async () => {
    const application = await applications.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    await expect(
      payments.initiate(
        citizenA,
        {
          application_id: application.id,
          amount_paise: 1,
          method: 'upi',
        },
        'wrong-amount',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('settles deterministic stub captures and attaches receipt artefacts', async () => {
    const application = await applications.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    const payment = await payments.initiate(
      citizenA,
      {
        application_id: application.id,
        amount_paise: 5000,
        method: 'upi',
      },
      'settle-flow',
    );

    const ledger = await payments.completeStubPayment(citizenA, {
      payment_id: payment.id,
      gateway_order_id: StubPaymentGateway.expectedOrderIdForPayment(payment.id),
    });

    expect(ledger.payment.status).toBe('settled');
    expect(ledger.receipt.qr_contract.format).toBe('enagar_receipt_verify_v1');
    expect(ledger.receipt.verification_path).toContain('/api/public/receipts/verify/');

    await expect(payments.receiptForOwnedPayment(citizenA, payment.id)).resolves.toMatchObject({
      receipt_number: ledger.receipt.receipt_number,
    });

    await expect(
      applications.getByDocketNo(citizenA, application.docket_no),
    ).resolves.toMatchObject({
      payment_status: 'paid',
    });
  });

  it('does not settle twice without idempotent replay safeguards', async () => {
    const application = await applications.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    const payment = await payments.initiate(
      citizenA,
      {
        application_id: application.id,
        amount_paise: 5000,
        method: 'upi',
      },
      'double-settle',
    );

    const dto = {
      payment_id: payment.id,
      gateway_order_id: StubPaymentGateway.expectedOrderIdForPayment(payment.id),
    };

    await payments.completeStubPayment(citizenA, dto);
    await expect(payments.completeStubPayment(citizenA, dto)).rejects.toThrow(ConflictException);
  });

  it('allows finance exports for privileged roles only', async () => {
    const financePrincipal = { ...citizenA, roles: [...citizenA.roles, 'tenant_admin'] };

    await expect(payments.exportReconciliationCsv(citizenA, '2026-05-10')).rejects.toThrow(
      ForbiddenException,
    );

    const csv = await payments.exportReconciliationCsv(financePrincipal, '2026-05-10');
    expect(csv).toContain('tenant_id');

    await expect(payments.exportReconciliationCsv(financePrincipal, 'not-a-date')).rejects.toThrow(
      BadRequestException,
    );

    expect(prisma.glPosting.findMany).toHaveBeenCalled();
  });

  describe('portal hub read scope', () => {
    let store: InMemoryPaymentStore;
    let hubPayments: PaymentsService;
    let hubApplications: ApplicationsService;
    const prismaStub = { glPosting: { findMany: jest.fn().mockResolvedValue([]) } };

    const portalPrincipal: AuthenticatedPrincipal = {
      subject: 'hub-pay-user',
      tenantId: CITIZEN_PORTAL_TENANT_ID,
      tenantCode: CITIZEN_PORTAL_TENANT_CODE,
      roles: ['citizen'],
      expiresAt: new Date('2026-05-08T00:00:00.000Z'),
    };

    beforeEach(() => {
      store = new InMemoryPaymentStore();
      const services = new ServicesService();
      hubApplications = new ApplicationsService(
        services,
        new TenantsService(),
        new InMemoryApplicationStore(),
      );
      hubPayments = new PaymentsService(
        hubApplications,
        services,
        new StubPaymentGateway(),
        store,
        prismaStub as unknown as PrismaService,
      );
    });

    it('lists payments across municipal tenants for portal subject; scope filters one ULB', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      await store.createPendingPayment({
        id: 'pay-kmc',
        tenantId: citizenA.tenantId,
        citizenSubject: portalPrincipal.subject,
        applicationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        amountPaise: 5000,
        method: 'upi',
        gateway: 'stub',
        gatewayOrderId: 'o1',
        redirectUrl: 'http://local/r1',
        idempotencyKey: 'ik-kmc',
        requestFingerprint: 'fp1',
        expiresAt,
      });
      await store.createPendingPayment({
        id: 'pay-hmc',
        tenantId: citizenB.tenantId,
        citizenSubject: portalPrincipal.subject,
        applicationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        amountPaise: 5000,
        method: 'upi',
        gateway: 'stub',
        gatewayOrderId: 'o2',
        redirectUrl: 'http://local/r2',
        idempotencyKey: 'ik-hmc',
        requestFingerprint: 'fp2',
        expiresAt,
      });

      await expect(hubPayments.list(portalPrincipal)).resolves.toHaveLength(2);
      await expect(
        hubPayments.list(portalPrincipal, { municipalityTenantCode: 'KMC' }),
      ).resolves.toHaveLength(1);
      await expect(hubPayments.getById(portalPrincipal, 'pay-hmc')).resolves.toMatchObject({
        id: 'pay-hmc',
      });
      await expect(
        hubPayments.getById(portalPrincipal, 'pay-hmc', { municipalityTenantCode: 'KMC' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('initiate and stub complete bind payment and receipt to the application ULB, not the portal JWT tenant', async () => {
      const draft = await hubApplications.createDraft(
        portalPrincipal,
        { service_code: 'birth-cert', form_data: birthCertificateForm },
        'KMC',
      );
      const submitted = await hubApplications.submitDraft(portalPrincipal, draft.id, {
        enforceCleanDocuments: false,
      });
      expect(submitted.tenant_id).toBe(citizenA.tenantId);

      const first = await hubPayments.initiate(
        portalPrincipal,
        {
          application_id: submitted.id,
          amount_paise: 5000,
          method: 'upi',
        },
        'portal-kmc-pay-idem',
      );
      const second = await hubPayments.initiate(
        portalPrincipal,
        {
          application_id: submitted.id,
          amount_paise: 5000,
          method: 'upi',
        },
        'portal-kmc-pay-idem',
      );
      expect(second.id).toBe(first.id);
      expect(first.tenant_id).toBe(citizenA.tenantId);

      const ledger = await hubPayments.completeStubPayment(portalPrincipal, {
        payment_id: first.id,
        gateway_order_id: StubPaymentGateway.expectedOrderIdForPayment(first.id),
      });

      expect(ledger.receipt.receipt_number.toUpperCase()).toContain('KMC');
    });
  });
});
