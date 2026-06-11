import { Test } from '@nestjs/testing';

import { PrismaService } from '../../../common/database/prisma.service';

import { PublicLeaseReceiptsService } from './public-lease-receipts.service';

describe('PublicLeaseReceiptsService', () => {
  let service: PublicLeaseReceiptsService;
  const prisma = {
    receipt: { findUnique: jest.fn() },
    payment: { findUnique: jest.fn() },
    leaseInvoice: { findUnique: jest.fn() },
  } as unknown as PrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [PublicLeaseReceiptsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(PublicLeaseReceiptsService);
  });

  it('returns the receipt number, amount, lessor name, and settlement timestamp', async () => {
    (prisma.receipt.findUnique as jest.Mock).mockResolvedValue({
      receiptNumber: 'RCT-1',
      amountPaise: 1000,
      currency: 'INR',
      verificationToken: 'goodtoken',
      issuedAt: new Date('2026-06-10T10:00:00Z'),
      paymentId: 'p1',
      leaseInvoiceId: 'li1',
    });
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      settledAt: new Date('2026-06-10T10:00:00Z'),
    });
    (prisma.leaseInvoice.findUnique as jest.Mock).mockResolvedValue({
      agreement: { lessorName: 'Asha' },
    });
    const out = await service.verify('goodtoken');
    expect(out).not.toBeNull();
    expect(out!.receiptNumber).toBe('RCT-1');
    expect(out!.lessorName).toBe('Asha');
    expect(out!.amountPaise).toBe(1000);
  });

  it('returns null for an unknown token', async () => {
    (prisma.receipt.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.verify('nope')).resolves.toBeNull();
  });
});
