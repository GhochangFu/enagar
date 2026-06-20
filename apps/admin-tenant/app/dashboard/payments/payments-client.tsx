'use client';

import {
  Badge,
  Button,
  Card,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableElement,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  PageHeader,
  PaginationBar,
  useClientPagination,
  useToast,
} from '@enagar/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DashboardTrendsChart } from '../../../components/dashboard-trends-chart';
import { FilterChips } from '../../../components/filter-chips';
import {
  PaymentSummaryPanel,
  type PaymentSummaryResponse,
} from '../../../components/payment-summary-panel';
import { SectionNav } from '../../../components/section-nav';
import { useTenantAdminSession } from '../../../components/tenant-admin-session';

import type { Route } from 'next';

type PaymentSource = 'application' | 'booking' | 'rental' | 'ev' | 'water' | '';
type PaymentStatusFilter = '' | 'settled' | 'pending' | 'failed';
type PaymentsTab = 'ledger' | 'by_source' | 'by_service' | 'trends';

type PaymentLedgerRow = {
  id: string;
  amount_paise: number;
  currency: string;
  status: string;
  method: string;
  gateway: string;
  fee_code: string;
  created_at: string;
  settled_at: string | null;
  source: PaymentSource;
  reference: string;
  service_code: string | null;
  citizen_subject: string;
  deep_link: string | null;
};

type BreakdownRow = {
  key: string;
  label: string;
  count: number;
  amount_paise: number;
};

const SOURCE_CHIPS: Array<{ value: PaymentSource; label: string }> = [
  { value: '', label: 'All sources' },
  { value: 'application', label: 'Application' },
  { value: 'booking', label: 'Booking' },
  { value: 'rental', label: 'Rental' },
  { value: 'ev', label: 'EV' },
  { value: 'water', label: 'Water' },
];

const STATUS_CHIPS: Array<{ value: PaymentStatusFilter; label: string }> = [
  { value: '', label: 'All status' },
  { value: 'settled', label: 'Settled' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

const TABS: Array<{ id: PaymentsTab; label: string }> = [
  { id: 'ledger', label: 'Ledger' },
  { id: 'by_source', label: 'By source' },
  { id: 'by_service', label: 'By service' },
  { id: 'trends', label: 'Trends' },
];

function formatInrFromPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'settled') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'requires_action') return 'warning';
  return 'neutral';
}

