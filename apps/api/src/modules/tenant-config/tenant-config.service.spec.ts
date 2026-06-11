import { BadRequestException } from '@nestjs/common';

import { TenantConfigService } from './tenant-config.service';

import type { PrismaService } from '../../common/database/prisma.service';

describe('TenantConfigService', () => {
  let service: TenantConfigService;
  let prisma: {
    tenant: { findUnique: jest.Mock; update: jest.Mock };
    stateAuditLog: { create: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      tenant: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      stateAuditLog: { create: jest.fn() },
    };
    service = new TenantConfigService(prisma as unknown as PrismaService);
  });

  it('rejects negative lateFeePaise with 400', async () => {
    await expect(service.updateLateFee('t1', 'u1', -100)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('writes the new value and appends a state audit log row', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: 't1', lateFeePaise: 100 });
    prisma.tenant.update.mockResolvedValue({ id: 't1', lateFeePaise: 250 });
    const out = await service.updateLateFee('t1', 'u1', 250);
    expect(out.lateFeePaise).toBe(250);
    expect(prisma.stateAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'TENANT_LATE_FEE_UPDATED',
          metadata: expect.objectContaining({ oldValue: 100, newValue: 250 }),
        }),
      }),
    );
  });

  it('returns 0 (no late fee) when the column is null', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: 't1', lateFeePaise: null });
    const out = await service.getConfig('t1');
    expect(out.lateFeePaise).toBe(0);
  });
});
