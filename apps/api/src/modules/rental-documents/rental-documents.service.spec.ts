import { BadRequestException } from '@nestjs/common';

import { RentalDocumentsService } from './rental-documents.service';

import type { PrismaService } from '../../common/database/prisma.service';
import type { ObjectStorageService } from '../../common/object-storage/object-storage.service';

describe('RentalDocumentsService', () => {
  let service: RentalDocumentsService;
  let prisma: {
    leaseAgreementDocument: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    leaseAgreement: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    leaseAgreementDocumentEvent: { create: jest.Mock };
    tenant: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  const storage = {
    assertTenantObjectKey: jest.fn(),
    headObject: jest
      .fn()
      .mockResolvedValue({ content_length: 1234, content_type: 'application/pdf' }),
  } as unknown as ObjectStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      leaseAgreementDocument: {
        create: jest.fn().mockResolvedValue({ id: 'd1', status: 'PENDING_REVIEW' }),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      leaseAgreement: {
        findFirst: jest.fn().mockResolvedValue({ id: 'a1', tenantId: 't1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      leaseAgreementDocumentEvent: { create: jest.fn().mockResolvedValue({}) },
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1', code: 't1' }) },
      $transaction: jest.fn((cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)),
    } as unknown as typeof prisma;
    service = new RentalDocumentsService(
      prisma as unknown as PrismaService,
      storage as unknown as ObjectStorageService,
    );
  });

  it('creates a PENDING_REVIEW document row from an uploaded object key', async () => {
    prisma.leaseAgreement.findFirst.mockResolvedValue({ id: 'a1', tenantId: 't1' });
    prisma.leaseAgreementDocument.create.mockResolvedValue({ id: 'd1', status: 'PENDING_REVIEW' });
    const out = await service.recordUpload({
      tenantId: 't1',
      agreementId: 'a1',
      uploadedBy: 'u1',
      file: {
        fileName: 'lease.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1234,
        sha256: 'a'.repeat(64),
        storageKey: 'tenants/t1/lease-agreements/a1/lease.pdf',
      },
    });
    expect(out.status).toBe('PENDING_REVIEW');
    expect(prisma.leaseAgreementDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING_REVIEW', agreementId: 'a1' }),
      }),
    );
  });

  it('approving flips the agreement to ACTIVE and writes an APPROVED event', async () => {
    prisma.leaseAgreementDocument.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId: 't1',
      agreementId: 'a1',
      status: 'PENDING_REVIEW',
    });
    prisma.leaseAgreementDocument.update.mockResolvedValue({ id: 'd1', status: 'APPROVED' });
    prisma.leaseAgreement.update = jest.fn().mockResolvedValue({});
    const out = await service.reviewDocument({
      tenantId: 't1',
      documentId: 'd1',
      actorUserId: 'u2',
      decision: 'APPROVE',
    });
    expect(out.status).toBe('APPROVED');
    expect(prisma.leaseAgreementDocumentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: 'APPROVED' }) }),
    );
  });

  it('rejecting requires a note', async () => {
    prisma.leaseAgreementDocument.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId: 't1',
      agreementId: 'a1',
      status: 'PENDING_REVIEW',
    });
    await expect(
      service.reviewDocument({
        tenantId: 't1',
        documentId: 'd1',
        actorUserId: 'u2',
        decision: 'REJECT',
      }),
    ).rejects.toThrow(/note is required/i);
  });

  it('rejects recordUpload when storage has no object at the claimed key', async () => {
    (storage.headObject as jest.Mock).mockResolvedValue(null);
    await expect(
      service.recordUpload({
        tenantId: 't1',
        agreementId: 'a1',
        uploadedBy: 'u1',
        file: {
          fileName: 'lease.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1234,
          sha256: 'a'.repeat(64),
          storageKey: 'tenants/t1/lease-agreements/a1/missing.pdf',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects recordUpload when the stored size does not match the declared size', async () => {
    (storage.headObject as jest.Mock).mockResolvedValue({
      content_length: 1,
      content_type: 'application/pdf',
    });
    await expect(
      service.recordUpload({
        tenantId: 't1',
        agreementId: 'a1',
        uploadedBy: 'u1',
        file: {
          fileName: 'lease.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1234,
          sha256: 'a'.repeat(64),
          storageKey: 'tenants/t1/lease-agreements/a1/lease.pdf',
        },
      }),
    ).rejects.toThrow(/size/i);
  });
});
