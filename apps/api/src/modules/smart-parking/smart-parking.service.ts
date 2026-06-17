import { createHash, randomUUID } from 'node:crypto';

import {
  StubModbusSensorProvider,
  type ISensorProvider,
  type ZoneOccupancyResult,
} from '@enagar/smart-city-adapters';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  isCitizenSelfServicePrincipal,
  resolveCitizenMunicipalityForWrite,
} from '../../common/auth/citizen-scope';
import { PrismaService } from '../../common/database/prisma.service';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';
import { parseBookingWindow } from '../bookings/bookings-time.util';
import { ensureMunicipalCitizenRow } from '../citizen/ensure-municipal-citizen-row';
import { PAYMENT_STORE } from '../payments/payment-store';
import { ServicesService } from '../services/services.service';
import { tenantSeeds } from '../tenants/tenant.seed';

import {
  BulkCreateParkingBaysDto,
  ConfirmSmartParkingHoldDto,
  InitiateSmartParkingHoldPaymentDto,
  SmartParkingCreateHoldDto,
  SmartParkingQuoteDto,
  SmartParkingZoneBaysQueryDto,
  SmartParkingZonesQueryDto,
  UpdateParkingBayDto,
  UpsertParkingBayDto,
  UpsertSmartZoneDto,
} from './dto/smart-parking.dto';
import { mergeParkingBayStatuses, mergeParkingBayStatus } from './smart-parking-bay-status.util';
import {
  isActiveSmartParkingReservation,
  isSmartParkingHoldExpired,
  parseSmartParkingHoldNote,
  tryParseSmartParkingHoldNote,
  type SmartParkingHoldNote,
} from './smart-parking-hold.util';
import { computeSmartParkingRentPaise, parseSmartParkingPricingMatrix } from './smart-pricing.util';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';
import type { PaymentResponse } from '../payments/dto';
import type { IPaymentGateway } from '../payments/payment-gateway';
import type { PaymentStore } from '../payments/payment-store';

export type SmartParkingQuoteResponse = {
  zone_code: string;
  bay_code: string;
  starts_at: string;
  ends_at: string;
  vehicle_type: string | null;
  rent_paise: number;
  revenue_head_code: string;
  accounting_code: string;
  bay_available: true;
};

export type SmartParkingZoneListItem = {
  code: string;
  name: Prisma.JsonValue;
  free_count: number;
  total_count: number;
  is_active: boolean;
};

export type SmartParkingBayItem = {
  code: string;
  status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE';
};

export type SmartParkingHoldResponse = {
  hold_id: string;
  zone_code: string;
  bay_code: string;
  status: 'hold';
  starts_at: string;
  ends_at: string;
  hold_expires_at: string;
  rent_paise: number;
  payment: PaymentResponse | null;
};

const SMART_PARKING_SERVICE_CODE = 'smart-parking';
const SMART_PARKING_HOLD_TTL_MS = 10 * 60 * 1000;
const SMART_PARKING_PAYMENT_FEE_CODE = 'smart_parking';

export type TenantAdminSmartZoneRow = {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  ward_id: string | null;
  ward_number: string | null;
  geo: Prisma.JsonValue | null;
  capacity_bays: number;
  is_active: boolean;
  bay_count: number;
  updated_at: string;
};

export type TenantAdminParkingBayRow = {
  id: string;
  zone_code: string;
  bay_code: string;
  status: string;
  last_sensor_at: string | null;
  updated_at: string;
};

