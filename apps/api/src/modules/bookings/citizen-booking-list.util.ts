import type { Prisma } from '../../generated/prisma';

import {
  parseBookingReservationNote,
  serviceCodeFromReservationNote,
} from './booking-reservation-note.util';
import { computeBookingAmounts } from './bookings-payment.util';
import { pickupAddressFromReservationNote, jsonLabel } from './bookings-pdf.util';
import { isHealthFleetServiceCode, readBplSubsidyPaise } from './health-fleet.util';

export type CitizenBookingListItem = {
  id: string;
  booking_no: string | null;
  tenant_code: string;
  service_code: string | null;
  service_label: string;
  asset_type: string;
  status: string;
  starts_at: string;
  ends_at: string;
  holder_name: string;
  rent_paise: number;
  deposit_paise: number;
  emergency: boolean;
  pickup_address: string | null;
  can_download_receipt: boolean;
};

const FALLBACK_BY_ASSET_TYPE: Record<string, string> = {
  HALL: 'Community hall',
  LED_BOARD: 'LED board',
  AMBULANCE: 'Municipal ambulance',
  HEARSE: 'Hearse van',
  PARKING_ZONE: 'Smart parking',
};

const FALLBACK_BY_SERVICE_CODE: Record<string, string> = {
  ambulance: 'Municipal ambulance',
  hearse: 'Hearse van',
  'community-hall': 'Community hall',
  'ad-led': 'LED board',
  'smart-parking': 'Smart parking',
};

export function bookingServiceLabel(
  serviceCode: string | undefined,
  assetType: string,
  serviceNameByKey?: Map<string, string>,
  tenantServiceKey?: string,
): string {
  if (serviceCode) {
    const fromCatalogue = tenantServiceKey
      ? serviceNameByKey?.get(tenantServiceKey)
      : undefined;
    if (fromCatalogue) {
      return fromCatalogue;
    }
    const fallback = FALLBACK_BY_SERVICE_CODE[serviceCode.trim().toLowerCase()];
    if (fallback) {
      return fallback;
    }
  }
  return FALLBACK_BY_ASSET_TYPE[assetType.trim().toUpperCase()] ?? 'Municipal booking';
}

export function resolveCitizenBookingRentPaise(
  note: string | null,
  asset: {
    rateUnit: string;
    baseRatePaise: number;
    securityDepositPaise: number;
    rules: Prisma.JsonValue;
  },
  startsAt: Date,
  endsAt: Date,
): number {
  const parsed = parseBookingReservationNote(note);
  if (parsed.emergency) {
    return 0;
  }
  if (typeof parsed.rent_paise_override === 'number' && parsed.rent_paise_override >= 0) {
    return parsed.rent_paise_override;
  }
  const amounts = computeBookingAmounts(asset, startsAt, endsAt);
  const serviceCode = parsed.service_code;
  if (isHealthFleetServiceCode(serviceCode) && parsed.bpl_declared) {
    const subsidy = readBplSubsidyPaise(asset.rules);
    return Math.max(0, amounts.rent_paise - subsidy);
  }
  return amounts.rent_paise;
}

export function resolveCitizenBookingDepositPaise(
  asset: {
    rateUnit: string;
    baseRatePaise: number;
    securityDepositPaise: number;
  },
  startsAt: Date,
  endsAt: Date,
): number {
  return computeBookingAmounts(asset, startsAt, endsAt).deposit_paise;
}

export type CitizenBookingListRow = {
  id: string;
  bookingNo: string | null;
  status: string;
  startsAt: Date;
  endsAt: Date;
  holderName: string;
  note: string | null;
  tenantId: string;
  tenant: { code: string };
  asset: {
    assetType: string;
    rateUnit: string;
    baseRatePaise: number;
    securityDepositPaise: number;
    rules: Prisma.JsonValue;
    code: string;
  };
};

export function toCitizenBookingListItem(
  row: CitizenBookingListRow,
  serviceNameByKey: Map<string, string>,
): CitizenBookingListItem {
  const serviceCode = serviceCodeFromReservationNote(row.note) ?? null;
  const noteMeta = parseBookingReservationNote(row.note);
  const tenantServiceKey =
    serviceCode && row.tenantId ? `${row.tenantId}:${serviceCode}` : undefined;

  return {
    id: row.id,
    booking_no: row.bookingNo,
    tenant_code: row.tenant.code,
    service_code: serviceCode,
    service_label: bookingServiceLabel(
      serviceCode ?? undefined,
      row.asset.assetType,
      serviceNameByKey,
      tenantServiceKey,
    ),
    asset_type: row.asset.assetType,
    status: row.status,
    starts_at: row.startsAt.toISOString(),
    ends_at: row.endsAt.toISOString(),
    holder_name: row.holderName,
    rent_paise: resolveCitizenBookingRentPaise(row.note, row.asset, row.startsAt, row.endsAt),
    deposit_paise: resolveCitizenBookingDepositPaise(row.asset, row.startsAt, row.endsAt),
    emergency: noteMeta.emergency === true,
    pickup_address: pickupAddressFromReservationNote(row.note) ?? null,
    can_download_receipt: row.status === 'confirmed' && Boolean(row.bookingNo?.trim()),
  };
}

export function buildServiceLabelMap(
  services: Array<{ tenantId: string; code: string; name: Prisma.JsonValue }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const service of services) {
    map.set(`${service.tenantId}:${service.code}`, jsonLabel(service.name));
  }
  return map;
}
