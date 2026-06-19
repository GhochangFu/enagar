import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { resolveCitizenMunicipalityForWrite } from '../../common/auth/citizen-scope';
import { PrismaService } from '../../common/database/prisma.service';
import { PAYMENT_STORE } from '../payments/payment-store';
import { ServicesService } from '../services/services.service';
import { tenantSeeds } from '../tenants/tenant.seed';

import { computeBookingAmounts } from './bookings-payment.util';
import { parseBookingReservationNote } from './booking-reservation-note.util';
import { readBplSubsidyPaise } from './health-fleet.util';
import { reservationIdOrBookingNoWhere } from './bookings-reservation.util';

import type { InitiateBookingHoldPaymentDto } from './dto/bookings.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';
import type { PaymentMethod, PaymentResponse } from '../payments/dto';
import type { IPaymentGateway } from '../payments/payment-gateway';
import type { PaymentStore } from '../payments/payment-store';

export const BOOKING_PAYMENT_FEE_CODE = 'booking_deposit' as const;
export const BOOKING_DEPOSIT_TYPE = 'booking_security' as const;

export type BookingHoldPaymentResponse = {
  hold_id: string;
  deposit_id: string;
  payment: PaymentResponse;
  amount_paise: number;
  deposit_paise: number;
  rent_paise: number;
  include_rent: boolean;
};

