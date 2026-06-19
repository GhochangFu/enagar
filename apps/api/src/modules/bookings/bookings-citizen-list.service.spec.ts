import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { CITIZEN_PORTAL_TENANT_ID } from '../tenants/tenant.seed';

import { BookingsService } from './bookings.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

const kmcTenantId = '11111111-1111-4111-8111-111111111111';
const hmcTenantId = '22222222-2222-4222-8222-222222222222';

const portalCitizen: AuthenticatedPrincipal = {
  subject: 'citizen-hub',
  tenantId: CITIZEN_PORTAL_TENANT_ID,
  tenantCode: 'WBPORTAL',
  roles: ['citizen'],
  expiresAt: new Date('2026-12-31T00:00:00.000Z'),
};

const kmcCitizen: AuthenticatedPrincipal = {
  subject: 'citizen-kmc',
  tenantId: kmcTenantId,
  tenantCode: 'KMC',
  roles: ['citizen'],
  expiresAt: new Date('2026-12-31T00:00:00.000Z'),
};

describe('BookingsService.listReservationsForCitizen', () => {
  let service: BookingsService;
  let prisma: {
    citizen: { findMany: jest.Mock };
    bookingReservation: { findMany: jest.Mock };
    tenantService: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      citizen: {
        findMany: jest.fn(),
      },
      bookingReservation: {
        findMany: jest.fn(),
      },
      tenantService: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new BookingsService(prisma as unknown as PrismaService);
  });

  it('returns empty list when citizen has no municipal rows', async () => {
    prisma.citizen.findMany.mockResolvedValue([]);
    await expect(service.listReservationsForCitizen(portalCitizen)).resolves.toEqual([]);
    expect(prisma.bookingReservation.findMany).not.toHaveBeenCalled();
  });

  it('scopes hub list to municipality header tenant', async () => {
    prisma.citizen.findMany.mockResolvedValue([
      { id: 'cit-kmc', tenantId: kmcTenantId },
      { id: 'cit-hmc', tenantId: hmcTenantId },
    ]);
    prisma.bookingReservation.findMany.mockResolvedValue([
      {
        id: 'res-kmc',
        bookingNo: 'BK/KMC/2026/00001',
        status: 'confirmed',
        startsAt: new Date('2026-06-10T04:30:00.000Z'),
        endsAt: new Date('2026-06-10T05:30:00.000Z'),
        holderName: 'Citizen Hub',
        note: JSON.stringify({ service_code: 'ambulance' }),
        tenantId: kmcTenantId,
        tenant: { code: 'KMC' },
        asset: {
          assetType: 'AMBULANCE',
          rateUnit: 'HOUR',
          baseRatePaise: 50_000,
          securityDepositPaise: 0,
          rules: {},
          code: 'kmc-ambulance-01',
        },
      },
    ]);

    const rows = await service.listReservationsForCitizen(portalCitizen, {
      municipalityTenantCode: 'KMC',
    });

    expect(prisma.bookingReservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          citizenId: { in: ['cit-kmc'] },
          tenantId: kmcTenantId,
          status: 'confirmed',
        }),
      }),
    );
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row).not.toHaveProperty('asset_code');
    expect(row.service_label).toBe('Municipal ambulance');
  });

  it('rejects invalid municipality scope', async () => {
    prisma.citizen.findMany.mockResolvedValue([{ id: 'cit-kmc', tenantId: kmcTenantId }]);
    await expect(
      service.listReservationsForCitizen(portalCitizen, { municipalityTenantCode: 'NOPE' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('filters municipal JWT to principal tenant only', async () => {
    prisma.citizen.findMany.mockResolvedValue([{ id: 'cit-kmc', tenantId: kmcTenantId }]);
    prisma.bookingReservation.findMany.mockResolvedValue([]);

    await service.listReservationsForCitizen(kmcCitizen);

    expect(prisma.bookingReservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: kmcTenantId,
        }),
      }),
    );
  });
});
