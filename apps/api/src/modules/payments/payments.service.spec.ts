import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { ApplicationsService } from '../applications/applications.service';
import { InMemoryApplicationStore } from '../applications/in-memory-application.store';
import { ServicesService } from '../services/services.service';

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

  beforeEach(() => {
    const services = new ServicesService();
    applications = new ApplicationsService(services, new InMemoryApplicationStore());
    payments = new PaymentsService(
      applications,
      services,
      new StubPaymentGateway(),
      new InMemoryPaymentStore(),
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
});
