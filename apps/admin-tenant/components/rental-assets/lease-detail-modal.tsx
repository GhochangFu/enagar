import { Badge, Button, Icon } from '@enagar/ui';

import { DataRow } from './data-row';
import { IconHeader } from './icon-header';
import { LeaseDocumentPanel, type DocRow } from './lease-document-panel';
import { ModalShell } from './modal-shell';
import {
  formatDate,
  formatINR,
  INVOICE_STATUS_TONE,
  type LeaseAgreement,
  type LeaseInvoice,
} from './types';

export function LeaseDetailModal({
  lease,
  documents,
  onDocumentsChanged,
  onClose,
  onRecordPayment,
}: {
  lease: LeaseAgreement | null;
  documents?: DocRow[];
  onDocumentsChanged: () => void;
  onClose: () => void;
  onRecordPayment: (inv: LeaseInvoice) => void;
}): JSX.Element | null {
  if (!lease) return null;
  return (
    <ModalShell onClose={onClose} labelledBy="lease-detail-title" size="md" z="z-[60]">
      <IconHeader
        icon="file-text"
        eyebrow="Lease Agreement"
        title={lease.lessorName}
        trailing={
          <Badge tone="brand" className="mt-1">
            {lease.status}
          </Badge>
        }
      />
      <div className="mt-5 divide-y divide-warm-border rounded-xl border border-warm-border bg-canvas/40 p-4">
        <DataRow icon="hash" label="Agreement ID" value={lease.id} mono />
        <DataRow icon="file-text" label="Trade License No." value={lease.tradeLicenseNo} mono />
        <DataRow
          icon="phone"
          label="Lessor Phone"
          value={lease.lessorPhone ?? 'Not set — lessor can\u2019t use the citizen portal yet'}
          mono={Boolean(lease.lessorPhone)}
          tone={lease.lessorPhone ? undefined : 'neutral'}
        />
        <DataRow icon="calendar" label="Start Date" value={formatDate(lease.startDate)} />
        <DataRow icon="calendar" label="End Date" value={formatDate(lease.endDate)} />
        <DataRow
          icon="wallet"
          label="Security Deposit"
          value={formatINR(lease.securityDepositPaise)}
        />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-secondary">
            Invoices
          </p>
          <span className="text-xs text-ink-muted">{lease.invoices?.length ?? 0} total</span>
        </div>
        {lease.invoices && lease.invoices.length > 0 ? (
          <ul className="mt-2 divide-y divide-warm-border rounded-xl border border-warm-border">
            {lease.invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-2 p-3 text-sm hover:bg-canvas/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-mono text-xs text-ink-primary">
                    <Icon name="receipt" size={12} /> {inv.invoiceNo}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Due {formatDate(inv.dueDate)} · {formatINR(inv.amountPaise + inv.lateFeePaise)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={INVOICE_STATUS_TONE[inv.status]}>{inv.status}</Badge>
                  {inv.status === 'PENDING' || inv.status === 'OVERDUE' ? (
                    <Button size="sm" icon="credit-card" onClick={() => onRecordPayment(inv)}>
                      Record
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-warm-border p-4 text-sm text-ink-muted">
            <Icon name="inbox" size={16} /> No invoices yet — the lease scheduler will generate the
            first one.
          </div>
        )}
      </div>

      <LeaseDocumentPanel
        agreementId={lease.id}
        documents={documents ?? []}
        onChanged={onDocumentsChanged}
      />

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </ModalShell>
  );
}
