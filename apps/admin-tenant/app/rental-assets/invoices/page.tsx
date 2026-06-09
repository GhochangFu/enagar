'use client';

import {
  Badge,
  Button,
  Card,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  KpiCard,
  PageHeader,
  SegmentedControl,
  ToastProvider,
  useToast,
} from '@enagar/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { RecordRentPaymentModal } from '../../../components/record-rent-payment-modal';
import { useTenantAdminSession } from '../../../components/tenant-admin-session';

type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';
type InvoiceRow = {
  id: string;
  invoiceNo: string;
  amountPaise: number;
  lateFeePaise: number;
  status: InvoiceStatus;
  dueDate: string;
  agreement: { id: string; lessorName: string; asset: { name: Record<string, string> } };
  payments: Array<{ id: string }>;
};

const STATUS_TONE: Record<InvoiceStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'success',
  PENDING: 'warning',
  OVERDUE: 'danger',
  WAIVED: 'neutral',
};

function InvoicesContent() {
  const { token, apiBase } = useTenantAdminSession();
  const { toast } = useToast();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'ALL' | InvoiceStatus>('ALL');
  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [runningScheduler, setRunningScheduler] = useState(false);

  const headers = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const qs = status === 'ALL' ? '' : `?status=${status}`;
      const res = await fetch(`${apiBase}/lease-invoices${qs}`, { headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows((await res.json()) as InvoiceRow[]);
    } catch (err) {
      console.error(err);
      toast('Could not load invoices.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [apiBase, headers, status, toast]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  /**
   * Force-run the lease scheduler pipeline on demand. The same code runs
   * nightly at 02:00; this button exists so an operator can re-run it after
   * fixing data or testing smoke flows without waiting until the next day.
   */
  const handleRunScheduler = useCallback(async (): Promise<void> => {
    if (runningScheduler) return;
    const ok = window.confirm(
      'Run the lease scheduler now? It will generate any pending period invoices and flip PENDING invoices past their due date to OVERDUE.',
    );
    if (!ok) return;
    setRunningScheduler(true);
    try {
      const res = await fetch(`${apiBase}/rental-assets/scheduler/run`, {
        method: 'POST',
        headers: headers(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const summary = (await res.json()) as {
        trigger: 'manual' | 'cron';
        invoicesCreated: number;
        flippedToOverdue: number;
        expiringAgreements: number;
      };
      toast(
        `Scheduler complete: created ${summary.invoicesCreated}, flipped ${summary.flippedToOverdue} to OVERDUE, ${summary.expiringAgreements} agreement(s) expiring soon.`,
        'success',
      );
      await fetchInvoices();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast(`Scheduler run failed: ${message}`, 'danger');
    } finally {
      setRunningScheduler(false);
    }
  }, [apiBase, fetchInvoices, headers, runningScheduler, toast]);

  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let billed = 0;
    let collected = 0;
    let outstanding = 0;
    let overdue = 0;
    for (const r of rows) {
      const total = r.amountPaise + r.lateFeePaise;
      if (r.status === 'PAID') {
        collected += total;
        if (new Date(r.dueDate) >= monthStart) billed += total;
      } else if (r.status === 'PENDING' || r.status === 'OVERDUE') {
        outstanding += total;
        if (r.status === 'OVERDUE') overdue += total;
      }
    }
    return { billed, collected, outstanding, overdue };
  }, [rows]);

  const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Rental Invoices"
        description="All rent invoices across active lease agreements."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => void handleRunScheduler()}
              disabled={runningScheduler}
            >
              {runningScheduler ? 'Running…' : 'Run lease scheduler'}
            </Button>
            <Button variant="secondary" onClick={() => void fetchInvoices()}>
              Refresh
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Billed (this month)" value={fmt(kpis.billed)} accent="default" />
        <KpiCard label="Collected" value={fmt(kpis.collected)} accent="success" />
        <KpiCard label="Outstanding" value={fmt(kpis.outstanding)} accent="warning" />
        <KpiCard label="Overdue" value={fmt(kpis.overdue)} accent="danger" />
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="border-b border-warm-border p-4">
          <SegmentedControl
            aria-label="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'OVERDUE', label: 'Overdue' },
              { value: 'PAID', label: 'Paid' },
              { value: 'WAIVED', label: 'Waived' },
            ]}
          />
        </div>
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Invoice</DataTableHeaderCell>
              <DataTableHeaderCell>Asset / Lessor</DataTableHeaderCell>
              <DataTableHeaderCell>Due Date</DataTableHeaderCell>
              <DataTableHeaderCell>Amount</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Actions</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {loading ? (
              <DataTableRow>
                <DataTableCell colSpan={6} className="py-10 text-center text-ink-muted">
                  Loading…
                </DataTableCell>
              </DataTableRow>
            ) : rows.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={6} className="py-10 text-center text-ink-muted">
                  No invoices match the current filter.
                </DataTableCell>
              </DataTableRow>
            ) : (
              rows.map((r) => (
                <DataTableRow key={r.id}>
                  <DataTableCell>
                    <span className="font-mono text-xs">{r.invoiceNo}</span>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold">{r.agreement.asset.name?.en ?? '—'}</span>
                      <span className="text-xs text-ink-muted">{r.agreement.lessorName}</span>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    {new Date(r.dueDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </DataTableCell>
                  <DataTableCell>
                    <span className="font-semibold">{fmt(r.amountPaise + r.lateFeePaise)}</span>
                    {r.lateFeePaise > 0 ? (
                      <span className="ml-1 text-xs text-danger">(incl. late fee)</span>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    {r.status === 'PENDING' || r.status === 'OVERDUE' ? (
                      <Button size="sm" onClick={() => setPaying(r)}>
                        Record Payment
                      </Button>
                    ) : (
                      <span className="text-xs text-ink-muted">—</span>
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </Card>
      <RecordRentPaymentModal
        invoice={paying}
        onClose={() => setPaying(null)}
        onRecorded={() => void fetchInvoices()}
      />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <ToastProvider>
      <InvoicesContent />
    </ToastProvider>
  );
}
