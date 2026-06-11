import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { LeaseReceiptsController } from './lease-receipts.controller';
import { LeaseReceiptsService } from './lease-receipts.service';

interface MockResponse {
  headers: Record<string, string>;
  setHeader: jest.Mock;
  end: jest.Mock;
}

function createMockRes(): MockResponse {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: jest.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    end: jest.fn(),
  };
}

describe('LeaseReceiptsController', () => {
  let controller: LeaseReceiptsController;
  const service = {
    getStoredPdf: jest.fn(),
  } as unknown as LeaseReceiptsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      controllers: [LeaseReceiptsController],
      providers: [{ provide: LeaseReceiptsService, useValue: service }],
    }).compile();
    controller = mod.get(LeaseReceiptsController);
  });

  it('returns the PDF as application/pdf with a receipt-id filename', async () => {
    (service.getStoredPdf as jest.Mock).mockResolvedValue(Buffer.from('%PDF-1.4 fake'));
    const res = (await controller.download(
      'r1',
      { tenantId: 't1', roles: ['tenant_admin'] } as never,
      createMockRes() as unknown as import('express').Response,
    )) as unknown as MockResponse;
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.headers['Content-Disposition']).toMatch(/inline; filename="receipt-r1\.pdf"/);
  });

  it('maps a missing receipt to a 404', async () => {
    (service.getStoredPdf as jest.Mock).mockRejectedValue(new NotFoundException());
    await expect(
      controller.download(
        'r1',
        { tenantId: 't1', roles: ['tenant_admin'] } as never,
        createMockRes() as unknown as import('express').Response,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
