import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { resolveCitizenMunicipalityForWrite } from '../../common/auth/citizen-scope';
import { PrismaService } from '../../common/database/prisma.service';
import { renderSimplePdf } from '../../common/pdf/simple-pdf';
import { ensureMunicipalCitizenRow } from '../citizen/ensure-municipal-citizen-row';
import { principalHasGrievanceStaffAccess } from '../grievances/grievance-staff-roles';
import { CITIZEN_PORTAL_TENANT_CODE, tenantSeeds } from '../tenants/tenant.seed';

import {
  bookableAssetCodesFromOverrideConfig,
  isAssetAllowedForService,
} from './bookable-asset-scope.util';
import { assertBookableWindow } from './bookable-window';
import { isBookingWorkflowCode } from './booking-workflow.util';
import { computeBookingAmounts } from './bookings-payment.util';
import {
  bookingRefFromPathSegment,
  buildBookingConfirmationPdfLines,
  formatBookingSlotIst,
  jsonLabel,
} from './bookings-pdf.util';
import { reservationIdOrBookingNoWhere } from './bookings-reservation.util';
import { generateBookableSlots } from './bookings-slot.util';
import { parseBookingWindow, parseSlotRange } from './bookings-time.util';

import type {
  BookingCancelDto,
  BookingConfirmHoldDto,
  BookingCreateHoldDto,
  BookingQuoteDto,
} from './dto/bookings.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';

const HOLD_TTL_MS = 15 * 60 * 1000;
/** Holds tied to a desk application stay blocked until clerk confirm/reject. */
const CLERK_REVIEW_HOLD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type BookableAssetListItem = {
  code: string;
  name: Prisma.JsonValue;
  location: Prisma.JsonValue;
  rate_unit: string;
  asset_type: string;
  base_rate_paise: number;
  security_deposit_paise: number;
  slot_step_minutes: number;
  rules: Prisma.JsonValue;
};

export type BookingQuoteResponse = {
  asset_code: string;
  starts_at: string;
  ends_at: string;
  rate_unit: string;
  rent_paise: number;
  deposit_paise: number;
  total_paise: number;
  revenue_head_code: string | null;
};

export type BookingHoldResponse = {
  id: string;
  asset_code: string;
  status: string;
  starts_at: string;
  ends_at: string;
  rent_paise: number;
  deposit_paise: number;
  hold_expires_at: string;
};

