import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { EvChargingService } from './ev-charging.service';

describe('EvChargingService', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const citizenId = 'citizen-row-1';
  const chargerId = 'charger-1';
  const sessionId = 'session-1';

  const principal = {
    tenantId: 'WBPORTAL',
    tenantCode: 'WBPORTAL',
    roles: ['citizen'],
    subject: 'citizen-user',
  };

  const adminPrincipal = {
    tenantId,
    tenantCode: 'KMC',
    roles: ['tenant_admin'],
    subject: 'admin-user',
  };

  const chargerRow = {
    id: chargerId,
    tenantId,
    code: 'CHG-MKT-01',
    name: { en: 'Charger 1' },
    location: {},
    connectorType: 'TYPE2',
    maxKw: { toString: () => '22.00' },
    ratePaisePerKwh: 1500,
    isActive: true,
    updatedAt: new Date('2026-06-18T10:00:00.000Z'),
  };

  const prismaMock = {
    tenant: { findUnique: jest.fn() },
    evCharger: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    evSession: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    citizen: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const gatewayMock = { initiate: jest.fn() };
  const paymentStoreMock = {
    findIdempotencyRecord: jest.fn(),
    findActivePaymentByEvSession: jest.fn(),
    findByIdForPrincipal: jest.fn(),
    createPendingPayment: jest.fn(),
  };

  let service: EvChargingService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.tenant.findUnique.mockResolvedValue({
      config: { smart_city: { ev_charging: { enabled: true } } },
    });
    prismaMock.citizen.findFirst.mockResolvedValue({
      id: citizenId,
      mobile: '9876543210',
    });
    service = new EvChargingService(
      prismaMock as never,
      gatewayMock as never,
      paymentStoreMock as never,
    );
  });

  it('rejects non-staff admin callers', async () => {
    await expect(
      service.listForAdmin({ ...adminPrincipal, roles: ['citizen'] } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists available chargers for a citizen', async () => {
    prismaMock.evSession.findMany.mockResolvedValueOnce([]);
    prismaMock.evSession.findMany.mockResolvedValueOnce([]);
    prismaMock.evCharger.findMany.mockResolvedValue([chargerRow]);

    const result = await service.listChargersForCitizen(principal as never, {
      tenant_code: 'KMC',
    });

    expect(result.chargers).toHaveLength(1);
    expect(result.chargers[0]?.available).toBe(true);
    expect(result.chargers[0]?.rate_paise_per_kwh).toBe(1500);
  });

  it('rejects hold when charger is busy', async () => {
    prismaMock.evSession.findMany.mockResolvedValueOnce([]);
    prismaMock.evCharger.findUnique.mockResolvedValue(chargerRow);
    prismaMock.evSession.findFirst.mockResolvedValueOnce({ id: 'busy-session' });

    await expect(
      service.createHoldForCitizen(principal as never, 'CHG-MKT-01', {
        tenant_code: 'KMC',
        vehicle_number: 'WB06A1234',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a hold for an available charger', async () => {
    prismaMock.evSession.findMany.mockResolvedValueOnce([]);
    prismaMock.evCharger.findUnique.mockResolvedValue(chargerRow);
    prismaMock.evSession.findFirst.mockResolvedValueOnce(null);
    prismaMock.evSession.create.mockResolvedValue({
      id: sessionId,
      status: 'HELD',
      vehicleNumber: 'WB06A1234',
      holdExpiresAt: new Date('2026-06-18T10:15:00.000Z'),
      startedAt: null,
      endedAt: null,
      kwhConsumed: null,
      amountPaise: null,
      charger: { code: 'CHG-MKT-01' },
    });

    const result = await service.createHoldForCitizen(principal as never, 'CHG-MKT-01', {
      tenant_code: 'KMC',
      vehicle_number: 'WB06A1234',
    });

    expect(result.session_id).toBe(sessionId);
    expect(result.status).toBe('HELD');
    expect(result.charger_code).toBe('CHG-MKT-01');
    expect(result.vehicle_number).toBe('WB06A1234');
  });

  it('stops an active session with default stub kWh amount', async () => {
    prismaMock.evSession.findUnique.mockResolvedValue({
      id: sessionId,
      tenantId,
      status: 'CHARGING',
      startedAt: new Date('2026-06-18T10:00:00.000Z'),
      endedAt: null,
      amountPaise: null,
      holdExpiresAt: null,
      kwhConsumed: null,
      charger: { code: 'CHG-MKT-01', ratePaisePerKwh: 1500 },
      citizen: { keycloakSubject: principal.subject },
    });
    prismaMock.evSession.update.mockResolvedValue({
      id: sessionId,
      status: 'CHARGING',
      holdExpiresAt: null,
      startedAt: new Date('2026-06-18T10:00:00.000Z'),
      endedAt: new Date('2026-06-18T10:30:00.000Z'),
      kwhConsumed: { toString: () => '5.500' },
      amountPaise: 8250,
      charger: { code: 'CHG-MKT-01', ratePaisePerKwh: 1500 },
    });

    const result = await service.stopSessionForCitizen(principal as never, sessionId, {
      tenant_code: 'KMC',
    });

    expect(result.status).toBe('awaiting_payment');
    expect(result.kwh_consumed).toBe(5.5);
    expect(result.amount_paise).toBe(8250);
  });

  it('rejects stop when session has not started charging', async () => {
    prismaMock.evSession.findUnique.mockResolvedValue({
      id: sessionId,
      tenantId,
      status: 'HELD',
      startedAt: null,
      endedAt: null,
      amountPaise: null,
      holdExpiresAt: new Date('2026-06-18T10:15:00.000Z'),
      kwhConsumed: null,
      charger: { code: 'CHG-MKT-01', ratePaisePerKwh: 1500 },
      citizen: { keycloakSubject: principal.subject },
    });

    await expect(
      service.stopSessionForCitizen(principal as never, sessionId, {
        tenant_code: 'KMC',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects payment confirmation when payment is not settled', async () => {
    prismaMock.evSession.findUnique.mockResolvedValue({
      id: sessionId,
      tenantId,
      status: 'CHARGING',
      startedAt: new Date('2026-06-18T10:00:00.000Z'),
      endedAt: new Date('2026-06-18T10:30:00.000Z'),
      amountPaise: 8250,
      holdExpiresAt: null,
      kwhConsumed: { toString: () => '5.500' },
      charger: { code: 'CHG-MKT-01', ratePaisePerKwh: 1500 },
      citizen: { keycloakSubject: principal.subject },
    });
    paymentStoreMock.findActivePaymentByEvSession.mockResolvedValue({
      id: 'pay-1',
      status: 'requires_action',
      amount_paise: 8250,
    });

    await expect(
      service.confirmPaymentForCitizen(principal as never, sessionId, {
        tenant_code: 'KMC',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 for unknown charger hold', async () => {
    prismaMock.evSession.findMany.mockResolvedValueOnce([]);
    prismaMock.evCharger.findUnique.mockResolvedValue(null);

    await expect(
      service.createHoldForCitizen(principal as never, 'CHG-MISSING', {
        tenant_code: 'KMC',
        vehicle_number: 'WB06A1234',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires English charger name on admin upsert', async () => {
    await expect(
      service.upsertCharger(adminPrincipal as never, {
        code: 'CHG-TEST',
        name: { bn: 'only bn' },
        connector_type: 'TYPE2',
        max_kw: 22,
        rate_paise_per_kwh: 1500,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
