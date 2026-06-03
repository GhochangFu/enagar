import { computeBookingAmounts } from './bookings-payment.util';
import { parseBookingWindow } from './bookings-time.util';

import type { PrismaService } from '../../common/database/prisma.service';
import type { FeeSettlementSnapshot } from '../payments/fee-settlement.util';

export type BookingChargeLineStatus = 'not_required' | 'pending' | 'paid' | 'failed';

export type BookingChargesSummary = {
  application_fee_paise: number;
  hall_rent_paise: number;
  security_deposit_paise: number;
  upfront_total_paise: number;
  upfront_paid_paise: number;
  application_fee_status: BookingChargeLineStatus;
  hall_rent_status: BookingChargeLineStatus;
  security_deposit_status: BookingChargeLineStatus;
  slot_summary: string | null;
  /** Linked hold/reservation — used to surface booking-scoped payments on the application. */
  reservation_id: string | null;
};

function readPaiseFromForm(formData: Record<string, unknown>, key: string): number | null {
  const value = formData[key];
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function hasBookingFormMarkers(formData: Record<string, unknown>): boolean {
  return (
    typeof formData.booking_starts_at === 'string' &&
    typeof formData.booking_ends_at === 'string' &&
    typeof formData.bookable_asset_code === 'string'
  );
}

function formatSlotSummary(startsAt: Date, endsAt: Date): string {
  const dateFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateFmt.format(startsAt)} · ${timeFmt.format(startsAt)} – ${timeFmt.format(endsAt)} IST`;
}

function linePaidPaise(status: BookingChargeLineStatus, amount: number): number {
  return status === 'paid' ? amount : 0;
}

export async function resolveBookingChargesSummary(
  prisma: PrismaService,
  tenantId: string,
  applicationId: string,
  formData: Record<string, unknown>,
  feeSettlement: FeeSettlementSnapshot,
): Promise<BookingChargesSummary | null> {
  if (!hasBookingFormMarkers(formData)) {
    return null;
  }

  let hallRentPaise = readPaiseFromForm(formData, 'booking_rent_paise') ?? 0;
  let securityDepositPaise = readPaiseFromForm(formData, 'booking_deposit_paise') ?? 0;
  let applicationFeePaise = readPaiseFromForm(formData, 'booking_application_fee_paise') ?? 0;
  let slotSummary: string | null = null;

  const reservation = await prisma.bookingReservation.findFirst({
    where: { tenantId, applicationId },
    include: { asset: true, deposit: true },
  });

  if (reservation) {
    const amounts = computeBookingAmounts(
      reservation.asset,
      reservation.startsAt,
      reservation.endsAt,
    );
    hallRentPaise = amounts.rent_paise;
    securityDepositPaise = amounts.deposit_paise;
    slotSummary = formatSlotSummary(reservation.startsAt, reservation.endsAt);
  } else if (
    typeof formData.booking_starts_at === 'string' &&
    typeof formData.booking_ends_at === 'string'
  ) {
    try {
      const { startsAt, endsAt } = parseBookingWindow(
        formData.booking_starts_at,
        formData.booking_ends_at,
      );
      slotSummary = formatSlotSummary(startsAt, endsAt);
      const assetCode =
        typeof formData.bookable_asset_code === 'string' ? formData.bookable_asset_code : null;
      if (assetCode) {
        const asset = await prisma.bookableAsset.findFirst({
          where: { tenantId, code: assetCode, isActive: true },
        });
        if (asset) {
          const amounts = computeBookingAmounts(asset, startsAt, endsAt);
          hallRentPaise = amounts.rent_paise;
          securityDepositPaise = amounts.deposit_paise;
        }
      }
    } catch {
      // Keep form_data fallbacks when slot parsing fails.
    }
  }

  if (applicationFeePaise <= 0) {
    const preview = feeSettlement.application?.amount_paise;
    applicationFeePaise = typeof preview === 'number' && preview > 0 ? preview : 0;
  }

  const applicationFeeStatus: BookingChargeLineStatus =
    feeSettlement.application?.status === 'paid'
      ? 'paid'
      : feeSettlement.application?.status === 'failed'
        ? 'failed'
        : applicationFeePaise > 0
          ? 'pending'
          : 'not_required';

  let securityDepositStatus: BookingChargeLineStatus =
    securityDepositPaise > 0 ? 'pending' : 'not_required';
  let hallRentStatus: BookingChargeLineStatus = hallRentPaise > 0 ? 'pending' : 'not_required';

  if (reservation?.deposit?.capturePaymentId && reservation.deposit.status === 'held') {
    securityDepositStatus = 'paid';
  }

  if (reservation) {
    const settledPayment = await prisma.payment.findFirst({
      where: {
        tenantId,
        bookingReservationId: reservation.id,
        status: 'settled',
      },
      orderBy: { settledAt: 'desc' },
      select: { amountPaise: true },
    });
    if (settledPayment) {
      if (settledPayment.amountPaise >= securityDepositPaise + hallRentPaise && hallRentPaise > 0) {
        securityDepositStatus = 'paid';
        hallRentStatus = 'paid';
      } else if (settledPayment.amountPaise >= securityDepositPaise) {
        securityDepositStatus = 'paid';
      }
      const depositMeta = reservation.deposit?.metadata as Record<string, unknown> | null;
      if (depositMeta?.include_rent === true && securityDepositStatus === 'paid') {
        hallRentStatus = hallRentPaise > 0 ? 'paid' : 'not_required';
      }
    }
  }

  const upfrontTotalPaise = applicationFeePaise + hallRentPaise + securityDepositPaise;
  const upfrontPaidPaise =
    linePaidPaise(applicationFeeStatus, applicationFeePaise) +
    linePaidPaise(hallRentStatus, hallRentPaise) +
    linePaidPaise(securityDepositStatus, securityDepositPaise);

  return {
    application_fee_paise: applicationFeePaise,
    hall_rent_paise: hallRentPaise,
    security_deposit_paise: securityDepositPaise,
    upfront_total_paise: upfrontTotalPaise,
    upfront_paid_paise: upfrontPaidPaise,
    application_fee_status: applicationFeeStatus,
    hall_rent_status: hallRentStatus,
    security_deposit_status: securityDepositStatus,
    slot_summary: slotSummary,
    reservation_id: reservation?.id ?? null,
  };
}
