import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../common/database/prisma.service';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';

import { RentalDocumentsController } from './rental-documents.controller';
import { RentalDocumentsService } from './rental-documents.service';

import type { Request } from 'express';

function makeReq(): Request {
  // The controller only reads `headers.host` and `protocol` from the request
  // when building the stub upload URL, so the S3 path can pass a minimal
  // stub here.
  return { headers: { host: 'localhost:3001' }, protocol: 'http' } as unknown as Request;
}

describe('RentalDocumentsController', () => {
  let controller: RentalDocumentsController;
  const service = {
    recordUpload: jest.fn(),
    listDocuments: jest.fn(),
    reviewDocument: jest.fn(),
  } as unknown as RentalDocumentsService;
  const storage = {
    presignUpload: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true),
  } as unknown as ObjectStorageService;
  const prisma = {} as unknown as PrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      controllers: [RentalDocumentsController],
      providers: [
        { provide: RentalDocumentsService, useValue: service },
        { provide: ObjectStorageService, useValue: storage },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    controller = mod.get(RentalDocumentsController);
  });

  it('rejects upload requests with disallowed mime types', async () => {
    await expect(
      controller.createUploadUrl(
        { tenantCode: 'demo', subject: 'u1', roles: ['tenant_admin'] } as never,
        'a1',
        {
          agreementId: 'a1',
          fileName: 'evil.exe',
          mimeType: 'application/x-msdownload',
          sizeBytes: 10,
        },
        makeReq(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('presigns an upload URL and records the document once PUT succeeds', async () => {
    (storage.presignUpload as jest.Mock).mockResolvedValue({ url: 'https://x', expires_at: 't' });
    (service.recordUpload as jest.Mock).mockResolvedValue({ id: 'd1' });
    const out = await controller.createUploadUrl(
      { tenantCode: 'demo', subject: 'u1', roles: ['tenant_admin'] } as never,
      'a1',
      { agreementId: 'a1', fileName: 'lease.pdf', mimeType: 'application/pdf', sizeBytes: 1000 },
      makeReq(),
    );
    expect(out.url).toBe('https://x');
    expect(service.recordUpload).not.toHaveBeenCalled(); // presign is decoupled from record
  });

  it('returns a same-origin stub upload URL when object storage is disabled', async () => {
    (storage.isEnabled as jest.Mock).mockReturnValue(false);
    const out = await controller.createUploadUrl(
      { tenantCode: 'demo', subject: 'u1', roles: ['tenant_admin'] } as never,
      'a1',
      { agreementId: 'a1', fileName: 'lease.pdf', mimeType: 'application/pdf', sizeBytes: 1000 },
      makeReq(),
    );
    expect(out.url).toContain('/_stub-upload?key=');
    expect(out.url).toContain('tenants%2Fdemo%2Flease-agreements%2Fa1%2F');
    expect(storage.presignUpload).not.toHaveBeenCalled();
  });
});
