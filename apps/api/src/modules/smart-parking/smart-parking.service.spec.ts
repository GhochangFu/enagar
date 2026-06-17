import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { SmartParkingService } from './smart-parking.service';

describe('SmartParkingService', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const principal = {
    tenantId,
    tenantCode: 'KMC',
    roles: ['tenant_admin'],
    sub: 'admin-user',
  };
  const citizenPrincipal = {
    tenantId: 'WBPORTAL',
    tenantCode: 'WBPORTAL',
    roles: ['citizen'],
    sub: 'citizen-user',
  };

  const prismaMock = {
    smartZone: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    parkingBay: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ward: {
      findUnique: jest.fn(),
    },
  };

  const servicesMock = {
    getTenantService: jest.fn(),
    resolveLedgerCodesForService: jest.fn(),
  };
  const gatewayMock = {
    initiate: jest.fn(),
    id: 'stub',
  };
  const paymentStoreMock = {
    findIdempotencyRecord: jest.fn(),
    findActivePaymentByBookingReservation: jest.fn(),
    findByIdForPrincipal: jest.fn(),
    createPendingPayment: jest.fn(),
  };

  let service: SmartParkingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SmartParkingService(
      prismaMock as never,
      servicesMock as never,
      gatewayMock as never,
      paymentStoreMock as never,
    );
  });

  it('rejects non-staff callers', async () => {
    await expect(
      service.listForAdmin({ ...principal, roles: ['citizen'] } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires English zone name on upsert', async () => {
    await expect(
      service.upsertZone(principal as never, {
        code: 'ZONE-A',
        name: { bn: 'only bn' },
        capacity_bays: 20,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns stub occupancy for ZONE-A', async () => {
    prismaMock.smartZone.findUnique.mockResolvedValue({
      id: 'zone-1',
      code: 'ZONE-A',
    });

    const result = await service.getZoneOccupancy(principal as never, 'ZONE-A');
    expect(result.zone_code).toBe('ZONE-A');
    expect(result.bays).toHaveLength(20);
    expect(result.bays.find((bay) => bay.code === 'B01')?.status).toBe('OCCUPIED');
  });

  it('quotes a free bay for a citizen', async () => {
    prismaMock.smartZone.findUnique.mockResolvedValue({
      id: 'zone-1',
      code: 'ZONE-A',
      isActive: true,
      metadata: {
        pricing_matrix: {
          flat_rate_paise_per_hour: 3000,
          time_bands: [{ from_hhmm: '09:00', to_hhmm: '18:00', rate_paise_per_hour: 2000 }],
        },
      },
    });
    prismaMock.parkingBay.findUnique.mockResolvedValue({
      id: 'bay-3',
      bayCode: 'B03',
      status: 'FREE',
    });
    servicesMock.getTenantService.mockResolvedValue({
      code: 'smart-parking',
      revenue_head_code: 'smart-parking-fee',
      accounting_code: 'NTAX_SMART_PARKING',
    });
    servicesMock.resolveLedgerCodesForService.mockReturnValue({
      revenue_head_code: 'smart-parking-fee',
      accounting_code: 'NTAX_SMART_PARKING',
    });

    const result = await service.quoteForCitizen(citizenPrincipal as never, {
      tenant_code: 'KMC',
      zone_code: 'ZONE-A',
      bay_code: 'B03',
      starts_at: '2026-06-17T03:30:00.000Z',
      ends_at: '2026-06-17T04:30:00.000Z',
      vehicle_number: 'WB06A1234',
    });

    expect(result.rent_paise).toBe(2000);
    expect(result.revenue_head_code).toBe('smart-parking-fee');
    expect(result.bay_available).toBe(true);
  });

  it('returns 404 for unknown zone on quote', async () => {
    prismaMock.smartZone.findUnique.mockResolvedValue(null);

    await expect(
      service.quoteForCitizen(citizenPrincipal as never, {
        tenant_code: 'KMC',
        zone_code: 'ZONE-Z',
        bay_code: 'B01',
        starts_at: '2026-06-17T03:30:00.000Z',
        ends_at: '2026-06-17T04:30:00.000Z',
        vehicle_number: 'WB06A1234',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
