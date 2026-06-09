import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { LeaseInvoicesService } from './lease-invoices.service';

describe('LeaseInvoicesService.recordPayment', () => {
  let service: LeaseInvoicesService;
  let prisma: {
    tenant: { findUnique: jest.Mock };
    leaseInvoice: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
    payment: { create: jest.Mock };
    receipt: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const TENANT_ID = 'tenant-1';
  const INVOICE_ID = 'invoice-1';
  const AGREEMENT_ID = 'agreement-1';

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn() },
      leaseInvoice: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
      payment: { create: jest.fn() },
      receipt: { create: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as typeof prisma;
    // $transaction just invokes the callback with itself
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) =>
      cb(prisma),
    );
    service = new LeaseInvoicesService(prisma as unknown as PrismaService);
  });

  it('throws NotFoundException when tenant does not exist', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(
      service.recordPayment('bad-tenant', INVOICE_ID, {
        method: 'CASH_AT_DESK',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when invoice is not in this tenant', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, config: {} });
    prisma.leaseInvoice.findFirst.mockResolvedValue(null);

    await expect(
      service.recordPayment('tenant-1', INVOICE_ID, { method: 'CASH_AT_DESK' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ConflictException when invoice is already PAID', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, config: {} });
    prisma.leaseInvoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      tenantId: TENANT_ID,
      agreementId: AGREEMENT_ID,
      amountPaise: 100000,
      lateFeePaise: 0,
      status: 'PAID',
    });

    await expect(
      service.recordPayment('tenant-1', INVOICE_ID, { method: 'CASH_AT_DESK' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws BadRequestException when referenceNumber is missing for non-cash offline methods', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, config: {} });
    prisma.leaseInvoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      tenantId: TENANT_ID,
      agreementId: AGREEMENT_ID,
      amountPaise: 100000,
      lateFeePaise: 0,
      status: 'PENDING',
    });

    await expect(
      service.recordPayment('tenant-1', INVOICE_ID, { method: 'BANK_TRANSFER' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('settles an offline cash payment and marks the invoice PAID', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, code: 'kmc', config: {} });
    prisma.leaseInvoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      tenantId: TENANT_ID,
      agreementId: AGREEMENT_ID,
      invoiceNo: 'INV-TEST-1',
      amountPaise: 100000,
      lateFeePaise: 0,
      status: 'PENDING',
    });
    prisma.payment.create.mockResolvedValue({ id: 'payment-1' });
    prisma.receipt.create.mockResolvedValue({ receiptNumber: 'RCP-1', id: 'receipt-1' });
    prisma.leaseInvoice.update.mockResolvedValue({ id: INVOICE_ID, status: 'PAID' });

    const result = await service.recordPayment('kmc', INVOICE_ID, { method: 'CASH_AT_DESK' });

    expect((result as { invoice: { status: string } }).invoice.status).toBe('PAID');
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaseInvoiceId: INVOICE_ID,
          amountPaise: 100000,
          method: 'cash',
          feeCode: 'rental',
          status: 'succeeded',
        }),
      }),
    );
    expect(prisma.receipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: 'payment-1',
          revenueHeadCode: 'RENT_LEASE',
        }),
      }),
    );
    expect(prisma.leaseInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: INVOICE_ID }, data: { status: 'PAID' } }),
    );
  });

  it('creates a requires_action payment for ONLINE_GATEWAY and returns redirectUrl', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: TENANT_ID, code: 'kmc', config: {} });
    prisma.leaseInvoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      tenantId: TENANT_ID,
      agreementId: AGREEMENT_ID,
      invoiceNo: 'INV-TEST-1',
      amountPaise: 100000,
      lateFeePaise: 5000,
      status: 'OVERDUE',
    });
    prisma.payment.create.mockResolvedValue({ id: 'payment-2', gatewayOrderId: 'stub_order_x' });

    const result = await service.recordPayment('kmc', INVOICE_ID, { method: 'ONLINE_GATEWAY' });

    expect((result as { redirectUrl: string }).redirectUrl).toContain('/payments/stub/complete');
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountPaise: 105000, // 100000 base + 5000 late fee
          status: 'requires_action',
        }),
      }),
    );
  });

  it('applies the tenant flat late fee when paying an OVERDUE invoice with no late fee yet', async () => {
    prisma.tenant.findUnique
      .mockResolvedValueOnce({
        id: TENANT_ID,
        code: 'kmc',
        config: { rentalLateFee: { enabled: true, flatAmountPaise: 50000 } },
      })
      .mockResolvedValueOnce({
        id: TENANT_ID,
        config: { rentalLateFee: { enabled: true, flatAmountPaise: 50000 } },
      });
    prisma.leaseInvoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      tenantId: TENANT_ID,
      agreementId: AGREEMENT_ID,
      invoiceNo: 'INV-TEST-2',
      amountPaise: 100000,
      lateFeePaise: 0,
      status: 'OVERDUE',
    });
    prisma.leaseInvoice.update.mockResolvedValue({ id: INVOICE_ID, status: 'PAID' });
    prisma.payment.create.mockResolvedValue({ id: 'payment-3' });
    prisma.receipt.create.mockResolvedValue({ receiptNumber: 'RCP-2' });

    await service.recordPayment('kmc', INVOICE_ID, { method: 'CASH_AT_DESK' });

    expect(prisma.leaseInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: INVOICE_ID }, data: { lateFeePaise: 50000 } }),
    );
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountPaise: 150000 }) }), // base 100000 + late 50000
    );
  });
});

