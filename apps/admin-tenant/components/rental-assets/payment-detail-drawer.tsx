import { Badge, Button, Icon } from '@enagar/ui';

import { DataRow } from './data-row';
import { IconHeader } from './icon-header';
import { ModalShell } from './modal-shell';
import {
  formatDate,
  formatDateTime,
  formatINR,
  INVOICE_STATUS_TONE,
  isPaymentSettled,
  paymentMethodLabel,
  type InvoiceRow,
  type LeasePayment,
} from './types';

/**
 * Right-side detail drawer for an invoice. Shows the agreement context on
 * the left and the full payment history on the right, so an operator can
 * answer "what did this lessor actually pay, when, and by which method"
 * without leaving the ledger.
 *
 * Uses `ModalShell` with the `lg` size so it reads as a panel rather than
 * a centered dialog; the overlay still traps the click-outside-to-close
 * behaviour for consistency with the rest of the page.
 */
export function PaymentDetailDrawer({
  invoice,
  onClose,
  onRecordPayment,
}: {
  invoice: InvoiceRow | null;
  onClose: () => void;
  onRecordPayment: (inv: InvoiceRow) => void;
}): JSX.Element | null {
  if (!invoice) return null;

  const total = invoice.amountPaise + invoice.lateFeePaise;
  const settledPayments = invoice.payments.filter((p) => isPaymentSettled(p));
  const totalSettled = settledPayments.reduce((acc, p) => acc + p.amountPaise, 0);
  const balance = Math.max(0, total - totalSettled);
  const latestReceipt = invoice.receipts?.[0];

  return (
    <ModalShell onClose={onClose} labelledBy="invoice-detail-title" size="lg" z="z-[60]">
      <IconHeader
        icon="receipt"
        eyebrow="Invoice"
        title={invoice.invoiceNo}
        trailing={<Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{invoice.status}</Badge>}
      />

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-secondary">
            Agreement
          </p>
          <div className="divide-y divide-warm-border rounded-xl border border-warm-border bg-canvas/40 p-4">
            <DataRow
              icon="building"
              label="Asset"
              value={invoice.agreement.asset.name?.en ?? '—'}
            />
            <DataRow icon="user" label="Lessor" value={invoice.agreement.lessorName} />
            {invoice.agreement.lessorPhone ? (
              <DataRow icon="phone" label="Phone" value={invoice.agreement.lessorPhone} mono />
            ) : null}
            <DataRow icon="calendar" label="Due Date" value={formatDate(invoice.dueDate)} />
            <DataRow icon="wallet" label="Amount" value={formatINR(total)} />
            {invoice.lateFeePaise > 0 ? (
              <DataRow
                icon="alert-circle"
                label="Late Fee"
                value={formatINR(invoice.lateFeePaise)}
                tone="danger"
              />
            ) : null}
            {latestReceipt ? (
              <DataRow
                icon="file-text"
                label="Receipt #"
                value={latestReceipt.receiptNumber}
                mono
              />
            ) : null}
          </div>

          {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && balance > 0 ? (
            <Button
              className="mt-4 w-full"
              icon="credit-card"
              onClick={() => onRecordPayment(invoice)}
            >
              Record payment · {formatINR(balance)}
            </Button>
          ) : null}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-secondary">
              Payment history
            </p>
            <span className="text-xs text-ink-muted">
              {invoice.payments.length} entr{invoice.payments.length === 1 ? 'y' : 'ies'}
            </span>
          </div>
          {invoice.payments.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-warm-border p-4 text-sm text-ink-muted">
              <Icon name="inbox" size={16} /> No payment attempts yet.
            </div>
          ) : (
            <ol className="space-y-2">
              {invoice.payments.map((p, idx) => (
                <PaymentTimelineItem key={p.id} payment={p} isLatest={idx === 0} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </ModalShell>
  );
}

function PaymentTimelineItem({
  payment,
  isLatest,
}: {
  payment: LeasePayment;
  isLatest: boolean;
}): JSX.Element {
  const isSettled = isPaymentSettled(payment);
  return (
    <li className="flex gap-3 rounded-xl border border-warm-border bg-surface p-3">
      <div
        className={[
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isSettled ? 'bg-success/10 text-success' : 'bg-canvas text-ink-secondary',
        ].join(' ')}
        aria-hidden
      >
        <Icon name={isSettled ? 'check-circle' : 'clock'} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-ink-primary">{formatINR(payment.amountPaise)}</p>
          <span className="text-xs text-ink-muted">·</span>
          <p className="text-sm text-ink-secondary">{paymentMethodLabel(payment.method)}</p>
          {isLatest ? (
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
              Latest
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
          <Icon name="calendar" size={11} />{' '}
          {formatDateTime(payment.settledAt ?? payment.createdAt)}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Gateway: {payment.gateway} · {payment.status}
        </p>
      </div>
    </li>
  );
}
