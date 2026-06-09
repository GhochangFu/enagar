'use client';

import { Button, FieldLabel, SelectField, TextField, useToast } from '@enagar/ui';
import { useState } from 'react';

import { useTenantAdminSession } from './tenant-admin-session';

type LeaseInvoice = {
  id: string;
  invoiceNo: string;
  amountPaise: number;
  lateFeePaise: number;
  status: 'PENDING' | 'OVERDUE' | 'PAID' | 'WAIVED';
  dueDate: string;
};

const METHOD_OPTIONS = [
  { value: 'CASH_AT_DESK', label: 'Cash at desk' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer (NEFT/RTGS)' },
  { value: 'CHEQUE', label: 'Cheque / DD' },
  { value: 'ONLINE_GATEWAY', label: 'Online gateway (citizen will pay)' },
];

export function RecordRentPaymentModal({
  invoice,
  onClose,
  onRecorded,
}: {
  invoice: LeaseInvoice | null;
  onClose: () => void;
  onRecorded: () => void;
}): JSX.Element | null {
  const { token, apiBase } = useTenantAdminSession();
  const { toast } = useToast();
  const [method, setMethod] = useState<(typeof METHOD_OPTIONS)[number]['value']>('CASH_AT_DESK');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!invoice) return null;
  const total = invoice.amountPaise + invoice.lateFeePaise;
  const requiresRef = method === 'BANK_TRANSFER' || method === 'CHEQUE';

  const handleSubmit = async () => {
    if (requiresRef && !referenceNumber.trim()) {
      toast('Reference number is required for this method.', 'danger');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/lease-invoices/${invoice.id}/pay`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          method,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        toast('Session expired — please sign in again.', 'danger');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        toast(msg || 'Could not record payment.', 'danger');
        return;
      }
      const data = await res.json();
      if (method === 'ONLINE_GATEWAY') {
        window.location.assign(data.redirectUrl);
        return;
      }
      toast(`Payment recorded. Receipt #${data.receipt?.receiptNumber ?? 'generated'}.`, 'success');
      onRecorded();
      onClose();
    } catch (err) {
      console.error(err);
      toast('Could not reach the API.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-warm-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-ink-muted hover:bg-canvas"
        >
          ✕
        </button>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          Record Payment
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink-primary">{invoice.invoiceNo}</h2>
        <dl className="mt-4 space-y-1 rounded-xl border border-warm-border bg-canvas/40 p-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-secondary">Base rent</dt>
            <dd className="font-semibold">
              ₹{(invoice.amountPaise / 100).toLocaleString('en-IN')}
            </dd>
          </div>
          {invoice.lateFeePaise > 0 ? (
            <div className="flex justify-between">
              <dt className="text-ink-secondary">Late fee</dt>
              <dd className="font-semibold text-danger">
                ₹{(invoice.lateFeePaise / 100).toLocaleString('en-IN')}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-warm-border pt-1">
            <dt className="font-semibold">Total</dt>
            <dd className="font-bold">₹{(total / 100).toLocaleString('en-IN')}</dd>
          </div>
        </dl>
        <div className="mt-4 space-y-3">
          <div>
            <FieldLabel htmlFor="method">Method</FieldLabel>
            <SelectField
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
            >
              {METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </SelectField>
          </div>
          {requiresRef ? (
            <div>
              <FieldLabel htmlFor="ref">Reference number *</FieldLabel>
              <TextField
                id="ref"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g., NEFT-2026-0001"
              />
            </div>
          ) : null}
          <div>
            <FieldLabel htmlFor="notes">Notes (optional)</FieldLabel>
            <TextField
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lessor name, ID, remarks…"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isSubmitting}>
            {method === 'ONLINE_GATEWAY' ? 'Generate payment link' : 'Record payment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
