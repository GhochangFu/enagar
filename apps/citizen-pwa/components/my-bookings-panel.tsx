'use client';

import { Badge } from '@enagar/ui';

import { formatInrFromPaise } from '../lib/workspace-http';

import type { CitizenBookingListItem } from '../lib/bookings-api';

export function formatCitizenBookingSlot(
  startsAt: string,
  endsAt: string,
): { date: string; hours: string } {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'long',
  });
  const timeFmt = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return {
    date: dateFmt.format(start),
    hours: `${timeFmt.format(start)} – ${timeFmt.format(end)} IST`,
  };
}

function statusLabel(status: string): string {
  const trimmed = status.trim();
  if (!trimmed) {
    return '—';
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function BookingSummaryCard({
  booking,
  onOpen,
  themeColor,
}: {
  booking: CitizenBookingListItem;
  onOpen: () => void;
  themeColor: string;
}): JSX.Element {
  const slot = formatCitizenBookingSlot(booking.starts_at, booking.ends_at);

  return (
    <button
      className="group relative w-full overflow-hidden rounded-3xl border border-warm-border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      onClick={onOpen}
      type="button"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: themeColor }}
      />
      <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-mint-band px-2.5 py-1 text-[11px] font-black text-forest">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: themeColor }}
        />
        {booking.tenant_code}
      </span>
      <span className="block font-mono text-sm font-black text-ink-primary">
        {booking.booking_no ?? 'Pending booking no'}
      </span>
      <span className="mt-1 block text-sm font-semibold text-ink-primary">{booking.service_label}</span>
      <span className="mt-1 block text-xs text-ink-secondary">{slot.date}</span>
      <span className="block text-xs text-ink-secondary">{slot.hours}</span>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full bg-brand-muted px-2.5 py-1 text-[11px] font-black text-brand">
          {statusLabel(booking.status)}
        </span>
        {booking.emergency ? <Badge tone="warning">Emergency</Badge> : null}
      </div>
    </button>
  );
}

export function MyBookingsPanel({
  bookings,
  emptyHint,
  hubMode,
  onBrowseServices,
  onSelect,
  resolveThemeColor,
  selectedBookingId,
}: {
  bookings: CitizenBookingListItem[];
  emptyHint?: string;
  hubMode?: boolean;
  onBrowseServices: () => void;
  onSelect: (booking: CitizenBookingListItem) => void;
  resolveThemeColor: (tenantCode: string) => string;
  selectedBookingId?: string | null;
}): JSX.Element {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm">
      <h3 className="text-xl font-bold">My Bookings</h3>
      <p className="mt-1 text-xs text-slate-500">
        {hubMode
          ? 'Confirmed slot reservations across municipalities.'
          : 'Confirmed bookings for this municipality.'}
      </p>
      <div className="mt-4 space-y-3">
        {bookings.map((booking) => (
          <div
            className={
              selectedBookingId === booking.id
                ? 'rounded-3xl ring-2 ring-brand/40 ring-offset-2'
                : undefined
            }
            key={booking.id}
          >
            <BookingSummaryCard
              booking={booking}
              onOpen={() => onSelect(booking)}
              themeColor={resolveThemeColor(booking.tenant_code)}
            />
          </div>
        ))}
        {bookings.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-600">
            <p>{emptyHint ?? 'No confirmed bookings yet.'}</p>
            <button
              className="mt-4 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white"
              onClick={onBrowseServices}
              type="button"
            >
              Browse booking services
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function bookingAmountSummary(booking: CitizenBookingListItem): string {
  const total = booking.rent_paise + booking.deposit_paise;
  if (booking.emergency && total === 0) {
    return 'No rent charged (emergency)';
  }
  return `${formatInrFromPaise(booking.rent_paise)} rent · ${formatInrFromPaise(booking.deposit_paise)} deposit`;
}
