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
  Icon,
  KpiCard,
  PageHeader,
  PaginationBar,
  SegmentedControl,
  ToastProvider,
  useClientPagination,
  useToast,
} from '@enagar/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { RecordRentPaymentModal } from '../../../components/record-rent-payment-modal';
import { PaymentDetailDrawer } from '../../../components/rental-assets/payment-detail-drawer';
import {
  formatDate,
  formatINR,
  INVOICE_STATUS_TONE,
  isPaymentSettled,
  paymentMethodLabel,
  type InvoiceRow,
  type InvoiceStatus,
} from '../../../components/rental-assets/types';
import { useTenantAdminSession } from '../../../components/tenant-admin-session';

function InvoicesContent() {
  const { token, apiBase } = useTenantAdminSession();
  const { toast } = useToast();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'ALL' | InvoiceStatus>('ALL');
  const [assetId, setAssetId] = useState<string>('');
  const [lessorName, setLessorName] = useState<string>('');
  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [detail, setDetail] = useState<InvoiceRow | null>(null);
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
      const params = new URLSearchParams();
      if (status !== 'ALL') params.set('status', status);
      if (assetId) params.set('assetId', assetId);
      if (lessorName) params.set('lessorName', lessorName);
      const qs = params.toString();
      const res = await fetch(`${apiBase}/lease-invoices${qs ? `?${qs}` : ''}`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows((await res.json()) as InvoiceRow[]);
    } catch (err) {
      console.error(err);
      toast('Could not load invoices.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [apiBase, assetId, headers, lessorName, status, toast]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  // Derive distinct assets + lessors from the *currently-loaded* invoice list
  // so the dropdown options don't shrink when one of the filters is applied.
  const { assetOptions, lessorOptions } = useMemo(() => {
    const assetMap = new Map<string, string>();
    const lessorSet = new Set<string>();
    for (const r of rows) {
      const id = r.agreement?.asset?.id;
      const nameEn = r.agreement?.asset?.name?.en;
      if (id && nameEn && !assetMap.has(id)) {
        assetMap.set(id, nameEn);
      }
      if (r.agreement?.lessorName) {
        lessorSet.add(r.agreement.lessorName);
      }
    }
    return {
      assetOptions: Array.from(assetMap.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      lessorOptions: Array.from(lessorSet).sort((a, b) => a.localeCompare(b)),
    };
  }, [rows]);

  const invoicesPagination = useClientPagination(rows, { pageSize: 25 });

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
    let paidCount = 0;
    for (const r of rows) {
      const total = r.amountPaise + r.lateFeePaise;
      if (r.status === 'PAID') {
        collected += total;
        paidCount += 1;
        if (new Date(r.dueDate) >= monthStart) billed += total;
      } else if (r.status === 'PENDING' || r.status === 'OVERDUE') {
        outstanding += total;
        if (r.status === 'OVERDUE') overdue += total;
      }
    }
    return { billed, collected, outstanding, overdue, paidCount };
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Rental Invoices"
        description="All rent invoices across active lease agreements — see who paid, when, and how."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon="refresh"
              onClick={() => void handleRunScheduler()}
              disabled={runningScheduler}
            >
              {runningScheduler ? 'Running…' : 'Run lease scheduler'}
            </Button>
            <Button variant="secondary" icon="refresh" onClick={() => void fetchInvoices()}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Billed (this month)" value={formatINR(kpis.billed)} accent="default" />
        <KpiCard
          label={`Collected · ${kpis.paidCount} paid`}
          value={formatINR(kpis.collected)}
          accent="success"
        />
        <KpiCard label="Outstanding" value={formatINR(kpis.outstanding)} accent="warning" />
        <KpiCard label="Overdue" value={formatINR(kpis.overdue)} accent="danger" />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-warm-border p-4 md:flex-row md:items-center md:flex-wrap">
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
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
            <label
              htmlFor="filter-asset"
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary"
            >
              <Icon name="building" size={11} /> Asset
            </label>
            <div className="relative">
              <select
                id="filter-asset"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="rounded-lg border border-warm-border bg-surface px-3 py-2 text-sm font-medium text-ink-primary focus:border-brand focus:outline-none"
              >
                <option value="">All assets</option>
                {assetOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
            <label
              htmlFor="filter-lessor"
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary"
            >
              <Icon name="user" size={11} /> Lessor
            </label>
            <div className="relative">
              <select
                id="filter-lessor"
                value={lessorName}
                onChange={(e) => setLessorName(e.target.value)}
                className="rounded-lg border border-warm-border bg-surface px-3 py-2 text-sm font-medium text-ink-primary focus:border-brand focus:outline-none"
              >
                <option value="">All lessors</option>
                {lessorOptions.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(assetId || lessorName) && (
            <Button
              variant="ghost"
              size="sm"
              icon="close"
              onClick={() => {
                setAssetId('');
                setLessorName('');
              }}
            >
              Clear asset/lessor
            </Button>
          )}
        </div>

        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Invoice</DataTableHeaderCell>
              <DataTableHeaderCell>Asset / Lessor</DataTableHeaderCell>
              <DataTableHeaderCell>Due</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Amount</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Paid · Method · Date</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Actions</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {loading ? (
              <DataTableRow>
                <DataTableCell colSpan={7} className="py-10 text-center text-ink-muted">
                  <div className="flex items-center justify-center gap-2">
                    <Icon name="refresh" size={14} className="animate-spin" />
                    Loading…
                  </div>
                </DataTableCell>
              </DataTableRow>
            ) : rows.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={7} className="py-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-ink-muted">
                      <Icon name="inbox" size={20} />
                    </div>
                    <p className="text-sm font-medium text-ink-primary">
                      No invoices match the current filter
                    </p>
                    <p className="text-xs text-ink-muted">
                      Try changing the status, asset, or lessor filter — or run the lease scheduler
                      to generate the next period.
                    </p>
                  </div>
                </DataTableCell>
              </DataTableRow>
            ) : (
              invoicesPagination.pageItems.map((r) => {
                const latestPaid = r.payments.find((p) => isPaymentSettled(p)) ?? null;
                const total = r.amountPaise + r.lateFeePaise;
                const isPayable = r.status === 'PENDING' || r.status === 'OVERDUE';
                return (
                  <DataTableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-canvas/60"
                    onClick={() => setDetail(r)}
                  >
                    <DataTableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-canvas text-ink-secondary">
                          <Icon name="receipt" size={12} />
                        </span>
                        <span className="font-mono text-xs">{r.invoiceNo}</span>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-ink-primary">
                          {r.agreement.asset.name?.en ?? '—'}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                          <Icon name="user" size={10} /> {r.agreement.lessorName}
                        </span>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="inline-flex items-center gap-1 text-sm text-ink-secondary">
                        <Icon name="calendar" size={11} /> {formatDate(r.dueDate)}
                      </span>
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold tabular-nums text-ink-primary">
                          {formatINR(total)}
                        </span>
                        {r.lateFeePaise > 0 ? (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-danger">
                            incl. late fee
                          </span>
                        ) : null}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge tone={INVOICE_STATUS_TONE[r.status]}>{r.status}</Badge>
                    </DataTableCell>
                    <DataTableCell>
                      {latestPaid ? (
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="inline-flex items-center gap-1 font-semibold text-success">
                            <Icon name="check-circle" size={12} />
                            {paymentMethodLabel(latestPaid.method)} ·{' '}
                            {formatINR(latestPaid.amountPaise)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-ink-muted">
                            <Icon name="clock" size={10} />
                            {formatDate(latestPaid.settledAt ?? latestPaid.createdAt)}
                          </span>
                          {r.payments.length > 1 ? (
                            <span className="text-[10px] text-ink-muted">
                              +{r.payments.length - 1} more payment
                              {r.payments.length - 1 === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                          <Icon name="clock" size={11} /> Unpaid
                        </span>
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      {isPayable ? (
                        <Button
                          size="sm"
                          icon="credit-card"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaying(r);
                          }}
                        >
                          Record
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="eye"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetail(r);
                          }}
                        >
                          View
                        </Button>
                      )}
                    </DataTableCell>
                  </DataTableRow>
                );
              })
            )}
          </DataTableBody>
        </DataTable>

        {!loading && rows.length > 0 ? (
          <PaginationBar
            page={invoicesPagination.page}
            totalPages={invoicesPagination.totalPages}
            totalItems={invoicesPagination.totalItems}
            pageSize={invoicesPagination.pageSize}
            onPageChange={invoicesPagination.setPage}
            onPageSizeChange={invoicesPagination.setPageSize}
          />
        ) : null}
      </Card>

      <PaymentDetailDrawer
        invoice={detail}
        onClose={() => setDetail(null)}
        onRecordPayment={(inv) => {
          setDetail(null);
          setPaying(inv);
        }}
      />
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
