import { PrismaService } from '../../common/database/prisma.service';

import { LeaseSchedulerService } from './lease-scheduler.service';

describe('LeaseSchedulerService', () => {
  let service: LeaseSchedulerService;
  let prisma: {
    leaseAgreement: { findMany: jest.Mock };
    leaseInvoice: {
      findMany: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
    };
    tenant: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      leaseAgreement: { findMany: jest.fn() },
      leaseInvoice: {
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      tenant: { findUnique: jest.fn() },
    } as unknown as typeof prisma;
    prisma.leaseAgreement.findMany.mockResolvedValue([]);
    prisma.leaseInvoice.findMany.mockResolvedValue([]);
    prisma.leaseInvoice.findFirst.mockResolvedValue(null);
    prisma.leaseInvoice.create.mockResolvedValue({});
    prisma.tenant.findUnique.mockResolvedValue({ id: 't1', config: {} });
    service = new LeaseSchedulerService(prisma as unknown as PrismaService);
  });

  it('flips PENDING invoices past dueDate to OVERDUE', async () => {
    prisma.leaseInvoice.findMany.mockResolvedValue([
      { id: 'inv-1', invoiceNo: 'INV-1', tenantId: 't1' },
    ]);
    prisma.leaseInvoice.update.mockResolvedValue({});

    await service.runOnce('cron');

    expect(prisma.leaseInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1' }, data: { status: 'OVERDUE' } }),
    );
  });

  it('applies tenant flat late fee when flipping to OVERDUE if config enabled', async () => {
    prisma.leaseInvoice.findMany.mockResolvedValue([
      { id: 'inv-2', invoiceNo: 'INV-2', tenantId: 't1' },
    ]);
    prisma.tenant.findUnique.mockResolvedValue({
      id: 't1',
      config: { rentalLateFee: { enabled: true, flatAmountPaise: 50000 } },
    });
    prisma.leaseInvoice.update.mockResolvedValue({});

    await service.runOnce('cron');

    expect(prisma.leaseInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-2' }, data: { status: 'OVERDUE' } }),
    );
    expect(prisma.leaseInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-2' }, data: { lateFeePaise: 50000 } }),
    );
  });

  it('reads the rate from the linked asset, not the agreement (regression: ₹0 invoices)', async () => {
    const now = new Date();
    const startDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    prisma.leaseAgreement.findMany
      // First call: expiring-soon scan
      .mockResolvedValueOnce([])
      // Second call: invoice-generation scan
      .mockResolvedValueOnce([
        {
          id: 'agreement-1',
          tenantId: 't1',
          startDate,
          // The agreement does NOT carry `baseLeaseRatePaise` or `ratePeriod`;
          // they live on the asset. Earlier code used `(agreement as any).baseLeaseRatePaise`
          // and silently stored 0, which is what this test guards against.
          asset: {
            id: 'asset-1',
            baseLeaseRatePaise: 250000, // ₹2,500
            ratePeriod: 'MONTHLY',
          },
          invoices: [], // No prior invoice → next period starts at agreement.startDate
        },
      ]);

    const summary = await service.runOnce('manual');

    expect(summary.invoicesCreated).toBe(1);
    expect(prisma.leaseInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountPaise: 250000, // ← NOT 0
          status: 'PENDING',
        }),
      }),
    );
  });
});
