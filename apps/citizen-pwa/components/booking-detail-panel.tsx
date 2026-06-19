'use client';

import { useState } from 'react';

import {
  bookingNoToPdfPathRef,
  downloadBookingConfirmationPdf,
} from '../lib/bookings-api';

import { bookingAmountSummary, formatCitizenBookingSlot } from './my-bookings-panel';

import type { CitizenBookingListItem } from '../lib/bookings-api';
import type { TokenResponse } from '../lib/workspace-types';

function statusLabel(status: string): string {
  const trimmed = status.trim();
  if (!trimmed) {
    return '—';
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function BookingDetailPanel({
  apiBaseUrl,
  booking,
  onBrowseServices,
  onStatus,
  tenantScopeCode,
  token,
}: {
  apiBaseUrl: string;
  booking: CitizenBookingListItem | null;
  onBrowseServices: () => void;
  onStatus?: (message: string) => void;
  tenantScopeCode?: string;
  token: TokenResponse | null;
}): JSX.Element {
  const [downloading, setDownloading] = useState(false);

  if (!booking) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">Booking detail</h3>
        <p className="mt-3 text-sm text-slate-600">
          Select a booking from the list to view slot details and download your receipt.
        </p>
        <button
          className="mt-4 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          onClick={onBrowseServices}
          type="button"
        >
          Browse booking services
        </button>
      </div>
    );
  }

  const slot = formatCitizenBookingSlot(booking.starts_at, booking.ends_at);
  const scope = tenantScopeCode ?? booking.tenant_code;

  async function handleDownloadReceipt(): Promise<void> {
    if (!token || !booking) {
      return;
    }
    const ref = booking.booking_no
      ? bookingNoToPdfPathRef(booking.booking_no)
      : booking.id;
    setDownloading(true);
    try {
      const blob = await downloadBookingConfirmationPdf(apiBaseUrl, token, ref, scope);
      const fileName = `booking-${(booking.booking_no ?? booking.id).replace(/\//g, '-')}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      onStatus?.(`Receipt downloaded — ${booking.booking_no ?? booking.id}`);
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : 'Unable to download receipt');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {booking.tenant_code} · {statusLabel(booking.status)}
      </p>
      <h3 className="mt-2 font-mono text-2xl font-black text-ink-primary">
        {booking.booking_no ?? 'Pending booking no'}
      </h3>
      <p className="mt-2 text-lg font-semibold text-ink-primary">{booking.service_label}</p>

      <dl className="mt-6 space-y-3 text-sm">
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <dt className="text-slate-500">Date</dt>
          <dd className="font-medium text-ink-primary">{slot.date}</dd>
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <dt className="text-slate-500">Time</dt>
          <dd className="font-medium text-ink-primary">{slot.hours}</dd>
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <dt className="text-slate-500">Holder</dt>
          <dd className="font-medium text-ink-primary">{booking.holder_name}</dd>
        </div>
        {booking.pickup_address ? (
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <dt className="text-slate-500">Pickup</dt>
            <dd className="font-medium text-ink-primary">{booking.pickup_address}</dd>
          </div>
        ) : null}
        {booking.emergency ? (
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <dt className="text-slate-500">Emergency</dt>
            <dd className="font-medium text-ink-primary">Yes — no rent charged</dd>
          </div>
        ) : null}
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <dt className="text-slate-500">Amounts</dt>
          <dd className="font-medium text-ink-primary">{bookingAmountSummary(booking)}</dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap gap-3">
        {booking.can_download_receipt && token ? (
          <button
            className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={downloading}
            onClick={() => void handleDownloadReceipt()}
            type="button"
          >
            {downloading ? 'Downloading…' : 'Download receipt'}
          </button>
        ) : (
          <p className="text-sm text-slate-600">
            Receipt is available after the booking is confirmed with a booking number.
          </p>
        )}
      </div>
    </div>
  );
}
