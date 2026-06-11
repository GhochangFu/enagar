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
  SegmentedControl,
  ToastProvider,
  useToast,
} from '@enagar/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { RecordRentPaymentModal } from '../../components/record-rent-payment-modal';
import { AssetDetailModal } from '../../components/rental-assets/asset-detail-modal';
import { EditLessorPhoneModal } from '../../components/rental-assets/edit-lessor-phone-modal';
import { LeaseDetailModal } from '../../components/rental-assets/lease-detail-modal';
import {
  ASSET_TYPE_LABELS,
  formatINR,
  formatRate,
  STATUS_LABELS,
  STATUS_TONE,
  type LeaseAgreement,
  type LeaseInvoice,
  type RentalAsset,
  type RentalAssetStatus,
} from '../../components/rental-assets/types';
import { useTenantAdminSession } from '../../components/tenant-admin-session';

import type { DocRow } from '../../components/rental-assets/lease-document-panel';

type PaymentHealth = 'PAID' | 'DUE' | 'UPCOMING' | 'OVERDUE' | 'NO_INVOICE';

function derivePaymentHealth(asset: RentalAsset): PaymentHealth {
  if (asset.status !== 'RENTED') return 'NO_INVOICE';
  const lease = asset.agreements?.[0];
  const inv = lease?.invoices?.[0];
  if (!inv) return 'NO_INVOICE';
  if (inv.status === 'PAID') return 'PAID';
  if (inv.status === 'OVERDUE') return 'OVERDUE';
  // PENDING
  const due = new Date(inv.dueDate);
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  return due <= sevenDaysFromNow ? 'DUE' : 'UPCOMING';
}

const PAYMENT_HEALTH_LABEL: Record<PaymentHealth, string> = {
  PAID: 'Paid',
  DUE: 'Due',
  UPCOMING: 'Upcoming',
  OVERDUE: 'Overdue',
  NO_INVOICE: '—',
};

const PAYMENT_HEALTH_TONE: Record<
  PaymentHealth,
  'success' | 'warning' | 'info' | 'danger' | 'neutral'
> = {
  PAID: 'success',
  DUE: 'warning',
  UPCOMING: 'info',
  OVERDUE: 'danger',
  NO_INVOICE: 'neutral',
};

