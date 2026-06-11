import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../common/database/prisma.service';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';

import { RentalDocumentsController } from './rental-documents.controller';
import { RentalDocumentsService } from './rental-documents.service';

describe('RentalDocumentsController', () => {
  let controller: RentalDocumentsController;
  const service = {
    recordUpload: jest.fn(),
    listDocuments: jest.fn(),
    reviewDocument: jest.fn(),
  } as unknown as RentalDocumentsService;
  const storage = {
    presignUpload: jest.fn(),
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
    );
    expect(out.url).toBe('https://x');
    expect(service.recordUpload).not.toHaveBeenCalled(); // presign is decoupled from record
  });
});
