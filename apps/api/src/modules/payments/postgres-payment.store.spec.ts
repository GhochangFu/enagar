import { PostgresPaymentStore } from './postgres-payment.store';

import type { PrismaService } from '../../common/database/prisma.service';

describe('PostgresPaymentStore', () => {
  it('creates a pending payment and idempotency key in one transaction', async () => {
    const paymentRow = {
      id: 'payment-id',
      tenantId: 'tenant-id',
      citizenSubject: 'citizen-a',
      applicationId: 'application-id',
      amountPaise: 5000,
      currency: 'INR',
      method: 'upi',
      status: 'requires_action',
      gateway: 'stub',
      gatewayOrderId: 'stub_order_payment-id',
      createdAt: new Date('2026-05-08T10:00:00.000Z'),
      updatedAt: new Date('2026-05-08T10:00:00.000Z'),
    };
    const paymentCreate = jest.fn().mockResolvedValue(paymentRow);
    const idempotencyCreate = jest.fn().mockResolvedValue({});
    const transaction = jest.fn(async (callback) =>
      callback({
        payment: { create: paymentCreate },
        paymentIdempotencyKey: { create: idempotencyCreate },
      }),
    );
    const store = new PostgresPaymentStore({
      $transaction: transaction,
    } as unknown as PrismaService);

    const payment = await store.createPendingPayment({
      id: 'payment-id',
      tenantId: 'tenant-id',
      citizenSubject: 'citizen-a',
      applicationId: 'application-id',
      amountPaise: 5000,
      method: 'upi',
      gateway: 'stub',
      gatewayOrderId: 'stub_order_payment-id',
      redirectUrl: '/payments/stub/complete',
      idempotencyKey: 'same-key',
      requestFingerprint: 'f'.repeat(64),
      expiresAt: new Date('2026-05-09T10:00:00.000Z'),
    });

    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'payment-id',
        tenantId: 'tenant-id',
        applicationId: 'application-id',
        amountPaise: 5000,
        gateway: 'stub',
        gatewayOrderId: 'stub_order_payment-id',
      }),
    });
    expect(idempotencyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-id',
        citizenSubject: 'citizen-a',
        idempotencyKey: 'same-key',
        requestFingerprint: 'f'.repeat(64),
        paymentId: 'payment-id',
      }),
    });
    expect(payment).toMatchObject({
      id: 'payment-id',
      status: 'requires_action',
      gateway_order_id: 'stub_order_payment-id',
    });
  });

  it('finds idempotency records by tenant, citizen, and key', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      requestFingerprint: 'f'.repeat(64),
      paymentId: 'payment-id',
    });
    const store = new PostgresPaymentStore({
      paymentIdempotencyKey: {
        findUnique,
      },
    } as unknown as PrismaService);

    const record = await store.findIdempotencyRecord(
      {
        subject: 'citizen-a',
        tenantId: 'tenant-id',
        tenantCode: 'KMC',
        roles: ['citizen'],
        expiresAt: new Date('2026-05-08T00:00:00.000Z'),
      },
      'same-key',
    );

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_citizenSubject_idempotencyKey: {
          tenantId: 'tenant-id',
          citizenSubject: 'citizen-a',
          idempotencyKey: 'same-key',
        },
      },
      select: {
        requestFingerprint: true,
        paymentId: true,
      },
    });
    expect(record).toEqual({
      fingerprint: 'f'.repeat(64),
      paymentId: 'payment-id',
    });
  });

  it('scopes idempotency lookup with idempotencyTenantId when provided', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const store = new PostgresPaymentStore({
      paymentIdempotencyKey: {
        findUnique,
      },
    } as unknown as PrismaService);

    const municipalTenantId = '11111111-1111-4111-8111-111111111111';

    await store.findIdempotencyRecord(
      {
        subject: 'citizen-a',
        tenantId: '99999999-9999-4999-8999-999999999999',
        tenantCode: 'WBPORTAL',
        roles: ['citizen'],
        expiresAt: new Date('2026-05-08T00:00:00.000Z'),
      },
      'idem-1',
      municipalTenantId,
    );

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_citizenSubject_idempotencyKey: {
          tenantId: municipalTenantId,
          citizenSubject: 'citizen-a',
          idempotencyKey: 'idem-1',
        },
      },
      select: {
        requestFingerprint: true,
        paymentId: true,
      },
    });
  });
});
