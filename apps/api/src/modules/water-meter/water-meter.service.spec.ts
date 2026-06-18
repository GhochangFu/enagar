import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { WaterMeterService } from './water-meter.service';

describe('WaterMeterService', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const accountId = 'account-1';
  const rechargeId = 'recharge-1';
  const citizenId = 'citizen-row-1';
  const principal = {
    tenantId: '99999999-9999-4999-8999-999999999999',
    tenantCode: 'WBPORTAL',
    roles: ['citizen'],
    subject: 'citizen-user',
  };

  const accountRow = {
    id: accountId,
    tenantId,
    citizenId: null,
    meterId: 'WM-001',
    consumerName: 'Ananya Sen',
    consumerPhone: '9876543210',
    balancePaise: 12500,
    lastReadingLitres: 182450,
    lastReadingAt: new Date('2026-06-18T06:30:00.000Z'),
    isActive: true,
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
  };

  const prismaMock = {
    tenant: { findUnique: jest.fn() },
    citizen: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    waterMeterAccount: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    waterMeterRecharge: {
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const gatewayMock = { initiate: jest.fn() };
  const paymentStoreMock = {
    findIdempotencyRecord: jest.fn(),
    findByIdForPrincipal: jest.fn(),
    findActivePaymentByWaterMeterRecharge: jest.fn(),
    createPendingPayment: jest.fn(),
  };

  let service: WaterMeterService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.tenant.findUnique.mockResolvedValue({
      config: { smart_city: { iot_water: { enabled: true } } },
    });
    prismaMock.citizen.findFirst.mockResolvedValue({ id: citizenId });
    prismaMock.citizen.findUnique.mockResolvedValue({
      id: citizenId,
      mobile: '9876543210',
    });
    prismaMock.waterMeterAccount.findUnique.mockResolvedValue(accountRow);
    prismaMock.waterMeterAccount.update.mockResolvedValue({ ...accountRow, citizenId });
    service = new WaterMeterService(
      prismaMock as never,
      gatewayMock as never,
      paymentStoreMock as never,
    );
  });

  it('looks up an authorized meter and attaches the citizen row', async () => {
    const result = await service.lookupForCitizen(principal as never, 'wm-001', {
      tenant_code: 'KMC',
    });

    expect(result.meter_id).toBe('WM-001');
    expect(result.balance_paise).toBe(12500);
    expect(prismaMock.waterMeterAccount.update).toHaveBeenCalledWith({
      where: { id: accountId },
      data: { citizenId },
    });
  });

  it('rejects lookup when registered phone does not match the meter', async () => {
    prismaMock.citizen.findUnique.mockResolvedValueOnce({
      id: citizenId,
      mobile: '9123456789',
    });

    await expect(
      service.lookupForCitizen(principal as never, 'WM-001', { tenant_code: 'KMC' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('initiates a recharge payment with idempotency metadata', async () => {
    prismaMock.waterMeterRecharge.create.mockResolvedValue({
      id: rechargeId,
      amountPaise: 50000,
      status: 'PENDING',
      balanceAfterPaise: null,
    });
    paymentStoreMock.findIdempotencyRecord.mockResolvedValue(null);
    paymentStoreMock.findActivePaymentByWaterMeterRecharge.mockResolvedValue(null);
    gatewayMock.initiate.mockResolvedValue({
      gateway: 'stub',
      gatewayOrderId: 'stub_order_pay-1',
      redirectUrl: '/payments/stub/complete?payment_id=pay-1',
    });
    paymentStoreMock.createPendingPayment.mockResolvedValue({
      id: 'pay-1',
      amount_paise: 50000,
      status: 'requires_action',
      gateway_order_id: 'stub_order_pay-1',
      water_meter_recharge_id: rechargeId,
    });

    const result = await service.initiateRechargeForCitizen(
      principal as never,
      'WM-001',
      { tenant_code: 'KMC', amount_paise: 50000, method: 'upi' },
      'water-recharge-test',
    );

    expect(result.recharge_id).toBe(rechargeId);
    expect(result.payment?.water_meter_recharge_id).toBe(rechargeId);
    expect(paymentStoreMock.createPendingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        waterMeterRechargeId: rechargeId,
        feeCode: 'water_recharge',
        amountPaise: 50000,
      }),
    );
  });

  it('rejects recharge below minimum amount', async () => {
    await expect(
      service.initiateRechargeForCitizen(
        principal as never,
        'WM-001',
        { tenant_code: 'KMC', amount_paise: 0, method: 'upi' },
        'bad-amount',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