describe('LeaseInvoicesService.lookupLeasesByPhone', () => {
  let service: LeaseInvoicesService;
  let prisma: {
    leaseAgreement: { findMany: jest.Mock };
  };

  const AGREEMENT_ID = 'agreement-1';
  const ASSET_ID = 'asset-1';
  const PHONE_RAW = '+91 98765-43210';

  beforeEach(() => {
    prisma = { leaseAgreement: { findMany: jest.fn() } } as unknown as typeof prisma;
    service = new LeaseInvoicesService(prisma as unknown as PrismaService);
  });

  it('rejects too-short phone numbers', async () => {
    await expect(service.lookupLeasesByPhone('12345')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.leaseAgreement.findMany).not.toHaveBeenCalled();
  });

  it('normalises phone digits before querying and projects the result', async () => {
    prisma.leaseAgreement.findMany.mockResolvedValue([
      {
        id: AGREEMENT_ID,
        lessorName: 'EIIL',
        lessorPhone: '9876543210',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        status: 'ACTIVE',
        asset: {
          id: ASSET_ID,
          name: { en: 'Stall 12' },
          assetType: 'MARKET_STALL',
        },
        invoices: [
          {
            id: 'inv-1',
            invoiceNo: 'INV-1',
            amountPaise: 200000,
            lateFeePaise: 0,
            status: 'PENDING',
            dueDate: new Date('2026-06-14T00:00:00.000Z'),
          },
        ],
      },
    ]);

    const result = await service.lookupLeasesByPhone(PHONE_RAW);

    expect(prisma.leaseAgreement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lessorPhone: { in: ['919876543210', '9876543210'] } },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(AGREEMENT_ID);
    expect(result[0]?.asset.name.en).toBe('Stall 12');
    expect(result[0]?.invoices[0]?.invoiceNo).toBe('INV-1');
  });

  it('returns an empty array when no agreements match the phone', async () => {
    prisma.leaseAgreement.findMany.mockResolvedValue([]);
    const result = await service.lookupLeasesByPhone('9876543210');
    expect(result).toEqual([]);
  });
});

describe('LeaseInvoicesService.citizenPayOnline', () => {
  let service: LeaseInvoicesService;
  let prisma: {
    leaseInvoice: { findFirst: jest.Mock; update: jest.Mock };
    tenant: { findUnique: jest.Mock };
    payment: { create: jest.Mock };
  };

  const INVOICE_ID = 'invoice-1';
  const TENANT_ID = 'tenant-1';
  const AGREEMENT_ID = 'agreement-1';
  const PRINCIPAL_SUBJECT = 'dev-citizen-9836177767';
  const principal = { subject: PRINCIPAL_SUBJECT };

  beforeEach(() => {
    prisma = {
      leaseInvoice: { findFirst: jest.fn(), update: jest.fn() },
      tenant: { findUnique: jest.fn() },
      payment: { create: jest.fn() },
    } as unknown as typeof prisma;
    service = new LeaseInvoicesService(prisma as unknown as PrismaService);
  });

  it('rejects phones that do not own the invoice (NotFoundException, no info leak)', async () => {
    prisma.leaseInvoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      tenantId: TENANT_ID,
      agreementId: AGREEMENT_ID,
      amountPaise: 100000,
      lateFeePaise: 0,
      status: 'PENDING',
      invoiceNo: 'INV-A',
      agreement: { lessorPhone: '9876543210' },
      tenant: { id: TENANT_ID, code: 'kmc' },
    });

    await expect(
      service.citizenPayOnline(principal, INVOICE_ID, '1111111111'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('creates a requires_action payment for ONLINE_GATEWAY when the phone matches', async () => {
    prisma.leaseInvoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      tenantId: TENANT_ID,
      agreementId: AGREEMENT_ID,
      amountPaise: 100000,
      lateFeePaise: 0,
      status: 'PENDING',
      invoiceNo: 'INV-B',
      agreement: { lessorPhone: '+91 98361 77767' },
      tenant: { id: TENANT_ID, code: 'kmc' },
    });
    prisma.payment.create.mockResolvedValue({
      id: 'payment-c',
      gatewayOrderId: 'stub_order_lease_c',
    });

    const result = await service.citizenPayOnline(principal, INVOICE_ID, '9836177767');

    expect(result.redirectUrl).toContain('/payments/stub/complete');
    expect(result.paymentId).toBe('payment-c');
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaseInvoiceId: INVOICE_ID,
          tenantId: TENANT_ID,
          citizenSubject: PRINCIPAL_SUBJECT,
          amountPaise: 100000,
          status: 'requires_action',
        }),
      }),
    );
  });

  it('rejects too-short phones without hitting the database', async () => {
    await expect(service.citizenPayOnline(principal, INVOICE_ID, '12345')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.leaseInvoice.findFirst).not.toHaveBeenCalled();
  });
});