export type BookingReservationResponse = {
  id: string;
  booking_no: string | null;
  asset_code: string;
  status: string;
  starts_at: string;
  ends_at: string;
  deposit_id: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAssetsForTenant(
    tenantCode: string,
    serviceCode?: string,
  ): Promise<BookableAssetListItem[]> {
    const tenantId = await this.resolveTenantIdByCode(tenantCode);
    const allowedCodes = serviceCode
      ? await this.resolveBookableAssetCodesForService(tenantId, serviceCode)
      : null;
    const rows = await this.prisma.bookableAsset.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(allowedCodes && allowedCodes.length > 0
          ? { code: { in: allowedCodes } }
          : allowedCodes
            ? { code: { in: [] } }
            : {}),
      },
      orderBy: { code: 'asc' },
    });
    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      location: row.location,
      rate_unit: row.rateUnit,
      asset_type: row.assetType,
      base_rate_paise: row.baseRatePaise,
      security_deposit_paise: row.securityDepositPaise,
      slot_step_minutes: row.slotStepMinutes,
      rules: row.rules,
    }));
  }

  async listAssetSlots(
    tenantCode: string,
    assetCode: string,
    fromRaw: string,
    toRaw: string,
    serviceCode?: string,
  ): Promise<{
    asset_code: string;
    from: string;
    to: string;
    slots: ReturnType<typeof generateBookableSlots>;
  }> {
    const tenantId = await this.resolveTenantIdByCode(tenantCode);
    if (serviceCode) {
      await this.assertAssetAllowedForService(tenantId, serviceCode, assetCode);
    }
    const { from, to } = parseSlotRange(fromRaw, toRaw);
    const asset = await this.getActiveAsset(tenantId, assetCode);

    const [available, blackouts, reservations] = await Promise.all([
      this.prisma.bookableAssetAvailability.findMany({
        where: {
          tenantId,
          assetId: asset.id,
          kind: 'available',
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
      }),
      this.prisma.bookableAssetAvailability.findMany({
        where: {
          tenantId,
          assetId: asset.id,
          kind: 'blackout',
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
      }),
      this.prisma.bookingReservation.findMany({
        where: {
          tenantId,
          assetId: asset.id,
          status: { in: ['hold', 'confirmed'] },
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
      }),
    ]);

    const slots = generateBookableSlots({
      from,
      to,
      slotStepMinutes: asset.slotStepMinutes,
      available,
      blackouts,
      reservations,
    });

    return {
      asset_code: asset.code,
      from: from.toISOString(),
      to: to.toISOString(),
      slots,
    };
  }

  async quote(dto: BookingQuoteDto): Promise<BookingQuoteResponse> {
    const tenantId = await this.resolveTenantIdByCode(dto.tenant_code);
    if (dto.service_code) {
      await this.assertAssetAllowedForService(tenantId, dto.service_code, dto.asset_code);
    }
    const asset = await this.getActiveAsset(tenantId, dto.asset_code);
    const { startsAt, endsAt } = parseBookingWindow(dto.starts_at, dto.ends_at);
    const revenueHeadCode = await this.resolveRevenueHeadCode(tenantId, asset.code);
    const amounts = computeBookingAmounts(asset, startsAt, endsAt);
    return {
      asset_code: asset.code,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      rate_unit: asset.rateUnit,
      revenue_head_code: revenueHeadCode,
      ...amounts,
    };
  }

  async createHold(
    principal: AuthenticatedPrincipal,
    dto: BookingCreateHoldDto,
    municipalityScopeHeader?: string,
  ): Promise<BookingHoldResponse> {
    const { tenantId, tenantCode } = resolveCitizenMunicipalityForWrite(
      principal,
      tenantSeeds,
      municipalityScopeHeader ?? dto.tenant_code,
    );
    if (tenantCode.toUpperCase() !== dto.tenant_code.trim().toUpperCase()) {
      throw new BadRequestException('tenant_code must match active municipality scope');
    }

    const citizenId = await ensureMunicipalCitizenRow(this.prisma, principal.subject, tenantId);
    if (dto.service_code) {
      await this.assertAssetAllowedForService(tenantId, dto.service_code, dto.asset_code);
    }
    const asset = await this.getActiveAsset(tenantId, dto.asset_code);
    const { startsAt, endsAt } = parseBookingWindow(dto.starts_at, dto.ends_at);
    await this.assertSlotFree(tenantId, asset, startsAt, endsAt);
    await assertBookableWindow(this.prisma, tenantId, asset, startsAt, endsAt);

    const profile = await this.prisma.citizen.findUniqueOrThrow({
      where: { id: citizenId },
      select: { name: true, mobile: true },
    });
    const amounts = computeBookingAmounts(asset, startsAt, endsAt);
    const holdExpiresAt = new Date(Date.now() + HOLD_TTL_MS);

    const row = await this.prisma.bookingReservation.create({
      data: {
        tenantId,
        assetId: asset.id,
        citizenId,
        holderName: dto.holder_name?.trim() || profile.name?.trim() || 'Citizen',
        holderMobile: dto.holder_mobile?.trim() || profile.mobile,
        startsAt,
        endsAt,
        status: 'hold',
        note: JSON.stringify({ hold_expires_at: holdExpiresAt.toISOString() }),
      },
      include: { asset: true },
    });

    return {
      id: row.id,
      asset_code: row.asset.code,
      status: row.status,
      starts_at: row.startsAt.toISOString(),
      ends_at: row.endsAt.toISOString(),
      rent_paise: amounts.rent_paise,
      deposit_paise: amounts.deposit_paise,
      hold_expires_at: holdExpiresAt.toISOString(),
    };
  }

  async linkApplicationToHold(
    principal: AuthenticatedPrincipal,
    holdId: string,
    applicationId: string,
    municipalityScopeHeader?: string,
  ): Promise<BookingReservationResponse> {
    const { tenantId } = resolveCitizenMunicipalityForWrite(
      principal,
      tenantSeeds,
      municipalityScopeHeader,
    );
    const row = await this.getReservationForTenant(tenantId, holdId);
    if (row.status !== 'hold') {
      throw new BadRequestException('Only hold reservations can be linked to an application');
    }
    await this.assertHoldOwnedByCitizen(principal, row);

    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, tenantId },
      select: { id: true, citizenId: true, status: true },
    });
    if (!application) {
      throw new BadRequestException('application_id is not valid for this municipality');
    }
    if (application.citizenId !== row.citizenId) {
      throw new ForbiddenException('Application does not belong to this booking holder');
    }
    if (application.status !== 'draft') {
      throw new BadRequestException('Only draft applications can be linked to a hold');
    }

    const holdExpiresAt = new Date(Date.now() + CLERK_REVIEW_HOLD_TTL_MS);
    const updated = await this.prisma.bookingReservation.update({
      where: { id: row.id },
      data: {
        applicationId: application.id,
        note: JSON.stringify({
          hold_expires_at: holdExpiresAt.toISOString(),
          clerk_review: true,
        }),
      },
      include: { asset: true },
    });

    return toReservationResponse(updated);
  }

  async confirmHold(
    principal: AuthenticatedPrincipal,
    holdId: string,
    dto: BookingConfirmHoldDto,
    municipalityScopeHeader?: string,
  ): Promise<BookingReservationResponse> {
    const { tenantId } = resolveCitizenMunicipalityForWrite(
      principal,
      tenantSeeds,
      municipalityScopeHeader,
    );
    const row = await this.getReservationForTenant(tenantId, holdId);
    if (row.status !== 'hold') {
      throw new BadRequestException('Only hold reservations can be confirmed');
    }
    await this.assertHoldOwnedByCitizen(principal, row);
    if (row.applicationId || dto.application_id) {
      throw new BadRequestException(
        'This slot is held pending ULB approval on your application. You will receive a booking number after the municipality confirms.',
      );
    }

    return this.finalizeHoldConfirmation(tenantId, row, dto.deposit_id ?? row.depositId, null);
  }

  /** Desk workflow (booking-v1): confirm slot after clerk approves the linked application. */
  async confirmHoldForDeskApplication(
    principal: AuthenticatedPrincipal,
    applicationId: string,
  ): Promise<BookingReservationResponse | null> {
    this.assertBookingStaff(principal);
    const tenantId = principal.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Staff tenant context is required');
    }
    const row = await this.prisma.bookingReservation.findFirst({
      where: { tenantId, applicationId, status: 'hold' },
      include: { asset: true },
    });
    if (!row) {
      return null;
    }
    return this.finalizeHoldConfirmation(tenantId, row, row.depositId, applicationId);
  }

  /** Desk workflow (booking-v1): release slot when clerk rejects or citizen withdraws. */
  async cancelHoldForDeskApplication(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    cancelReason?: string,
  ): Promise<BookingReservationResponse | null> {
    this.assertBookingStaff(principal);
    const tenantId = principal.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Staff tenant context is required');
    }
    const row = await this.prisma.bookingReservation.findFirst({
      where: {
        tenantId,
        applicationId,
        status: { in: ['hold', 'confirmed'] },
      },
      include: { asset: true },
    });
    if (!row || row.status === 'cancelled') {
      return null;
    }
    const updated = await this.prisma.bookingReservation.update({
      where: { id: row.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: cancelReason?.trim() || 'Application not approved',
      },
      include: { asset: true },
    });
    return toReservationResponse(updated);
  }

  async syncDeskWorkflowToReservation(
    principal: AuthenticatedPrincipal,
    input: {
      workflowCode: string;
      applicationId: string;
      verb: string;
      toStage: string;
      cancelReason?: string;
    },
  ): Promise<void> {
    if (!isBookingWorkflowCode(input.workflowCode)) {
      return;
    }
    if (input.toStage === 'confirmed' && input.verb === 'confirm') {
      await this.confirmHoldForDeskApplication(principal, input.applicationId);
      return;
    }
    if (
      (input.toStage === 'rejected' && input.verb === 'reject') ||
      (input.toStage === 'withdrawn' && input.verb === 'cancel')
    ) {
      await this.cancelHoldForDeskApplication(principal, input.applicationId, input.cancelReason);
    }
  }

  async cancelReservation(
    principal: AuthenticatedPrincipal,
    reservationId: string,
    dto: BookingCancelDto,
    municipalityScopeHeader?: string,
  ): Promise<BookingReservationResponse> {
    const staff =
      principalHasGrievanceStaffAccess(principal.roles) || principal.roles.includes('tenant_admin');
    let tenantId: string;

    if (staff && principal.tenantId && !municipalityScopeHeader) {
      tenantId = principal.tenantId;
    } else {
      ({ tenantId } = resolveCitizenMunicipalityForWrite(
        principal,
        tenantSeeds,
        municipalityScopeHeader,
      ));
    }

    const row = await this.getReservationForTenant(tenantId, reservationId);
    if (!staff) {
      await this.assertHoldOwnedByCitizen(principal, row);
    }
    if (row.status === 'cancelled') {
      throw new BadRequestException('Booking is already cancelled');
    }

    const updated = await this.prisma.bookingReservation.update({
      where: { id: row.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: dto.cancel_reason?.trim() || null,
      },
      include: { asset: true },
    });

    return toReservationResponse(updated);
  }

  async exportConfirmationPdf(
    principal: AuthenticatedPrincipal,
    ref: string,
    municipalityScopeHeader?: string,
  ): Promise<Buffer> {
    const { tenantId } = resolveCitizenMunicipalityForWrite(
      principal,
      tenantSeeds,
      municipalityScopeHeader,
    );
    const idOrBookingNo = bookingRefFromPathSegment(ref.trim());
    const row = await this.getReservationForTenant(tenantId, idOrBookingNo);
    await this.assertHoldOwnedByCitizen(principal, row);
    if (row.status !== 'confirmed' || !row.bookingNo) {
      throw new BadRequestException(
        'Confirmation PDF is only available for confirmed bookings with a booking number',
      );
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { code: true, name: true },
    });
    const amounts = computeBookingAmounts(row.asset, row.startsAt, row.endsAt);
    const slot = formatBookingSlotIst(row.startsAt, row.endsAt);
    const generatedAt = new Date();

    return renderSimplePdf(
      buildBookingConfirmationPdfLines({
        tenantName: tenant.name,
        tenantCode: tenant.code,
        assetName: jsonLabel(row.asset.name),
        assetCode: row.asset.code,
        bookingNo: row.bookingNo,
        status: row.status,
        slotDate: slot.date,
        slotHours: slot.hours,
        rentPaise: amounts.rent_paise,
        depositPaise: amounts.deposit_paise,
        generatedAt,
      }),
    );
  }

  private assertBookingStaff(principal: AuthenticatedPrincipal): void {
    const staff =
      principalHasGrievanceStaffAccess(principal.roles) ||
      principal.roles.includes('tenant_admin') ||
      principal.roles.includes('municipality_admin');
    if (!principal.tenantId || !staff) {
      throw new ForbiddenException('Staff access required');
    }
  }

  private async finalizeHoldConfirmation(
    tenantId: string,
    row: {
      id: string;
      assetId: string;
      citizenId: string | null;
      depositId: string | null;
      applicationId: string | null;
      startsAt: Date;
      endsAt: Date;
      asset: { code: string; securityDepositPaise: number };
    },
    depositIdInput: string | null | undefined,
    applicationId: string | null,
  ): Promise<BookingReservationResponse> {
    const asset = await this.prisma.bookableAsset.findUniqueOrThrow({
      where: { id: row.assetId },
    });
    const depositId = depositIdInput ?? row.depositId;
    if (asset.securityDepositPaise > 0) {
      if (!depositId) {
        throw new BadRequestException('deposit_id is required before confirming this booking');
      }
      const deposit = await this.prisma.deposit.findFirst({
        where: { id: depositId, tenantId, citizenId: row.citizenId ?? undefined },
      });
      if (!deposit || deposit.status !== 'held' || !deposit.capturePaymentId) {
        throw new BadRequestException(
          'A held security deposit with captured payment is required before confirmation',
        );
      }
      if (deposit.amountPaise !== asset.securityDepositPaise) {
        throw new BadRequestException('Deposit amount does not match the asset security deposit');
      }
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { code: true },
    });
    const bookingNo = await this.nextBookingNo(tenantId, tenant.code);
    if (depositId) {
      await this.prisma.deposit.update({
        where: { id: depositId },
        data: { referenceCode: bookingNo },
      });
    }
    const updated = await this.prisma.bookingReservation.update({
      where: { id: row.id },
      data: {
        status: 'confirmed',
        bookingNo,
        depositId: depositId ?? null,
        applicationId: applicationId ?? row.applicationId,
      },
      include: { asset: true },
    });

    return toReservationResponse(updated);
  }

  private async assertSlotFree(
    tenantId: string,
    asset: { id: string; code: string; slotStepMinutes: number },
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { code: true },
    });
    const { slots } = await this.listAssetSlots(
      tenant.code,
      asset.code,
      startsAt.toISOString(),
      endsAt.toISOString(),
    );
    const stepMs = asset.slotStepMinutes * 60_000;
    let cursor = startsAt.getTime();
    while (cursor < endsAt.getTime()) {
      const slotStart = new Date(cursor).toISOString();
      const slotEnd = new Date(cursor + stepMs).toISOString();
      const match = slots.find((slot) => slot.starts_at === slotStart && slot.ends_at === slotEnd);
      if (!match) {
        throw new BadRequestException('Selected window does not align to bookable slots');
      }
      if (match.status === 'taken') {
        throw new BadRequestException('Selected slot is no longer free');
      }
      cursor += stepMs;
    }
  }

  private async resolveTenantIdByCode(tenantCode: string): Promise<string> {
    const needle = tenantCode.trim().toUpperCase();
    if (needle === CITIZEN_PORTAL_TENANT_CODE) {
      throw new BadRequestException('Bookings must target a municipality');
    }
    const seeded = tenantSeeds.find((t) => t.is_active && t.code.toUpperCase() === needle);
    if (seeded) {
      return seeded.id;
    }
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        code: { equals: tenantCode.trim(), mode: 'insensitive' },
        isActive: true,
      },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant.id;
  }

  private async getActiveAsset(tenantId: string, code: string) {
    const asset = await this.prisma.bookableAsset.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!asset || !asset.isActive) {
      throw new NotFoundException('Bookable asset not found');
    }
    return asset;
  }

  private async getReservationForTenant(tenantId: string, idOrBookingNo: string) {
    const row = await this.prisma.bookingReservation.findFirst({
      where: {
        tenantId,
        ...reservationIdOrBookingNoWhere(idOrBookingNo),
      },
      include: { asset: true },
    });
    if (!row) {
      throw new NotFoundException('Booking reservation not found');
    }
    return row;
  }

  private async assertHoldOwnedByCitizen(
    principal: AuthenticatedPrincipal,
    row: { citizenId: string | null },
  ): Promise<void> {
    if (!row.citizenId) {
      throw new ForbiddenException('Booking is not linked to a citizen');
    }
    const citizen = await this.prisma.citizen.findFirst({
      where: { id: row.citizenId, keycloakSubject: principal.subject },
    });
    if (!citizen) {
      throw new ForbiddenException('You can only manage your own bookings');
    }
  }

  private async resolveBookableAssetCodesForService(
    tenantId: string,
    serviceCode: string,
  ): Promise<string[]> {
    const service = await this.prisma.tenantService.findFirst({
      where: { tenantId, code: serviceCode.trim(), isActive: true },
      select: { overrideConfig: true },
    });
    if (!service) {
      throw new NotFoundException(`Service ${serviceCode} is not available for this municipality`);
    }
    const override =
      typeof service.overrideConfig === 'object' && service.overrideConfig !== null
        ? (service.overrideConfig as Record<string, unknown>)
        : null;
    return bookableAssetCodesFromOverrideConfig(override);
  }

  private async assertAssetAllowedForService(
    tenantId: string,
    serviceCode: string,
    assetCode: string,
  ): Promise<void> {
    const allowed = await this.resolveBookableAssetCodesForService(tenantId, serviceCode);
    if (!isAssetAllowedForService(allowed, assetCode)) {
      throw new BadRequestException(
        `Asset ${assetCode} is not bookable under service ${serviceCode} for this municipality`,
      );
    }
  }

  private async resolveRevenueHeadCode(
    tenantId: string,
    assetCode: string,
  ): Promise<string | null> {
    const services = await this.prisma.tenantService.findMany({
      where: { tenantId, isActive: true },
      select: { overrideConfig: true, revenueHead: { select: { code: true } } },
    });
    for (const service of services) {
      const config = service.overrideConfig as Record<string, unknown> | null;
      if (config?.bookable_asset_code === assetCode) {
        return service.revenueHead?.code ?? null;
      }
    }
    const fallback = await this.prisma.tenantService.findFirst({
      where: { tenantId, code: 'community-hall', isActive: true },
      select: { revenueHead: { select: { code: true } } },
    });
    return fallback?.revenueHead?.code ?? 'booking-fee';
  }

  private async nextBookingNo(tenantId: string, tenantCode: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `BK/${tenantCode}/${year}/`;
    const count = await this.prisma.bookingReservation.count({
      where: { tenantId, bookingNo: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }
}

function toReservationResponse(row: {
  id: string;
  bookingNo: string | null;
  status: string;
  startsAt: Date;
  endsAt: Date;
  depositId: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  asset: { code: string };
}): BookingReservationResponse {
  return {
    id: row.id,
    booking_no: row.bookingNo,
    asset_code: row.asset.code,
    status: row.status,
    starts_at: row.startsAt.toISOString(),
    ends_at: row.endsAt.toISOString(),
    deposit_id: row.depositId,
    cancelled_at: row.cancelledAt?.toISOString() ?? null,
    cancel_reason: row.cancelReason,
  };
}
