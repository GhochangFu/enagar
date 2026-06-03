'use client';

import { useState } from 'react';

import { bookingNoToPdfPathRef, downloadBookingConfirmationPdf } from '../lib/bookings-api';

import type { TokenResponse } from '../lib/workspace-types';

type BookingConfirmationPanelProps = {
  apiBaseUrl: string;
  token: TokenResponse;
  tenantScopeCode: string;
  bookingNo: string;
  /** Optional reservation id; used for download when booking_no contains slashes. */
  reservationId?: string;
};

/**
 * Post-confirm UI (Sprint 8.1D). Wire into the booking flow in 8.1E.
 */
export function BookingConfirmationPanel({
  apiBaseUrl,
  token,
  tenantScopeCode,
  bookingNo,
  reservationId,
}: BookingConfirmationPanelProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onDownload() {
    setBusy(true);
    setStatus(null);
    try {
      const ref = reservationId ?? bookingNoToPdfPathRef(bookingNo);
      const blob = await downloadBookingConfirmationPdf(apiBaseUrl, token, ref, tenantScopeCode);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `booking-${bookingNo.replace(/\//g, '-')}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus('Confirmation downloaded.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Download failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-brand/20 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-brand">Booking confirmed</h2>
      <p className="mt-2 text-sm text-slate-700">
        Booking number: <span className="font-mono font-medium text-slate-900">{bookingNo}</span>
      </p>
      <button
        type="button"
        className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        disabled={busy}
        onClick={() => void onDownload()}
      >
        {busy ? 'Downloading…' : 'Download confirmation'}
      </button>
      {status ? <p className="mt-2 text-sm text-slate-600">{status}</p> : null}
    </section>
  );
}
