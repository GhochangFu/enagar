import {
  parseBookingReservationNote,
  serviceCodeFromReservationNote,
} from '../bookings/booking-reservation-note.util';

export type TenantAdminBookingSummary = {
  period_days: number;
  totals: {
    confirmed: number;
    holds: number;
    cancelled: number;
  };
  by_asset_type: Array<{ asset_type: string; confirmed: number; holds: number }>;
  by_service_code: Array<{ service_code: string; confirmed: number }>;
  recent: Array<{
    id: string;
    booking_no: string | null;
    asset_code: string;
    asset_type: string;
    service_code: string | null;
    holder_name: string;
    starts_at: string;
    ends_at: string;
    status: string;
    emergency: boolean;
  }>;
};

export type BookingSummaryReservationRow = {
  id: string;
  bookingNo: string | null;
  status: string;
  startsAt: Date;
  endsAt: Date;
  holderName: string;
  note: string | null;
  asset: { code: string; assetType: string };
};

function toRecentRow(row: BookingSummaryReservationRow): TenantAdminBookingSummary['recent'][number] {
  const noteMeta = parseBookingReservationNote(row.note);
  return {
    id: row.id,
    booking_no: row.bookingNo,
    asset_code: row.asset.code,
    asset_type: row.asset.assetType,
    service_code: serviceCodeFromReservationNote(row.note) ?? null,
    holder_name: row.holderName,
    starts_at: row.startsAt.toISOString(),
    ends_at: row.endsAt.toISOString(),
    status: row.status,
    emergency: noteMeta.emergency === true,
  };
}

export function buildTenantBookingSummary(
  periodRows: BookingSummaryReservationRow[],
  recentRows: BookingSummaryReservationRow[],
  periodDays = 30,
): TenantAdminBookingSummary {
  const totals = { confirmed: 0, holds: 0, cancelled: 0 };
  const assetTypeMap = new Map<string, { confirmed: number; holds: number }>();
  const serviceCodeMap = new Map<string, number>();

  for (const row of periodRows) {
    if (row.status === 'confirmed') {
      totals.confirmed += 1;
    } else if (row.status === 'hold') {
      totals.holds += 1;
    } else if (row.status === 'cancelled') {
      totals.cancelled += 1;
    }

    const assetType = row.asset.assetType.trim().toUpperCase() || 'UNKNOWN';
    const bucket = assetTypeMap.get(assetType) ?? { confirmed: 0, holds: 0 };
    if (row.status === 'confirmed') {
      bucket.confirmed += 1;
    } else if (row.status === 'hold') {
      bucket.holds += 1;
    }
    assetTypeMap.set(assetType, bucket);

    if (row.status === 'confirmed') {
      const serviceCode = serviceCodeFromReservationNote(row.note) ?? '_unlinked';
      serviceCodeMap.set(serviceCode, (serviceCodeMap.get(serviceCode) ?? 0) + 1);
    }
  }

  return {
    period_days: periodDays,
    totals,
    by_asset_type: [...assetTypeMap.entries()]
      .map(([asset_type, counts]) => ({ asset_type, ...counts }))
      .sort((a, b) => a.asset_type.localeCompare(b.asset_type)),
    by_service_code: [...serviceCodeMap.entries()]
      .map(([service_code, confirmed]) => ({ service_code, confirmed }))
      .sort((a, b) => b.confirmed - a.confirmed),
    recent: recentRows.map(toRecentRow),
  };
}
