'use client';

import {
  Badge,
  Card,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableElement,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  KpiCard,
} from '@enagar/ui';
import Link from 'next/link';

import type { Route } from 'next';

export type BookingSummaryResponse = {
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

const ASSET_TYPE_LABELS: Record<string, string> = {
  AMBULANCE: 'Ambulance',
  HEARSE: 'Hearse',
  HALL: 'Halls',
  LED_BOARD: 'LED',
  PARKING_ZONE: 'Parking',
};

function assetTypeLabel(assetType: string): string {
  const key = assetType.trim().toUpperCase();
  return ASSET_TYPE_LABELS[key] ?? key;
}

function serviceLabel(serviceCode: string | null, assetType: string): string {
  if (serviceCode?.trim()) {
    return serviceCode.trim();
  }
  return assetTypeLabel(assetType);
}

function formatSlotIst(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
  });
  const timeFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)} – ${timeFmt.format(end)} IST`;
}

function statusLabel(status: string): string {
  const trimmed = status.trim();
  if (!trimmed) {
    return '—';
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function assetTypeCount(
  summary: BookingSummaryResponse,
  assetType: string,
): number {
  const row = summary.by_asset_type.find(
    (entry) => entry.asset_type.toUpperCase() === assetType.toUpperCase(),
  );
  if (!row) {
    return 0;
  }
  return row.confirmed + row.holds;
}

export function BookingSummaryPanel({
  summary,
}: {
  summary: BookingSummaryResponse | null;
}): JSX.Element {
  if (!summary) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-ink-primary">Booking Summary</h2>
        <p className="mt-2 text-sm text-ink-secondary">Loading booking summary…</p>
      </Card>
    );
  }

  const operationsHref = (bookingId: string): Route =>
    `/dashboard/operations?section=bookings&booking=${encodeURIComponent(bookingId)}` as Route;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary">Booking Summary</h2>
          <p className="text-sm text-ink-secondary">
            All bookable assets — last {summary.period_days} days by slot start.
          </p>
        </div>
        <Link
          className="text-sm font-semibold text-brand hover:underline"
          href="/dashboard/operations?section=bookings"
        >
          Open Operations →
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label={`Confirmed (${summary.period_days}d)`} value={summary.totals.confirmed} />
        <KpiCard label="Active holds" value={summary.totals.holds} />
        <KpiCard label="Ambulance" value={assetTypeCount(summary, 'AMBULANCE')} />
        <KpiCard label="Hearse" value={assetTypeCount(summary, 'HEARSE')} />
        <KpiCard label="Halls" value={assetTypeCount(summary, 'HALL')} />
        <KpiCard label="LED" value={assetTypeCount(summary, 'LED_BOARD')} />
      </section>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-ink-primary">Recent bookings</h3>
        <DataTable className="mt-3">
          <DataTableElement>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Booking no</DataTableHeaderCell>
                <DataTableHeaderCell>Service</DataTableHeaderCell>
                <DataTableHeaderCell>Asset</DataTableHeaderCell>
                <DataTableHeaderCell>Slot</DataTableHeaderCell>
                <DataTableHeaderCell>Status</DataTableHeaderCell>
                <DataTableHeaderCell>Holder</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {summary.recent.length ? (
                summary.recent.map((row) => (
                  <DataTableRow key={row.id}>
                    <DataTableCell>
                      <Link
                        className="font-mono text-sm font-semibold text-brand hover:underline"
                        href={operationsHref(row.id)}
                      >
                        {row.booking_no ?? row.id.slice(0, 8)}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{serviceLabel(row.service_code, row.asset_type)}</span>
                        {row.emergency ? <Badge tone="warning">Emergency</Badge> : null}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="font-mono text-xs">{row.asset_code}</span>
                    </DataTableCell>
                    <DataTableCell className="text-sm">
                      {formatSlotIst(row.starts_at, row.ends_at)}
                    </DataTableCell>
                    <DataTableCell>{statusLabel(row.status)}</DataTableCell>
                    <DataTableCell>{row.holder_name}</DataTableCell>
                  </DataTableRow>
                ))
              ) : (
                <DataTableRow>
                  <DataTableCell colSpan={6}>
                    <span className="text-sm text-ink-secondary">No bookings yet.</span>
                  </DataTableCell>
                </DataTableRow>
              )}
            </DataTableBody>
          </DataTableElement>
        </DataTable>
      </div>
    </Card>
  );
}