function RentalAssetsContent() {
  const { token, apiBase } = useTenantAdminSession();
  const { toast } = useToast();
  const [assets, setAssets] = useState<RentalAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | RentalAssetStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | string>('ALL');
  const [search, setSearch] = useState('');
  const [detailAsset, setDetailAsset] = useState<RentalAsset | null>(null);
  const [detailLease, setDetailLease] = useState<LeaseAgreement | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<LeaseInvoice | null>(null);
  const [editingPhoneFor, setEditingPhoneFor] = useState<LeaseAgreement | null>(null);
  const [documentsByAgreement, setDocumentsByAgreement] = useState<Record<string, DocRow[]>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  useEffect(() => {
    let cancelled = false;
    const fetchAssets = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${apiBase}/rental-assets`, { headers: authHeaders() });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as RentalAsset[];
        if (!cancelled) setAssets(data);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch rental assets', error);
          toast('Could not load rental assets. Confirm the API is running.', 'danger');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void fetchAssets();
    return () => {
      cancelled = true;
    };
  }, [apiBase, authHeaders, refreshKey, toast]);

  // Lease documents are fetched per-tenant (the API list endpoint has no
  // agreementId filter), so we cache the full list and let the panel slice
  // out its agreement. Cache invalidates on refreshKey or when a panel
  // mutates (upload / review) and calls onDocumentsChanged.
  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/rental-assets/documents`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Array<DocRow & { agreementId: string }>;
      const grouped: Record<string, DocRow[]> = {};
      for (const doc of data) {
        const key = doc.agreementId;
        (grouped[key] ??= []).push({
          id: doc.id,
          status: doc.status,
          fileName: doc.fileName,
          uploadedAt: doc.uploadedAt,
          reviewerNote: doc.reviewerNote ?? null,
        });
      }
      setDocumentsByAgreement(grouped);
    } catch (error) {
      console.error('Failed to fetch lease documents', error);
    }
  }, [apiBase, authHeaders]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments, refreshKey]);

  const counts = useMemo(() => {
    const c: Record<RentalAssetStatus | 'TOTAL', number> = {
      TOTAL: assets.length,
      AVAILABLE: 0,
      RENTED: 0,
      MAINTENANCE: 0,
      RESERVED: 0,
    };
    for (const a of assets) c[a.status] += 1;
    return c;
  }, [assets]);

  /**
   * Total monthly-equivalent rental income (currently active leases only).
   * Used in the hero band so an operator gets a one-glance read on the
   * revenue side without doing the math from the rate column.
   */
  const monthlyRevenuePaise = useMemo(() => {
    let total = 0;
    for (const a of assets) {
      if (a.status !== 'RENTED') continue;
      if (a.ratePeriod === 'MONTHLY') total += a.baseLeaseRatePaise;
      else if (a.ratePeriod === 'QUARTERLY') total += a.baseLeaseRatePaise / 3;
      else if (a.ratePeriod === 'YEARLY') total += a.baseLeaseRatePaise / 12;
    }
    return Math.round(total);
  }, [assets]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && a.assetType !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = a.name?.en?.toLowerCase() ?? '';
        const loc =
          typeof a.location?.description === 'string' ? a.location.description.toLowerCase() : '';
        const lessor = a.agreements?.[0]?.lessorName?.toLowerCase() ?? '';
        const phone = a.agreements?.[0]?.lessorPhone?.toLowerCase() ?? '';
        if (!name.includes(q) && !loc.includes(q) && !lessor.includes(q) && !phone.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [assets, statusFilter, typeFilter, search]);

  const typeOptions = useMemo(() => {
    const present = new Set(assets.map((a) => a.assetType));
    return Array.from(present);
  }, [assets]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Rental Assets"
        description="Market stalls, hoardings, land, and other long-term rental assets owned by the ULB."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" icon="file-plus">
              <Link href="/rental-assets/new-asset">New Asset</Link>
            </Button>
            <Button asChild icon="file-plus">
              <Link href="/rental-assets/new">New Lease Agreement</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Total Assets" value={counts.TOTAL} accent="default" />
        <KpiCard label="Available" value={counts.AVAILABLE} accent="success" />
        <KpiCard label="Rented" value={counts.RENTED} accent="default" />
        <KpiCard label="Maintenance" value={counts.MAINTENANCE} accent="warning" />
      </div>

      {/* Revenue band: surfaces the monthly-equivalent rental income for the
          current rented portfolio. Operators asked for a quick read on
          revenue next to the asset counts. */}
      <Card className="flex flex-col gap-1 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Icon name="trending-up" size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-secondary">
              Monthly rental income (Rented assets)
            </p>
            <p className="mt-0.5 text-2xl font-bold text-ink-primary">
              {formatINR(monthlyRevenuePaise)}
              <span className="ml-1 text-sm font-medium text-ink-muted">/ month</span>
            </p>
          </div>
        </div>
        <Link
          href="/rental-assets/invoices"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
        >
          View rental invoices
          <Icon name="arrow-right" size={14} />
        </Link>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-warm-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              options={[
                { value: 'ALL', label: `All (${counts.TOTAL})` },
                { value: 'AVAILABLE', label: `Available (${counts.AVAILABLE})` },
                { value: 'RENTED', label: `Rented (${counts.RENTED})` },
                { value: 'MAINTENANCE', label: `Maintenance (${counts.MAINTENANCE})` },
                { value: 'RESERVED', label: `Reserved (${counts.RESERVED})` },
              ]}
            />
            {typeOptions.length > 1 ? (
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
                  <Icon name="filter" size={14} />
                </span>
                <select
                  aria-label="Filter by asset type"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-lg border border-warm-border bg-surface py-2 pl-8 pr-3 text-sm font-medium text-ink-primary focus:border-brand focus:outline-none"
                >
                  <option value="ALL">All types</option>
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {ASSET_TYPE_LABELS[t] ?? t}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="relative md:w-80">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
              <Icon name="search" size={14} />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, location, lessor, phone…"
              className="w-full rounded-lg border border-warm-border bg-canvas py-2 pl-9 pr-3 text-sm text-ink-primary placeholder:text-ink-muted focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Asset</DataTableHeaderCell>
              <DataTableHeaderCell>Type</DataTableHeaderCell>
              <DataTableHeaderCell>Rate</DataTableHeaderCell>
              <DataTableHeaderCell>Lessor</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Actions</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {isLoading ? (
              <DataTableRow>
                <DataTableCell colSpan={6} className="py-10 text-center text-ink-muted">
                  <div className="flex items-center justify-center gap-2">
                    <Icon name="refresh" size={14} className="animate-spin" />
                    Loading assets…
                  </div>
                </DataTableCell>
              </DataTableRow>
            ) : filtered.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={6} className="py-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-ink-muted">
                      <Icon name="inbox" size={20} />
                    </div>
                    <p className="text-sm font-medium text-ink-primary">No assets found</p>
                    <p className="text-xs text-ink-muted">
                      Try adjusting your filters, or click “New Asset” to register one.
                    </p>
                  </div>
                </DataTableCell>
              </DataTableRow>
            ) : (
              filtered.map((asset) => {
                const activeLease = asset.agreements?.[0] ?? null;
                return (
                  <DataTableRow key={asset.id} className="hover:bg-canvas/60">
                    <DataTableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-secondary">
                          <Icon name="building" size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink-primary">
                            {asset.name?.en ?? 'Unnamed'}
                          </p>
                          {typeof asset.location?.description === 'string' ? (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-muted">
                              <Icon name="map-pin" size={11} /> {asset.location.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="inline-flex items-center gap-1.5 text-ink-secondary">
                        {ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="font-semibold text-ink-primary">
                        {formatRate(asset.baseLeaseRatePaise, asset.ratePeriod)}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      {activeLease ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 font-medium text-ink-primary">
                            <Icon name="user" size={12} className="text-ink-muted" />
                            {activeLease.lessorName}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                            <span className="flex items-center gap-1 font-mono">
                              <Icon name="phone" size={10} />
                              {activeLease.lessorPhone ?? '— no phone —'}
                            </span>
                            <button
                              type="button"
                              aria-label={`Edit phone for ${activeLease.lessorName}`}
                              onClick={() => setEditingPhoneFor(activeLease)}
                              className="ml-1 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-brand hover:bg-brand/10 focus:outline-none focus:ring-2 focus:ring-brand/40"
                            >
                              <Icon name="edit" size={10} /> Edit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      {asset.status === 'RENTED' ? (
                        (() => {
                          const health = derivePaymentHealth(asset);
                          return (
                            <Badge tone={PAYMENT_HEALTH_TONE[health]}>
                              {PAYMENT_HEALTH_LABEL[health]}
                            </Badge>
                          );
                        })()
                      ) : (
                        <Badge tone={STATUS_TONE[asset.status]}>
                          {STATUS_LABELS[asset.status]}
                        </Badge>
                      )}
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        {activeLease ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailLease(activeLease)}
                            icon="file-text"
                          >
                            Lease
                          </Button>
                        ) : null}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setDetailAsset(asset)}
                          icon="eye"
                        >
                          View
                        </Button>
                        {asset.status === 'AVAILABLE' ? (
                          <Button asChild size="sm" icon="plus">
                            <Link href={`/rental-assets/new?assetId=${asset.id}`}>Lease</Link>
                          </Button>
                        ) : null}
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })
            )}
          </DataTableBody>
        </DataTable>

        {!isLoading && filtered.length > 0 ? (
          <div className="flex items-center justify-between border-t border-warm-border bg-canvas/40 px-4 py-2 text-xs text-ink-muted">
            <span>
              Showing {filtered.length} of {assets.length} asset{assets.length === 1 ? '' : 's'}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="filter" size={11} />
              {statusFilter !== 'ALL' || typeFilter !== 'ALL' || search ? 'Filtered' : 'No filters'}
            </span>
          </div>
        ) : null}
      </Card>

      <AssetDetailModal
        asset={detailAsset}
        onClose={() => setDetailAsset(null)}
        onViewLease={(lease) => {
          setDetailAsset(null);
          setDetailLease(lease);
        }}
      />
      <LeaseDetailModal
        lease={detailLease}
        documents={detailLease ? (documentsByAgreement[detailLease.id] ?? []) : []}
        onDocumentsChanged={() => setRefreshKey((k) => k + 1)}
        onClose={() => setDetailLease(null)}
        onRecordPayment={(inv) => {
          setDetailLease(null);
          setPayingInvoice(inv);
        }}
      />
      <RecordRentPaymentModal
        invoice={payingInvoice}
        onClose={() => setPayingInvoice(null)}
        onRecorded={() => {
          setRefreshKey((k) => k + 1);
        }}
      />
      <EditLessorPhoneModal
        lease={editingPhoneFor}
        apiBase={apiBase}
        token={token}
        onClose={() => setEditingPhoneFor(null)}
        onSaved={({ id, lessorPhone }) => {
          setAssets((prev) =>
            prev.map((a) => {
              if (!a.agreements) return a;
              return {
                ...a,
                agreements: a.agreements.map((ag) =>
                  ag.id === id ? { ...ag, lessorPhone: lessorPhone ?? null } : ag,
                ),
              };
            }),
          );
          setDetailLease((prev) =>
            prev && prev.id === id ? { ...prev, lessorPhone: lessorPhone ?? null } : prev,
          );
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}

export default function RentalAssetsPage() {
  return (
    <ToastProvider>
      <RentalAssetsContent />
    </ToastProvider>
  );
}