@Injectable()
export class SmartParkingService {
  private readonly sensorProvider: ISensorProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
    @Inject('IPaymentGateway')
    private readonly gateway: IPaymentGateway,
    @Inject(PAYMENT_STORE)
    private readonly store: PaymentStore,
  ) {
    this.sensorProvider = new StubModbusSensorProvider();
  }

  async listForAdmin(principal: AuthenticatedPrincipal): Promise<{
    zones: TenantAdminSmartZoneRow[];
    bays: TenantAdminParkingBayRow[];
  }> {
    assertTenantPortalStaff(principal);
    const [zones, bays] = await Promise.all([
      this.prisma.smartZone.findMany({
        where: { tenantId: principal.tenantId },
        include: {
          ward: { select: { number: true } },
          _count: { select: { parkingBays: true } },
        },
        orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
      }),
      this.prisma.parkingBay.findMany({
        where: { tenantId: principal.tenantId },
        include: { zone: { select: { code: true } } },
        orderBy: [{ zone: { code: 'asc' } }, { bayCode: 'asc' }],
      }),
    ]);

    return {
      zones: zones.map((zone) => toSmartZoneRow(zone)),
      bays: bays.map((bay) => toParkingBayRow(bay)),
    };
  }

  async upsertZone(
    principal: AuthenticatedPrincipal,
    dto: UpsertSmartZoneDto,
  ): Promise<TenantAdminSmartZoneRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.code, 'zone code');
    assertLocaleLabel(dto.name, 'zone name');

    const wardId = dto.ward_number
      ? await this.resolveWardId(principal.tenantId, dto.ward_number)
      : null;

    const row = await this.prisma.smartZone.upsert({
      where: { tenantId_code: { tenantId: principal.tenantId, code: dto.code } },
      create: {
        tenantId: principal.tenantId,
        code: dto.code,
        name: dto.name as Prisma.InputJsonValue,
        wardId,
        geo: (dto.geo ?? {}) as Prisma.InputJsonValue,
        metadata: buildZoneMetadata(dto.pricing_matrix),
        capacityBays: dto.capacity_bays,
        isActive: dto.is_active ?? true,
      },
      update: {
        name: dto.name as Prisma.InputJsonValue,
        wardId,
        geo: (dto.geo ?? {}) as Prisma.InputJsonValue,
        ...(dto.pricing_matrix !== undefined
          ? { metadata: buildZoneMetadata(dto.pricing_matrix) }
          : {}),
        capacityBays: dto.capacity_bays,
        isActive: dto.is_active ?? true,
      },
      include: {
        ward: { select: { number: true } },
        _count: { select: { parkingBays: true } },
      },
    });

    return toSmartZoneRow(row);
  }

  async upsertBay(
    principal: AuthenticatedPrincipal,
    dto: UpsertParkingBayDto,
  ): Promise<TenantAdminParkingBayRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.zone_code, 'zone code');
    assertCode(dto.bay_code, 'bay code');

    const zone = await this.getZoneByCode(principal.tenantId, dto.zone_code);
    const row = await this.prisma.parkingBay.upsert({
      where: {
        tenantId_zoneId_bayCode: {
          tenantId: principal.tenantId,
          zoneId: zone.id,
          bayCode: dto.bay_code,
        },
      },
      create: {
        tenantId: principal.tenantId,
        zoneId: zone.id,
        bayCode: dto.bay_code,
        status: dto.status ?? 'FREE',
      },
      update: {
        status: dto.status ?? undefined,
      },
      include: { zone: { select: { code: true } } },
    });

    return toParkingBayRow(row);
  }

  async bulkCreateBays(
    principal: AuthenticatedPrincipal,
    dto: BulkCreateParkingBaysDto,
  ): Promise<{ created: number; bays: TenantAdminParkingBayRow[] }> {
    assertTenantPortalStaff(principal);
    const zone = await this.getZoneByCode(principal.tenantId, dto.zone_code);
    const prefix = dto.prefix ?? 'B';
    const createdRows: TenantAdminParkingBayRow[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (let index = 1; index <= dto.count; index += 1) {
        const bayCode = `${prefix}${String(index).padStart(2, '0')}`;
        const row = await tx.parkingBay.upsert({
          where: {
            tenantId_zoneId_bayCode: {
              tenantId: principal.tenantId,
              zoneId: zone.id,
              bayCode,
            },
          },
          create: {
            tenantId: principal.tenantId,
            zoneId: zone.id,
            bayCode,
            status: 'FREE',
          },
          update: {},
          include: { zone: { select: { code: true } } },
        });
        createdRows.push(toParkingBayRow(row));
      }
    });

    return { created: createdRows.length, bays: createdRows };
  }

  async updateBay(
    principal: AuthenticatedPrincipal,
    bayId: string,
    dto: UpdateParkingBayDto,
  ): Promise<TenantAdminParkingBayRow> {
    assertTenantPortalStaff(principal);
    const existing = await this.prisma.parkingBay.findFirst({
      where: { id: bayId, tenantId: principal.tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Parking bay not found');
    }
    if (!dto.status) {
      throw new BadRequestException('No fields to update');
    }

    const row = await this.prisma.parkingBay.update({
      where: { id: bayId },
      data: { status: dto.status },
      include: { zone: { select: { code: true } } },
    });
    return toParkingBayRow(row);
  }

  async getZoneOccupancy(
    principal: AuthenticatedPrincipal,
    zoneCode: string,
  ): Promise<ZoneOccupancyResult & { zone_code: string }> {
    assertTenantPortalStaff(principal);
    await this.getZoneByCode(principal.tenantId, zoneCode);
    const snapshot = await this.sensorProvider.getZoneOccupancy(principal.tenantId, zoneCode);
    return { zone_code: zoneCode, ...snapshot };
  }

  async getZoneEffectiveBaysForAdmin(
    principal: AuthenticatedPrincipal,
    zoneCode: string,
  ): Promise<{
    zone_code: string;
    free_count: number;
    total_count: number;
    bays: SmartParkingBayItem[];
    polled_at: string;
  }> {
    assertTenantPortalStaff(principal);
    await this.releaseExpiredSmartParkingHolds(principal.tenantId);
    const zone = await this.getZoneByCode(principal.tenantId, zoneCode);
    const live = await this.sensorProvider.getZoneOccupancy(principal.tenantId, zone.code);
    const dbRows = await this.prisma.parkingBay.findMany({
      where: { tenantId: principal.tenantId, zoneId: zone.id },
      orderBy: { bayCode: 'asc' },
    });
    const bays = mergeParkingBayStatuses(dbRows, live.bays);
    return {
      zone_code: zone.code,
      free_count: bays.filter((bay) => bay.status === 'FREE').length,
      total_count: bays.length,
      bays,
      polled_at: new Date().toISOString(),
    };
  }

  async quoteForCitizen(
    principal: AuthenticatedPrincipal,
    dto: SmartParkingQuoteDto,
  ): Promise<SmartParkingQuoteResponse> {
    if (!isCitizenSelfServicePrincipal(principal)) {
      throw new ForbiddenException('Citizen access required');
    }

    const { tenantId, tenantCode } = resolveCitizenMunicipalityForWrite(
      principal,
      tenantSeeds,
      dto.tenant_code,
    );
    if (tenantCode.toUpperCase() !== dto.tenant_code.trim().toUpperCase()) {
      throw new BadRequestException('tenant_code must match active municipality scope');
    }

    const zone = await this.getActiveZoneByCode(tenantId, dto.zone_code);
    const bay = await this.prisma.parkingBay.findUnique({
      where: {
        tenantId_zoneId_bayCode: {
          tenantId,
          zoneId: zone.id,
          bayCode: dto.bay_code.trim(),
        },
      },
    });
    if (!bay) {
      throw new NotFoundException('Parking bay not found');
    }

    await this.assertBayAvailableForQuote(tenantId, zone.code, bay.bayCode, bay.status);

    const { startsAt, endsAt } = parseBookingWindow(dto.starts_at, dto.ends_at);
    const metadataRecord = zone.metadata as Record<string, unknown> | null;
    const pricing = parseSmartParkingPricingMatrix(metadataRecord?.pricing_matrix);
    const rentPaise = computeSmartParkingRentPaise({
      pricing,
      vehicleType: dto.vehicle_type,
      startsAt,
      endsAt,
    });

    const service = await this.services.getTenantService(tenantCode, SMART_PARKING_SERVICE_CODE);
    const ledger = this.services.resolveLedgerCodesForService(service);

    return {
      zone_code: zone.code,
      bay_code: bay.bayCode,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      vehicle_type: dto.vehicle_type?.trim() ?? null,
      rent_paise: rentPaise,
      revenue_head_code: ledger.revenue_head_code,
      accounting_code: ledger.accounting_code,
      bay_available: true,
    };
  }

  async listZonesForCitizen(
    principal: AuthenticatedPrincipal,
    query: SmartParkingZonesQueryDto,
  ): Promise<{ zones: SmartParkingZoneListItem[] }> {
    const { tenantId, tenantCode } = this.resolveCitizenTenant(principal, query.tenant_code);
    await this.releaseExpiredSmartParkingHolds(tenantId);
    const zones = await this.prisma.smartZone.findMany({
      where: { tenantId, isActive: true },
      include: { parkingBays: true },
      orderBy: { code: 'asc' },
    });

    const zoneRows = await Promise.all(
      zones.map(async (zone) => {
        const live = await this.sensorProvider.getZoneOccupancy(tenantId, zone.code);
        const bays = mergeParkingBayStatuses(zone.parkingBays, live.bays);
        const total = bays.length;
        const free = bays.filter((bay) => bay.status === 'FREE').length;
        return {
          code: zone.code,
          name: zone.name,
          free_count: free,
          total_count: total,
          is_active: zone.isActive,
        };
      }),
    );

    void tenantCode;
    return { zones: zoneRows };
  }

  async listZoneBaysForCitizen(
    principal: AuthenticatedPrincipal,
    zoneCode: string,
    query: SmartParkingZoneBaysQueryDto,
  ): Promise<{ zone_code: string; bays: SmartParkingBayItem[] }> {
    const { tenantId } = this.resolveCitizenTenant(principal, query.tenant_code);
    await this.releaseExpiredSmartParkingHolds(tenantId);
    const zone = await this.getActiveZoneByCode(tenantId, zoneCode);
    const live = await this.sensorProvider.getZoneOccupancy(tenantId, zone.code);
    const dbRows = await this.prisma.parkingBay.findMany({
      where: { tenantId, zoneId: zone.id },
      orderBy: { bayCode: 'asc' },
    });
    const bays = mergeParkingBayStatuses(dbRows, live.bays);
    return { zone_code: zone.code, bays };
  }

  async createHoldForCitizen(
    principal: AuthenticatedPrincipal,
    dto: SmartParkingCreateHoldDto,
  ): Promise<SmartParkingHoldResponse> {
    const { tenantId } = this.resolveCitizenTenant(principal, dto.tenant_code);
    await this.releaseExpiredSmartParkingHolds(tenantId);

    const zone = await this.getActiveZoneByCode(tenantId, dto.zone_code);
    const { startsAt, endsAt } = parseBookingWindow(dto.starts_at, dto.ends_at);
    const vehicleNumber = dto.vehicle_number.trim().toUpperCase();
    const citizenId = await ensureMunicipalCitizenRow(this.prisma, principal.subject, tenantId);

    await this.assertNoConflictingSmartParkingReservation(
      tenantId,
      citizenId,
      vehicleNumber,
      startsAt,
      endsAt,
    );

    const bayCode = dto.bay_code.trim();
    const bay = await this.prisma.parkingBay.findUnique({
      where: {
        tenantId_zoneId_bayCode: {
          tenantId,
          zoneId: zone.id,
          bayCode,
        },
      },
    });
    if (!bay) {
      throw new NotFoundException('Parking bay not found');
    }
    await this.assertBayAvailableForQuote(tenantId, zone.code, bayCode, bay.status);

    const rentPaise = this.computeZoneRent(zone, dto.vehicle_type, startsAt, endsAt);
    const holdExpiresAt = new Date(Date.now() + SMART_PARKING_HOLD_TTL_MS);
    const note: SmartParkingHoldNote = {
      source: 'smart_parking',
      bay_code: bayCode,
      zone_code: zone.code,
      hold_expires_at: holdExpiresAt.toISOString(),
      vehicle_type: dto.vehicle_type?.trim() || null,
      vehicle_number: vehicleNumber,
    };

    const asset = await this.getOrCreateBayAsset(tenantId, zone, bayCode);

    const reservation = await this.prisma.$transaction(async (tx) => {
      const bay = await tx.parkingBay.findUnique({
        where: {
          tenantId_zoneId_bayCode: {
            tenantId,
            zoneId: zone.id,
            bayCode,
          },
        },
      });
      if (!bay) {
        throw new NotFoundException('Parking bay not found');
      }
      if (bay.status !== 'FREE') {
        throw new ConflictException('Parking bay is no longer available');
      }

      const overlap = await tx.bookingReservation.findFirst({
        where: {
          tenantId,
          assetId: asset.id,
          status: { in: ['hold', 'confirmed'] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true },
      });
      if (overlap) {
        throw new ConflictException('Parking bay is already reserved for that window');
      }

      const reserved = await tx.parkingBay.updateMany({
        where: { id: bay.id, status: 'FREE' },
        data: { status: 'RESERVED', lastSensorAt: new Date() },
      });
      if (reserved.count === 0) {
        throw new ConflictException('Parking bay was just reserved by another request');
      }

      return tx.bookingReservation.create({
        data: {
          tenantId,
          assetId: asset.id,
          citizenId,
          holderName: 'Smart Parking Citizen',
          startsAt,
          endsAt,
          status: 'hold',
          note: JSON.stringify(note),
        },
      });
    });

    return {
      hold_id: reservation.id,
      zone_code: zone.code,
      bay_code: bayCode,
      status: 'hold',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      hold_expires_at: holdExpiresAt.toISOString(),
      rent_paise: rentPaise,
      payment: null,
    };
  }

  async initiateHoldPaymentForCitizen(
    principal: AuthenticatedPrincipal,
    holdId: string,
    dto: InitiateSmartParkingHoldPaymentDto,
    idempotencyKey: string | undefined,
  ): Promise<SmartParkingHoldResponse> {
    const normalizedKey = idempotencyKey?.trim();
    if (!normalizedKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const hold = await this.getOwnedSmartParkingHold(principal, holdId);
    const note = this.parseHoldNote(hold.note);
    const zone = await this.getActiveZoneByCode(hold.tenantId, note.zone_code);
    const rentPaise = this.computeZoneRent(
      zone,
      note.vehicle_type ?? undefined,
      hold.startsAt,
      hold.endsAt,
    );
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: hold.tenantId },
      select: { code: true },
    });

    const fingerprint = createHash('sha256')
      .update(`${hold.id}:${rentPaise}:${dto.method}:smart-parking`)
      .digest('hex');
    const existing = await this.store.findIdempotencyRecord(
      principal,
      normalizedKey,
      hold.tenantId,
    );
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new ConflictException('Idempotency-Key was already used for a different payment');
      }
      const payment = await this.store.findByIdForPrincipal(principal, existing.paymentId);
      if (!payment) {
        throw new NotFoundException('Idempotent payment not found');
      }
      return this.toHoldResponse(hold, note, rentPaise, payment);
    }

    const active = await this.store.findActivePaymentByBookingReservation(hold.id);
    if (active) {
      return this.toHoldResponse(hold, note, rentPaise, active);
    }

    const paymentId = randomUUID();
    const gatewayResult = await this.gateway.initiate({
      paymentId,
      tenantId: hold.tenantId,
      applicationId: hold.id,
      amountPaise: rentPaise,
      currency: 'INR',
      method: dto.method,
    });
    const payment = await this.store.createPendingPayment({
      id: paymentId,
      tenantId: hold.tenantId,
      citizenSubject: principal.subject,
      bookingReservationId: hold.id,
      feeCode: SMART_PARKING_PAYMENT_FEE_CODE,
      amountPaise: rentPaise,
      method: dto.method,
      gateway: gatewayResult.gateway,
      gatewayOrderId: gatewayResult.gatewayOrderId,
      redirectUrl: gatewayResult.redirectUrl,
      idempotencyKey: normalizedKey,
      requestFingerprint: fingerprint,
      expiresAt: this.nextDay(),
    });
    await this.prisma.bookingReservation.update({
      where: { id: hold.id },
      data: {
        note: JSON.stringify({
          ...note,
          service_code: SMART_PARKING_SERVICE_CODE,
          tenant_code: tenant.code,
          rent_paise: rentPaise,
        }),
      },
    });
    return this.toHoldResponse(hold, note, rentPaise, payment);
  }

  async confirmHoldForCitizen(
    principal: AuthenticatedPrincipal,
    holdId: string,
    dto: ConfirmSmartParkingHoldDto,
  ): Promise<{
    hold_id: string;
    booking_no: string;
    zone_code: string;
    bay_code: string;
    status: 'confirmed';
  }> {
    const hold = await this.getOwnedSmartParkingHold(principal, holdId);
    const note = this.parseHoldNote(hold.note);
    const payment = dto.payment_id
      ? await this.store.findByIdForPrincipal(principal, dto.payment_id)
      : await this.store.findActivePaymentByBookingReservation(hold.id);

    if (!payment || payment.status !== 'settled') {
      throw new BadRequestException('Payment must be settled before confirmation');
    }
    if (hold.status !== 'hold') {
      throw new ConflictException('Parking hold is not awaiting confirmation');
    }
    const bookingNo = await this.nextSmartParkingBookingNo(hold.tenantId);
    await this.prisma.$transaction(async (tx) => {
      const zone = await tx.smartZone.findUnique({
        where: { tenantId_code: { tenantId: hold.tenantId, code: note.zone_code } },
        select: { id: true },
      });
      if (!zone) {
        throw new NotFoundException('Smart zone not found');
      }
      await tx.bookingReservation.update({
        where: { id: hold.id },
        data: {
          status: 'confirmed',
          bookingNo,
        },
      });
      const bay = await tx.parkingBay.findUnique({
        where: {
          tenantId_zoneId_bayCode: {
            tenantId: hold.tenantId,
            zoneId: zone.id,
            bayCode: note.bay_code,
          },
        },
      });
      if (bay) {
        await tx.parkingBay.update({
          where: { id: bay.id },
          data: { status: 'OCCUPIED', lastSensorAt: new Date() },
        });
      }
    });

    return {
      hold_id: hold.id,
      booking_no: bookingNo,
      zone_code: note.zone_code,
      bay_code: note.bay_code,
      status: 'confirmed',
    };
  }

  private parseHoldNote(raw: string | null): SmartParkingHoldNote {
    try {
      return parseSmartParkingHoldNote(raw);
    } catch {
      throw new BadRequestException('Parking hold metadata is invalid');
    }
  }

  private async releaseExpiredSmartParkingHolds(tenantId: string): Promise<void> {
    const now = new Date();
    const holds = await this.prisma.bookingReservation.findMany({
      where: {
        tenantId,
        status: 'hold',
        note: { contains: '"source":"smart_parking"' },
      },
      select: {
        id: true,
        note: true,
      },
    });

    for (const hold of holds) {
      const note = tryParseSmartParkingHoldNote(hold.note);
      if (!note || !isSmartParkingHoldExpired(note, 'hold', now)) {
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        const current = await tx.bookingReservation.findUnique({
          where: { id: hold.id },
          select: { status: true },
        });
        if (!current || current.status !== 'hold') {
          return;
        }

        await tx.bookingReservation.update({
          where: { id: hold.id },
          data: {
            status: 'cancelled',
            cancelledAt: now,
            cancelReason: 'hold_expired',
          },
        });

        const zone = await tx.smartZone.findUnique({
          where: { tenantId_code: { tenantId, code: note.zone_code } },
          select: { id: true },
        });
        if (!zone) {
          return;
        }

        const bay = await tx.parkingBay.findUnique({
          where: {
            tenantId_zoneId_bayCode: {
              tenantId,
              zoneId: zone.id,
              bayCode: note.bay_code,
            },
          },
          select: { id: true, status: true },
        });
        if (bay?.status === 'RESERVED') {
          await tx.parkingBay.update({
            where: { id: bay.id },
            data: { status: 'FREE', lastSensorAt: now },
          });
        }
      });
    }
  }

  private async assertNoConflictingSmartParkingReservation(
    tenantId: string,
    citizenId: string,
    vehicleNumber: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    const candidates = await this.prisma.bookingReservation.findMany({
      where: {
        tenantId,
        status: { in: ['hold', 'confirmed'] },
        note: { contains: '"source":"smart_parking"' },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: {
        id: true,
        status: true,
        note: true,
        startsAt: true,
        endsAt: true,
        citizenId: true,
      },
    });

    for (const row of candidates) {
      if (!isActiveSmartParkingReservation(row, startsAt, endsAt)) {
        continue;
      }
      const note = tryParseSmartParkingHoldNote(row.note);
      if (!note) {
        continue;
      }
      if (row.citizenId === citizenId) {
        throw new ConflictException(
          'You already have an active smart parking reservation for this time window',
        );
      }
      if (note.vehicle_number === vehicleNumber) {
        throw new ConflictException(
          'This vehicle already has an active smart parking reservation for this time window',
        );
      }
    }
  }

  private resolveCitizenTenant(principal: AuthenticatedPrincipal, tenantCodeRaw: string) {
    if (!isCitizenSelfServicePrincipal(principal)) {
      throw new ForbiddenException('Citizen access required');
    }
    const { tenantId, tenantCode } = resolveCitizenMunicipalityForWrite(
      principal,
      tenantSeeds,
      tenantCodeRaw,
    );
    if (tenantCode.toUpperCase() !== tenantCodeRaw.trim().toUpperCase()) {
      throw new BadRequestException('tenant_code must match active municipality scope');
    }
    return { tenantId, tenantCode };
  }

  private computeZoneRent(
    zone: { metadata: Prisma.JsonValue },
    vehicleType: string | undefined,
    startsAt: Date,
    endsAt: Date,
  ): number {
    const metadataRecord = zone.metadata as Record<string, unknown> | null;
    const pricing = parseSmartParkingPricingMatrix(metadataRecord?.pricing_matrix);
    return computeSmartParkingRentPaise({
      pricing,
      vehicleType,
      startsAt,
      endsAt,
    });
  }

  private async getOrCreateBayAsset(
    tenantId: string,
    zone: {
      code: string;
      name: Prisma.JsonValue;
      capacityBays: number;
      metadata: Prisma.JsonValue;
    },
    bayCode: string,
  ) {
    const assetCode = `smart-parking-${zone.code}-${bayCode}`.toLowerCase();
    const metadata = zone.metadata as Record<string, unknown> | null;
    const pricing = parseSmartParkingPricingMatrix(metadata?.pricing_matrix);
    const baseRate = pricing.flat_rate_paise_per_hour ?? 3000;
    const zoneName =
      zone.name && typeof zone.name === 'object' && !Array.isArray(zone.name)
        ? (zone.name as Record<string, string>)
        : { en: zone.code };
    const bayName = {
      en: `${zoneName.en ?? zone.code} — ${bayCode}`,
      bn: zoneName.bn ? `${zoneName.bn} — ${bayCode}` : `${zone.code} — ${bayCode}`,
      hi: zoneName.hi ? `${zoneName.hi} — ${bayCode}` : `${zone.code} — ${bayCode}`,
    };
    return this.prisma.bookableAsset.upsert({
      where: { tenantId_code: { tenantId, code: assetCode } },
      create: {
        tenantId,
        code: assetCode,
        assetType: 'PARKING_ZONE',
        name: bayName as Prisma.InputJsonValue,
        location: {},
        capacity: 1,
        rateUnit: 'HOUR',
        baseRatePaise: baseRate,
        securityDepositPaise: 0,
        slotStepMinutes: 60,
        rules: {},
        metadata: {
          source: 'smart_parking',
          zone_code: zone.code,
          bay_code: bayCode,
        } as Prisma.InputJsonValue,
      },
      update: {
        name: bayName as Prisma.InputJsonValue,
        baseRatePaise: baseRate,
        metadata: {
          source: 'smart_parking',
          zone_code: zone.code,
          bay_code: bayCode,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async getOwnedSmartParkingHold(principal: AuthenticatedPrincipal, holdId: string) {
    const hold = await this.prisma.bookingReservation.findUnique({
      where: { id: holdId },
      include: { asset: true, citizen: { select: { keycloakSubject: true } } },
    });
    if (!hold) {
      throw new NotFoundException('Parking hold not found');
    }
    if (hold.citizen?.keycloakSubject !== principal.subject) {
      throw new ForbiddenException('You can only manage your own parking hold');
    }
    return hold;
  }

  private async nextSmartParkingBookingNo(tenantId: string): Promise<string> {
    const date = new Date();
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const prefix = `SPARK/${y}${m}${d}/`;
    const existing = await this.prisma.bookingReservation.count({
      where: {
        tenantId,
        bookingNo: { startsWith: prefix },
      },
    });
    return `${prefix}${String(existing + 1).padStart(4, '0')}`;
  }

  private toHoldResponse(
    hold: {
      id: string;
      startsAt: Date;
      endsAt: Date;
      status: string;
    },
    note: SmartParkingHoldNote,
    rentPaise: number,
    payment: PaymentResponse | null,
  ): SmartParkingHoldResponse {
    return {
      hold_id: hold.id,
      zone_code: note.zone_code,
      bay_code: note.bay_code,
      status: 'hold',
      starts_at: hold.startsAt.toISOString(),
      ends_at: hold.endsAt.toISOString(),
      hold_expires_at: note.hold_expires_at,
      rent_paise: rentPaise,
      payment,
    };
  }

  private nextDay(): Date {
    const expires = new Date();
    expires.setUTCDate(expires.getUTCDate() + 1);
    return expires;
  }

  private async assertBayAvailableForQuote(
    tenantId: string,
    zoneCode: string,
    bayCode: string,
    dbStatus: string,
  ): Promise<void> {
    if (dbStatus !== 'FREE') {
      throw new BadRequestException('Parking bay is not available');
    }

    const snapshot = await this.sensorProvider.getZoneOccupancy(tenantId, zoneCode);
    const sensorBay = snapshot.bays.find((bay) => bay.code === bayCode);
    if (!sensorBay) {
      throw new NotFoundException('Parking bay not found in sensor snapshot');
    }
    const effectiveStatus = mergeParkingBayStatus(dbStatus, sensorBay.status);
    if (effectiveStatus !== 'FREE') {
      throw new BadRequestException('Parking bay is not available');
    }
  }

  private async getActiveZoneByCode(tenantId: string, code: string) {
    const zone = await this.prisma.smartZone.findUnique({
      where: { tenantId_code: { tenantId, code: code.trim() } },
    });
    if (!zone || !zone.isActive) {
      throw new NotFoundException('Smart zone not found');
    }
    return zone;
  }

  private async getZoneByCode(tenantId: string, code: string) {
    const zone = await this.prisma.smartZone.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!zone) {
      throw new NotFoundException('Smart zone not found');
    }
    return zone;
  }

  private async resolveWardId(tenantId: string, wardNumber: string): Promise<string | null> {
    const ward = await this.prisma.ward.findUnique({
      where: { tenantId_number: { tenantId, number: wardNumber } },
      select: { id: true },
    });
    if (!ward) {
      throw new BadRequestException(`Ward ${wardNumber} not found`);
    }
    return ward.id;
  }
}

function toSmartZoneRow(row: {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  wardId: string | null;
  geo: Prisma.JsonValue | null;
  capacityBays: number;
  isActive: boolean;
  updatedAt: Date;
  ward: { number: string } | null;
  _count: { parkingBays: number };
}): TenantAdminSmartZoneRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    ward_id: row.wardId,
    ward_number: row.ward?.number ?? null,
    geo: row.geo,
    capacity_bays: row.capacityBays,
    is_active: row.isActive,
    bay_count: row._count.parkingBays,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toParkingBayRow(row: {
  id: string;
  bayCode: string;
  status: string;
  lastSensorAt: Date | null;
  updatedAt: Date;
  zone: { code: string };
}): TenantAdminParkingBayRow {
  return {
    id: row.id,
    zone_code: row.zone.code,
    bay_code: row.bayCode,
    status: row.status,
    last_sensor_at: row.lastSensorAt?.toISOString() ?? null,
    updated_at: row.updatedAt.toISOString(),
  };
}

function assertCode(value: string, label: string): void {
  const trimmed = value.trim();
  if (!trimmed || !/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new BadRequestException(`${label} must be a non-empty alphanumeric code`);
  }
}

function assertLocaleLabel(value: Record<string, unknown>, label: string): void {
  if (!value || typeof value !== 'object' || typeof value.en !== 'string' || !value.en.trim()) {
    throw new BadRequestException(`${label} requires at least an English (en) label`);
  }
}

function buildZoneMetadata(
  pricingMatrix: Record<string, unknown> | undefined,
): Prisma.InputJsonValue {
  if (!pricingMatrix) {
    return { pricing_matrix: {} } as Prisma.InputJsonValue;
  }
  return { pricing_matrix: pricingMatrix } as Prisma.InputJsonValue;
}
