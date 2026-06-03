'use client';

import { formatInrFromPaise } from '../lib/workspace-http';

import type { JSX } from 'react';

export type BookingChargesView = {
  application_fee_paise: number;
  hall_rent_paise: number;
  security_deposit_paise: number;
  upfront_total_paise: number;
  upfront_paid_paise: number;
  application_fee_status: 'not_required' | 'pending' | 'paid' | 'failed';
  hall_rent_status: 'not_required' | 'pending' | 'paid' | 'failed';
  security_deposit_status: 'not_required' | 'pending' | 'paid' | 'failed';
  slot_summary: string | null;
};

function statusLabel(status: string): string {
  if (status === 'paid') {
    return 'paid';
  }
  if (status === 'pending') {
    return 'due';
  }
  if (status === 'failed') {
    return 'failed';
  }
  return '—';
}

function ChargeLine({
  label,
  amountPaise,
  status,
}: {
  label: string;
  amountPaise: number;
  status: string;
}): JSX.Element | null {
  if (amountPaise <= 0 && status === 'not_required') {
    return null;
  }
  return (
    <li>
      <span>{label}</span>: {statusLabel(status)}
      {amountPaise > 0 ? ` · ${formatInrFromPaise(amountPaise)}` : ''}
    </li>
  );
}

/** Community-hall booking fee breakdown (application + hourly rent + deposit). */
export function BookingChargesPanel({
  charges,
  variant = 'citizen',
}: {
  charges: BookingChargesView;
  variant?: 'citizen' | 'desk';
}): JSX.Element {
  const border =
    variant === 'desk' ? 'border-warm-border bg-mint-band/20' : 'border-slate-200 bg-slate-50';
  const allPaid = charges.upfront_paid_paise >= charges.upfront_total_paise;

  return (
    <div className={`rounded-2xl border px-4 py-3 ${border}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        Hall booking charges
      </p>
      {charges.slot_summary ? (
        <p className="mt-1 text-sm text-slate-800">
          Slot: <strong>{charges.slot_summary}</strong>
        </p>
      ) : null}
      <ul className="mt-2 space-y-1 text-sm text-slate-800">
        <ChargeLine
          amountPaise={charges.application_fee_paise}
          label="Application fee"
          status={charges.application_fee_status}
        />
        <ChargeLine
          amountPaise={charges.hall_rent_paise}
          label="Hall rent (slot hours)"
          status={charges.hall_rent_status}
        />
        <ChargeLine
          amountPaise={charges.security_deposit_paise}
          label="Security deposit (refundable)"
          status={charges.security_deposit_status}
        />
      </ul>
      <p className="mt-3 text-sm font-semibold text-slate-900">
        Upfront total: {formatInrFromPaise(charges.upfront_total_paise)}
      </p>
      <p className="text-sm text-slate-700">
        Paid upfront: {formatInrFromPaise(charges.upfront_paid_paise)}
        {!allPaid && charges.upfront_total_paise > charges.upfront_paid_paise ? (
          <span className="text-amber-800">
            {' '}
            · Balance due:{' '}
            {formatInrFromPaise(charges.upfront_total_paise - charges.upfront_paid_paise)}
          </span>
        ) : null}
      </p>
      <p className="mt-2 text-xs text-slate-600">
        All three lines are collected before your slot is held for ULB approval. The application
        rollup above reflects only the municipal application fee line; rent and deposit are settled
        via the booking payment.
      </p>
    </div>
  );
}