function statusLabel(status: string): string {
  if (status === 'requires_action') return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function PaymentsClient(): JSX.Element {
  const { toast } = useToast();
  const { token, apiBase } = useTenantAdminSession();
  const [summary, setSummary] = useState<PaymentSummaryResponse | null>(null);
  const [ledger, setLedger] = useState<PaymentLedgerRow[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [tab, setTab] = useState<PaymentsTab>('ledger');
  const [sourceFilter, setSourceFilter] = useState<PaymentSource>('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(25);
  const [ledgerHasNext, setLedgerHasNext] = useState(false);
  const cursorStackRef = useRef<Array<string | null>>([null]);

  const breakdownPagination = useClientPagination(breakdown, { pageSize: 25 });

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const filterQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (sourceFilter) params.set('source', sourceFilter);
    if (statusFilter) params.set('status', statusFilter);
    return params.toString();
  }, [sourceFilter, statusFilter]);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${apiBase}/admin/tenant/dashboard/payment-summary`, {
      headers: authHeaders(),
    });
    if (res.ok) {
      setSummary((await res.json()) as PaymentSummaryResponse);
    }
  }, [apiBase, authHeaders, token]);

  const loadLedger = useCallback(async () => {
    if (!token) return;
    const params = new URLSearchParams(filterQuery());
    const q = appliedSearchQuery.trim();
    if (q) params.set('q', q);
    params.set('limit', String(ledgerPageSize));
    const cursor = cursorStackRef.current[ledgerPage - 1];
    if (cursor) params.set('cursor', cursor);
    const res = await fetch(`${apiBase}/admin/tenant/payments?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      toast(`Failed to load payments (${res.status})`, 'danger');
      return;
    }
    const json = (await res.json()) as { items: PaymentLedgerRow[]; next_cursor: string | null };
    setLedger(json.items);
    setLedgerHasNext(Boolean(json.next_cursor));
    if (json.next_cursor) {
      const stack = cursorStackRef.current.slice(0, ledgerPage);
      stack[ledgerPage] = json.next_cursor;
      cursorStackRef.current = stack;
    }
  }, [
    apiBase,
    authHeaders,
    appliedSearchQuery,
    filterQuery,
    ledgerPage,
    ledgerPageSize,
    toast,
    token,
  ]);

  const loadBreakdown = useCallback(async () => {
    if (!token) return;
    const group = tab === 'by_service' ? 'service' : tab === 'by_source' ? 'source' : 'source';
    const params = new URLSearchParams(filterQuery());
    params.set('group', group);
    const res = await fetch(`${apiBase}/admin/tenant/payments/breakdown?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (res.ok) {
      setBreakdown((await res.json()) as BreakdownRow[]);
    }
  }, [apiBase, authHeaders, filterQuery, tab, token]);

  const loadAll = useCallback(async () => {
    await loadSummary();
    if (tab === 'ledger') {
      await loadLedger();
    } else if (tab === 'by_source' || tab === 'by_service') {
      await loadBreakdown();
    }
  }, [loadBreakdown, loadLedger, loadSummary, tab]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (tab === 'ledger') {
      void loadLedger();
    } else if (tab === 'by_source' || tab === 'by_service') {
      void loadBreakdown();
    }
  }, [loadBreakdown, loadLedger, tab]);

  useEffect(() => {
    cursorStackRef.current = [null];
    setLedgerPage(1);
  }, [sourceFilter, statusFilter, appliedSearchQuery, ledgerPageSize]);

  function applyLedgerSearch(): void {
    setAppliedSearchQuery(searchQuery.trim());
    cursorStackRef.current = [null];
    setLedgerPage(1);
  }

  async function downloadExport(): Promise<void> {
    if (!token) return;
    const res = await fetch(`${apiBase}/admin/tenant/exports/payments.csv`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      toast(`Export failed (${res.status})`, 'danger');
      return;
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'payments.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    toast('Payments CSV exported.', 'success');
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Payments"
        subtitle="Unified payment ledger — applications, bookings, rental, EV, and water"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void downloadExport()}>
              Export CSV
            </Button>
            <Button type="button" variant="secondary" onClick={() => void loadAll()}>
              Refresh
            </Button>
          </div>
        }
      />

      <PaymentSummaryPanel summary={summary} />

      <Card>
        <div className="space-y-4">
          <FilterChips
            ariaLabel="Filter by payment source"
            chips={SOURCE_CHIPS}
            selected={sourceFilter}
            onSelect={setSourceFilter}
          />
          <FilterChips
            ariaLabel="Filter by payment status"
            chips={STATUS_CHIPS}
            selected={statusFilter}
            onSelect={setStatusFilter}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <SectionNav aria-label="Payments views" items={TABS} active={tab} onSelect={setTab} />

        <Card>
          {tab === 'ledger' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyLedgerSearch();
                  }}
                  placeholder="Search docket, booking, invoice…"
                  className="w-full max-w-md rounded-xl border border-warm-border bg-surface px-3 py-2 text-sm"
                />
                <Button type="button" size="sm" onClick={() => applyLedgerSearch()}>
                  Search
                </Button>
              </div>
              <DataTable>
                <DataTableElement>
                  <DataTableHead>
                    <tr>
                      <DataTableHeaderCell>Reference</DataTableHeaderCell>
                      <DataTableHeaderCell>Source</DataTableHeaderCell>
                      <DataTableHeaderCell>Amount</DataTableHeaderCell>
                      <DataTableHeaderCell>Status</DataTableHeaderCell>
                      <DataTableHeaderCell>Service</DataTableHeaderCell>
                      <DataTableHeaderCell>Settled</DataTableHeaderCell>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {ledger.length ? (
                      ledger.map((row) => (
                        <DataTableRow key={row.id}>
                          <DataTableCell>
                            {row.deep_link ? (
                              <Link
                                className="font-mono text-sm font-semibold text-brand hover:underline"
                                href={row.deep_link as Route}
                              >
                                {row.reference}
                              </Link>
                            ) : (
                              <span className="font-mono text-sm">{row.reference}</span>
                            )}
                          </DataTableCell>
                          <DataTableCell className="capitalize">{row.source || '—'}</DataTableCell>
                          <DataTableCell>{formatInrFromPaise(row.amount_paise)}</DataTableCell>
                          <DataTableCell>
                            <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>
                          </DataTableCell>
                          <DataTableCell className="font-mono text-xs">
                            {row.service_code ?? '—'}
                          </DataTableCell>
                          <DataTableCell className="text-xs text-ink-secondary">
                            {row.settled_at ? new Date(row.settled_at).toLocaleString() : '—'}
                          </DataTableCell>
                        </DataTableRow>
                      ))
                    ) : (
                      <DataTableRow>
                        <DataTableCell colSpan={6}>
                          <span className="text-sm text-ink-secondary">No payments found.</span>
                        </DataTableCell>
                      </DataTableRow>
                    )}
                  </DataTableBody>
                </DataTableElement>
              </DataTable>
              <PaginationBar
                page={ledgerPage}
                totalPages={ledgerHasNext ? ledgerPage + 1 : ledgerPage}
                totalItems={ledger.length + (ledgerPage - 1) * ledgerPageSize}
                pageSize={ledgerPageSize}
                hidePageSize={false}
                label={
                  ledger.length
                    ? `Showing ${ledger.length} payment(s) on page ${ledgerPage}${ledgerHasNext ? '+' : ''}`
                    : 'No payments on this page'
                }
                onPageChange={setLedgerPage}
                onPageSizeChange={(size) => {
                  setLedgerPageSize(size);
                  setLedgerPage(1);
                }}
              />
            </div>
          ) : null}

          {tab === 'by_source' || tab === 'by_service' ? (
            <>
              <DataTable>
                <DataTableElement>
                  <DataTableHead>
                    <tr>
                      <DataTableHeaderCell>
                        {tab === 'by_service' ? 'Service' : 'Source'}
                      </DataTableHeaderCell>
                      <DataTableHeaderCell>Count</DataTableHeaderCell>
                      <DataTableHeaderCell>Settled amount</DataTableHeaderCell>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {breakdownPagination.pageItems.length ? (
                      breakdownPagination.pageItems.map((row) => (
                        <DataTableRow key={row.key}>
                          <DataTableCell>{row.label}</DataTableCell>
                          <DataTableCell>{row.count}</DataTableCell>
                          <DataTableCell>{formatInrFromPaise(row.amount_paise)}</DataTableCell>
                        </DataTableRow>
                      ))
                    ) : (
                      <DataTableRow>
                        <DataTableCell colSpan={3}>
                          <span className="text-sm text-ink-secondary">No breakdown data.</span>
                        </DataTableCell>
                      </DataTableRow>
                    )}
                  </DataTableBody>
                </DataTableElement>
              </DataTable>
              <PaginationBar
                page={breakdownPagination.page}
                totalPages={breakdownPagination.totalPages}
                totalItems={breakdownPagination.totalItems}
                pageSize={breakdownPagination.pageSize}
                onPageChange={breakdownPagination.setPage}
                onPageSizeChange={breakdownPagination.setPageSize}
              />
            </>
          ) : null}

          {tab === 'trends' ? (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-ink-primary">
                30-day settlement trend
              </h3>
              <DashboardTrendsChart
                rows={summary?.trends_30d ?? []}
                dataKey="settled"
                label="Settled"
              />
            </div>
          ) : null}
        </Card>
      </div>

      <p className="text-sm text-ink-secondary">
        Advanced ops:{' '}
        <Link className="font-semibold text-brand hover:underline" href="/dashboard/operations">
          Operations
        </Link>
      </p>
    </div>
  );
}
