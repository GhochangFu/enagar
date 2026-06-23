import { BadRequestException } from '@nestjs/common';

import { TenantConfigTools } from './tenant-config.tools';

describe('TenantConfigTools', () => {
  const principal = {
    subject: 'staff-1',
    tenantId: 'tenant-1',
    roles: ['tenant_admin'],
    expiresAt: new Date(),
  };

  const baseCtx = {
    principal,
    session: {
      id: 'sess-1',
      scope: 'payment' as const,
      current_step: 4 as const,
      archetype: null,
      step_completion: {},
      status: 'active' as const,
    },
    tenantId: 'tenant-1',
    serviceId: 'svc-1',
    step: 4 as const,
    scope: 'payment' as const,
  };

  it('rejects unknown revenue_head_code in applyServiceConfig', async () => {
    const adminTenant = {
      listRevenueHeads: jest.fn().mockResolvedValue([{ code: 'cert-fee', is_active: true }]),
      patchServiceConfig: jest.fn(),
    };
    const tools = new TenantConfigTools(adminTenant as never);
    const apply = tools.definitions().find((tool) => tool.name === 'applyServiceConfig')!;

    await expect(
      apply.execute(baseCtx, {
        fee_rule: { type: 'fixed', amount_paise: 5000, currency: 'INR' },
        revenue_head_code: 'unknown-head',
        required_documents: [
          {
            code: 'aadhaar',
            label: { en: 'Aadhaar' },
            required: true,
            accept: ['application/pdf'],
            max_size_mb: 5,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(adminTenant.patchServiceConfig).not.toHaveBeenCalled();
  });

  it('applyServiceConfig validates fee rule and persists config', async () => {
    const adminTenant = {
      listRevenueHeads: jest.fn().mockResolvedValue([{ code: 'cert-fee', is_active: true }]),
      patchServiceConfig: jest.fn().mockResolvedValue({
        fee_preview_paise: 2500,
        revenue_head: { code: 'cert-fee' },
        required_documents: [{ code: 'aadhaar' }],
      }),
    };
    const tools = new TenantConfigTools(adminTenant as never);
    const apply = tools.definitions().find((tool) => tool.name === 'applyServiceConfig')!;

    const result = await apply.execute(baseCtx, {
      fee_rule: { type: 'fixed', amount_paise: 2500, currency: 'INR' },
      revenue_head_code: 'cert-fee',
      required_documents: [
        {
          code: 'aadhaar',
          label: { en: 'Aadhaar' },
          required: true,
          accept: ['application/pdf'],
          max_size_mb: 5,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.draftUpdated).toBe('config');
    expect(adminTenant.patchServiceConfig).toHaveBeenCalledWith(
      principal,
      'svc-1',
      expect.objectContaining({
        fee_rule: { type: 'fixed', amount_paise: 2500, currency: 'INR' },
        revenue_head_code: 'cert-fee',
      }),
    );
  });

  it('applyServiceConfig includes fee_lines when fee_rule and payment_schedule are both provided', async () => {
    const adminTenant = {
      listRevenueHeads: jest.fn().mockResolvedValue([{ code: 'cert-fee', is_active: true }]),
      patchServiceConfig: jest.fn().mockResolvedValue({
        fee_preview_paise: 100,
        revenue_head: { code: 'cert-fee' },
        required_documents: [{ code: 'aadhaar' }],
      }),
    };
    const tools = new TenantConfigTools(adminTenant as never);
    const apply = tools.definitions().find((tool) => tool.name === 'applyServiceConfig')!;

    await apply.execute(baseCtx, {
      fee_rule: { type: 'fixed', amount_paise: 100, currency: 'INR' },
      payment_schedule: 'upfront_only',
      revenue_head_code: 'cert-fee',
      required_documents: [
        {
          code: 'aadhaar',
          label: { en: 'Aadhaar' },
          required: true,
          accept: ['application/pdf'],
          max_size_mb: 5,
        },
      ],
    });

    expect(adminTenant.patchServiceConfig).toHaveBeenCalledWith(
      principal,
      'svc-1',
      expect.objectContaining({
        payment_schedule: 'upfront_only',
        fee_lines: expect.objectContaining({
          application: expect.objectContaining({
            rule: { type: 'fixed', amount_paise: 100, currency: 'INR' },
          }),
        }),
      }),
    );
  });

  it('listRevenueHeads returns read-only data without draftUpdated', async () => {
    const adminTenant = {
      listRevenueHeads: jest
        .fn()
        .mockResolvedValue([
          { code: 'cert-fee', name: { en: 'Cert Fees' }, accounting_code: 'RH-1', is_active: true },
        ]),
    };
    const tools = new TenantConfigTools(adminTenant as never);
    const list = tools.definitions().find((tool) => tool.name === 'listRevenueHeads')!;

    const result = await list.execute(baseCtx, {});

    expect(result.success).toBe(true);
    expect(result.draftUpdated).toBeUndefined();
    expect(result.data).toEqual([
      expect.objectContaining({ code: 'cert-fee', accounting_code: 'RH-1' }),
    ]);
  });
});