@Injectable()
export class BookingsDepositPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
    @Inject('IPaymentGateway')
    private readonly gateway: IPaymentGateway,
    @Inject(PAYMENT_STORE)
    private readonly store: PaymentStore,
  ) {}

  async initiateForHold(
    principal: AuthenticatedPrincipal,
    holdId: string,
    dto: InitiateBookingHoldPaymentDto,
    idempotencyKey: string | undefined,
    municipalityScopeHeader?: string,
  ): Promise<BookingHoldPaymentResponse> {
    const normalizedKey = idempotencyKey?.trim();
    if (!normalizedKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const { tenantId } = resolveCitizenMunicipalityForWrite(
      principal,
      tenantSeeds,
      municipalityScopeHeader,
    );
    const row = await this.prisma.bookingReservation.findFirst({
      where: {
        tenantId,
        ...reservationIdOrBookingNoWhere(holdId),
      },
      include: { asset: true },
    });
    if (!row || row.status !== 'hold') {
      throw new NotFoundException('Booking hold not found');
    }
    if (!row.citizenId) {
      throw new BadRequestException('Hold is not linked to a citizen');
    }
    const citizen = await this.prisma.citizen.findFirst({
      where: { id: row.citizenId, keycloakSubject: principal.subject },
    });
    if (!citizen) {
      throw new BadRequestException('You can only pay for your own booking hold');
    }

    const amounts = computeBookingAmounts(row.asset, row.startsAt, row.endsAt);
    const noteMeta = parseBookingReservationNote(row.note);
    if (noteMeta.emergency) {
      throw new BadRequestException('Emergency bookings do not require payment');
    }

    const rentDue = noteMeta.bpl_declared
      ? Math.max(0, amounts.rent_paise - readBplSubsidyPaise(row.asset.rules))
      : amounts.rent_paise;

    if (amounts.deposit_paise <= 0) {
      if (rentDue <= 0) {
        throw new BadRequestException('This booking does not require payment');
      }
      return this.initiateRentOnlyHoldPayment(
        principal,
        row,
        tenantId,
        dto,
        normalizedKey,
        rentDue,
      );
    }

    const includeRent = dto.include_rent === true;
    const amountPaise = amounts.deposit_paise + (includeRent ? amounts.rent_paise : 0);
    const fingerprint = this.fingerprint(holdId, amountPaise, dto.method, includeRent);

    const existingIdempotency = await this.store.findIdempotencyRecord(
      principal,
      normalizedKey,
      tenantId,
    );
    if (existingIdempotency) {
      if (existingIdempotency.fingerprint !== fingerprint) {
        throw new ConflictException('Idempotency-Key was already used for a different payment');
      }
      const payment = await this.store.findByIdForPrincipal(
        principal,
        existingIdempotency.paymentId,
      );
      if (!payment?.booking_reservation_id) {
        throw new ConflictException('Idempotency payment is not a booking hold payment');
      }
      const deposit = await this.requireDepositForReservation(tenantId, row.id);
      return this.toHoldPaymentResponse(row.id, deposit.id, payment, amounts, includeRent);
    }

    const active = await this.store.findActivePaymentByBookingReservation(row.id);
    if (active) {
      const deposit = await this.requireDepositForReservation(tenantId, row.id);
      return this.toHoldPaymentResponse(row.id, deposit.id, active, amounts, includeRent);
    }

    const referenceCode = `HOLD/${row.id}`;
    const deposit =
      row.depositId != null
        ? await this.prisma.deposit.findUniqueOrThrow({ where: { id: row.depositId } })
        : await this.prisma.deposit.create({
            data: {
              tenantId,
              citizenId: row.citizenId,
              depositType: BOOKING_DEPOSIT_TYPE,
              referenceCode,
              amountPaise: amounts.deposit_paise,
              status: 'held',
              metadata: {
                hold_id: row.id,
                rent_paise: amounts.rent_paise,
                include_rent: includeRent,
              } as Prisma.InputJsonValue,
            },
          });

    if (row.depositId !== deposit.id) {
      await this.prisma.bookingReservation.update({
        where: { id: row.id },
        data: { depositId: deposit.id },
      });
    }

    const paymentId = randomUUID();
    const gatewayResult = await this.gateway.initiate({
      paymentId,
      tenantId,
      applicationId: row.id,
      amountPaise,
      currency: 'INR',
      method: dto.method,
    });

    const payment = await this.store.createPendingPayment({
      id: paymentId,
      tenantId,
      citizenSubject: principal.subject,
      bookingReservationId: row.id,
      feeCode: BOOKING_PAYMENT_FEE_CODE,
      amountPaise,
      method: dto.method,
      gateway: gatewayResult.gateway,
      gatewayOrderId: gatewayResult.gatewayOrderId,
      redirectUrl: gatewayResult.redirectUrl,
      idempotencyKey: normalizedKey,
      requestFingerprint: fingerprint,
      expiresAt: this.nextDay(),
    });

    return this.toHoldPaymentResponse(row.id, deposit.id, payment, amounts, includeRent);
  }

  private async initiateRentOnlyHoldPayment(
    principal: AuthenticatedPrincipal,
    row: {
      id: string;
      citizenId: string | null;
      depositId: string | null;
      asset: {
        rateUnit: string;
        baseRatePaise: number;
        securityDepositPaise: number;
        rules: Prisma.JsonValue;
      };
      startsAt: Date;
      endsAt: Date;
    },
    tenantId: string,
    dto: InitiateBookingHoldPaymentDto,
    normalizedKey: string,
    rentDuePaise: number,
  ): Promise<BookingHoldPaymentResponse> {
    const amounts = computeBookingAmounts(row.asset, row.startsAt, row.endsAt);
    const fingerprint = this.fingerprint(row.id, rentDuePaise, dto.method, true);

    const existingIdempotency = await this.store.findIdempotencyRecord(
      principal,
      normalizedKey,
      tenantId,
    );
    if (existingIdempotency) {
      if (existingIdempotency.fingerprint !== fingerprint) {
        throw new ConflictException('Idempotency-Key was already used for a different payment');
      }
      const payment = await this.store.findByIdForPrincipal(
        principal,
        existingIdempotency.paymentId,
      );
      if (!payment?.booking_reservation_id) {
        throw new ConflictException('Idempotency payment is not a booking hold payment');
      }
      const deposit = row.depositId
        ? await this.prisma.deposit.findUniqueOrThrow({ where: { id: row.depositId } })
        : await this.requireDepositForReservation(tenantId, row.id);
      return this.toHoldPaymentResponse(row.id, deposit.id, payment, amounts, true);
    }

    const active = await this.store.findActivePaymentByBookingReservation(row.id);
    if (active) {
      const deposit = row.depositId
        ? await this.prisma.deposit.findUniqueOrThrow({ where: { id: row.depositId } })
        : await this.requireDepositForReservation(tenantId, row.id);
      return this.toHoldPaymentResponse(row.id, deposit.id, active, amounts, true);
    }

    const deposit =
      row.depositId != null
        ? await this.prisma.deposit.findUniqueOrThrow({ where: { id: row.depositId } })
        : await this.prisma.deposit.create({
            data: {
              tenantId,
              citizenId: row.citizenId!,
              depositType: BOOKING_DEPOSIT_TYPE,
              referenceCode: `HOLD/${row.id}`,
              amountPaise: rentDuePaise,
              status: 'held',
              metadata: {
                hold_id: row.id,
                rent_paise: rentDuePaise,
                include_rent: true,
                rent_only: true,
              } as Prisma.InputJsonValue,
            },
          });

    if (row.depositId !== deposit.id) {
      await this.prisma.bookingReservation.update({
        where: { id: row.id },
        data: { depositId: deposit.id },
      });
    }

    const paymentId = randomUUID();
    const gatewayResult = await this.gateway.initiate({
      paymentId,
      tenantId,
      applicationId: row.id,
      amountPaise: rentDuePaise,
      currency: 'INR',
      method: dto.method,
    });

    const payment = await this.store.createPendingPayment({
      id: paymentId,
      tenantId,
      citizenSubject: principal.subject,
      bookingReservationId: row.id,
      feeCode: BOOKING_PAYMENT_FEE_CODE,
      amountPaise: rentDuePaise,
      method: dto.method,
      gateway: gatewayResult.gateway,
      gatewayOrderId: gatewayResult.gatewayOrderId,
      redirectUrl: gatewayResult.redirectUrl,
      idempotencyKey: normalizedKey,
      requestFingerprint: fingerprint,
      expiresAt: this.nextDay(),
    });

    return this.toHoldPaymentResponse(row.id, deposit.id, payment, amounts, true);
  }

  private async requireDepositForReservation(tenantId: string, reservationId: string) {
    const reservation = await this.prisma.bookingReservation.findFirst({
      where: { id: reservationId, tenantId },
      select: { depositId: true },
    });
    if (!reservation?.depositId) {
      throw new BadRequestException('Booking deposit is not prepared for this hold');
    }
    return this.prisma.deposit.findUniqueOrThrow({ where: { id: reservation.depositId } });
  }

  private toHoldPaymentResponse(
    holdId: string,
    depositId: string,
    payment: PaymentResponse,
    amounts: { rent_paise: number; deposit_paise: number },
    includeRent: boolean,
  ): BookingHoldPaymentResponse {
    return {
      hold_id: holdId,
      deposit_id: depositId,
      payment,
      amount_paise: payment.amount_paise,
      deposit_paise: amounts.deposit_paise,
      rent_paise: amounts.rent_paise,
      include_rent: includeRent,
    };
  }

  private fingerprint(
    holdId: string,
    amountPaise: number,
    method: PaymentMethod,
    includeRent: boolean,
  ): string {
    return createHash('sha256')
      .update(`${holdId}:${amountPaise}:${method}:${includeRent ? 'rent' : 'deposit-only'}`)
      .digest('hex');
  }

  private nextDay(): Date {
    const expires = new Date();
    expires.setUTCDate(expires.getUTCDate() + 1);
    return expires;
  }

  async ledgerContextForBooking(tenantCode: string): Promise<{
    serviceCode: string;
    revenueHeadCode: string;
    accountingCode: string;
  }> {
    const service = await this.services.getTenantService(tenantCode, 'community-hall');
    const ledger = this.services.resolveLedgerCodesForService(service);
    return {
      serviceCode: service.code,
      revenueHeadCode: ledger.revenue_head_code,
      accountingCode: ledger.accounting_code,
    };
  }
}
