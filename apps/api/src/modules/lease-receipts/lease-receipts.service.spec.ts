import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../common/database/prisma.service';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';

import { renderLeaseReceiptPdf } from './lease-receipts.pdf';
import { LeaseReceiptsService } from './lease-receipts.service';

jest.mock('./lease-receipts.pdf', () => ({
  renderLeaseReceiptPdf: jest.fn(async () => Buffer.from('%PDF-1.4 fake')),
}));

describe('LeaseReceiptsService', () => {
  let service: LeaseReceiptsService;
  const prisma = {
    receipt: { findFirst: jest.fn(), update: jest.fn() },
    payment: { findFirst: jest.fn() },
    leaseInvoice: { findFirst: jest.fn() },
    tenant: { findUnique: jest.fn() },
  } as unknown as PrismaService;
  const storage = {
    getObjectBuffer: jest.fn(),
  } as unknown as ObjectStorageService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (renderLeaseReceiptPdf as jest.Mock).mockResolvedValue(Buffer.from('%PDF-1.4 fake'));
    const mod = await Test.createTestingModule({
      providers: [
        LeaseReceiptsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ObjectStorageService, useValue: storage },
      ],
    }).compile();
    service = mod.get(LeaseReceiptsService);
  });

  it('generates + stores a PDF when called on settlement and writes the storage key', async () => {
    (prisma.receipt.findFirst as jest.Mock).mockResolvedValue({
      id: 'r1',
      tenantId: 't1',
      receiptNumber: 'RCT-1',
      verificationToken: 'tok',
      leaseInvoiceId: 'li1',
      amountPaise: 1000,
      currency: 'INR',
    });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue({
      id: 'p1',
      settledAt: new Date(),
      gateway: 'stub',
      method: 'CASH',
    });
    (prisma.leaseInvoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'li1',
      invoiceNo: 'INV-1',
      agreement: { lessorName: 'Asha', lessorPhone: null },
    });
    (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
      id: 't1',
      code: 'demo',
      name: 'Demo ULB',
    });
    (storage.getObjectBuffer as jest.Mock).mockResolvedValue(null);
    (prisma.receipt.update as jest.Mock).mockImplementation(
      ({ data }: { data: { storageKey: string } }) =>
        Promise.resolve({ id: 'r1', storageKey: data.storageKey }),
    );

    // provide a private "putObject" via the storage service to assert it's called
    (storage as unknown as { putObject: jest.Mock }).putObject = jest
      .fn()
      .mockResolvedValue(undefined);

    const out = await service.generateForReceipt('t1', 'r1', 'https://enagar.example.gov');
    expect(out.storageKey).toMatch(/^tenants\/demo\/lease-receipts\/RCT-1\.pdf$/);
    expect(prisma.receipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({
          storageKey: expect.stringMatching(/lease-receipts\/RCT-1\.pdf$/),
        }),
      }),
    );
  });

  it('downloads a previously stored PDF or regenerates if missing', async () => {
    (prisma.receipt.findFirst as jest.Mock).mockResolvedValue({
      id: 'r1',
      tenantId: 't1',
      storageKey: 'tenants/demo/lease-receipts/RCT-1.pdf',
      receiptNumber: 'RCT-1',
    });
    (storage.getObjectBuffer as jest.Mock).mockResolvedValue(Buffer.from('stored-pdf'));
    const buf = await service.getStoredPdf('t1', 'r1');
    expect(buf.toString()).toBe('stored-pdf');
  });

  it('throws NotFound for cross-tenant reads', async () => {
    (prisma.receipt.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.getStoredPdf('other', 'r1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
