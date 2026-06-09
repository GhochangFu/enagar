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
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from '../../components/tenant-admin-session';

type RentalAssetStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RESERVED';

type LeaseAgreement = {
  id: string;
  lessorName: string;
  tradeLicenseNo: string;
  startDate: string;
  endDate: string;
  securityDepositPaise: number;
  status: string;
};

type RentalAsset = {
  id: string;
  assetType: string;
  name: Record<string, string>;
  location: Record<string, unknown>;
  status: RentalAssetStatus;
  baseLeaseRatePaise: number;
  ratePeriod: string;
  createdAt?: string;
  agreements?: LeaseAgreement[];
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  HOARDING: 'Hoarding',
  MARKET_STALL: 'Market Stall',
  LAND: 'Land',
  COMMUNITY_HALL_LONG_TERM: 'Community Hall',
  OTHER: 'Other',
};

const STATUS_TONE: Record<RentalAssetStatus, 'success' | 'neutral' | 'warning' | 'info'> = {
  AVAILABLE: 'success',
  RENTED: 'neutral',
  MAINTENANCE: 'warning',
  RESERVED: 'info',
};

const STATUS_LABELS: Record<RentalAssetStatus, string> = {
  AVAILABLE: 'Available',
  RENTED: 'Rented',
  MAINTENANCE: 'Maintenance',
  RESERVED: 'Reserved',
};

function formatRate(paise: number, period: string): string {
  const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
  return `${inr} / ${period.toLowerCase()}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function AssetDetailModal({
  asset,
  onClose,
  onViewLease,
}: {
  asset: RentalAsset | null;
  onClose: () => void;
  onViewLease: (lease: LeaseAgreement) => void;
}): JSX.Element | null {
  if (!asset) return null;
  const typeLabel = ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType;
  const nameEn = asset.name?.en ?? 'Unnamed asset';
  const locDesc =
    typeof asset.location?.description === 'string' ? asset.location.description : null;
  const activeLease = asset.agreements?.[0] ?? null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-warm-border bg-surface p-6 shadow-xl"
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              {typeLabel}
            </p>
            <h2 id="asset-detail-title" className="mt-1 text-xl font-bold text-ink-primary">
              {nameEn}
            </h2>
          </div>
          <Badge tone={STATUS_TONE[asset.status]}>{STATUS_LABELS[asset.status]}</Badge>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Rate
            </dt>
            <dd className="mt-1 font-semibold text-ink-primary">
              {formatRate(asset.baseLeaseRatePaise, asset.ratePeriod)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Created
            </dt>
            <dd className="mt-1 text-ink-primary">{formatDate(asset.createdAt)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Location
            </dt>
            <dd className="mt-1 text-ink-primary">
              {locDesc ?? <span className="text-ink-muted">No location specified</span>}
            </dd>
          </div>
        </dl>
        {activeLease ? (
          <div className="mt-5 rounded-xl border border-warm-border bg-canvas/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Current Lessor
            </p>
            <p className="mt-1 font-semibold text-ink-primary">{activeLease.lessorName}</p>
            <p className="text-xs text-ink-muted">
              Lease {formatDate(activeLease.startDate)} → {formatDate(activeLease.endDate)}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              icon="file-text"
              onClick={() => onViewLease(activeLease)}
            >
              View Lease Agreement
            </Button>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {asset.status === 'AVAILABLE' ? (
            <Button asChild>
              <Link href={`/rental-assets/new?assetId=${asset.id}`}>Create Lease</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LeaseDetailModal({
  lease,
  onClose,
}: {
  lease: LeaseAgreement | null;
  onClose: () => void;
}): JSX.Element | null {
  if (!lease) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lease-detail-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-warm-border bg-surface p-6 shadow-xl"
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
          Lease Agreement
        </p>
        <h2 id="lease-detail-title" className="mt-1 text-xl font-bold text-ink-primary">
          {lease.lessorName}
        </h2>
        <Badge tone="brand" className="mt-2">
          {lease.status}
        </Badge>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Trade License No.
            </dt>
            <dd className="mt-1 font-mono text-sm text-ink-primary">{lease.tradeLicenseNo}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Start Date
            </dt>
            <dd className="mt-1 text-ink-primary">{formatDate(lease.startDate)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              End Date
            </dt>
            <dd className="mt-1 text-ink-primary">{formatDate(lease.endDate)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Security Deposit
            </dt>
            <dd className="mt-1 font-semibold text-ink-primary">
              {new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0,
              }).format(lease.securityDepositPaise / 100)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Agreement ID
            </dt>
            <dd className="mt-1 font-mono text-xs text-ink-muted">{lease.id}</dd>
          </div>
        </dl>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

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
  }, [apiBase, authHeaders, toast]);

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

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && a.assetType !== typeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = a.name?.en?.toLowerCase() ?? '';
        const loc =
          typeof a.location?.description === 'string'
            ? a.location.description.toLowerCase()
            : '';
        const lessor = a.agreements?.[0]?.lessorName?.toLowerCase() ?? '';
        if (!name.includes(q) && !loc.includes(q) && !lessor.includes(q)) {
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
    <div className="p-6 space-y-6">
      <PageHeader
        title="Rental Assets"
        description="Market stalls, hoardings, land, and other long-term rental assets owned by the ULB."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" icon="file-text">
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

      <Card className="p-0 overflow-hidden">
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
              <select
                aria-label="Filter by asset type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-lg border border-warm-border bg-surface px-3 py-2 text-sm font-medium text-ink-primary focus:border-brand focus:outline-none"
              >
                <option value="ALL">All types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {ASSET_TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div className="relative md:w-72">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, location, or lessor…"
              className="w-full rounded-lg border border-warm-border bg-canvas px-3 py-2 pl-9 text-sm text-ink-primary placeholder:text-ink-muted focus:border-brand focus:outline-none"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
              ⌕
            </span>
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
                  Loading assets…
                </DataTableCell>
              </DataTableRow>
            ) : filtered.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={6} className="py-10 text-center">
                  <p className="text-sm font-medium text-ink-primary">No assets found</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Try adjusting your filters, or click “New Asset” to register one.
                  </p>
                </DataTableCell>
              </DataTableRow>
            ) : (
              filtered.map((asset) => {
                const activeLease = asset.agreements?.[0] ?? null;
                return (
                  <DataTableRow key={asset.id} className="hover:bg-canvas/60">
                    <DataTableCell>
                      <span className="font-semibold text-ink-primary">
                        {asset.name?.en ?? 'Unnamed'}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      <span className="text-ink-secondary">
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
                        <span className="font-medium text-ink-primary">
                          {activeLease.lessorName}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      <Badge tone={STATUS_TONE[asset.status]}>
                        {STATUS_LABELS[asset.status]}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <div className="inline-flex gap-2">
                        {activeLease ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailLease(activeLease)}
                            icon="file-text"
                          >
                            View Lease
                          </Button>
                        ) : null}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setDetailAsset(asset)}
                          icon="file-text"
                        >
                          View
                        </Button>
                        {asset.status === 'AVAILABLE' ? (
                          <Button asChild size="sm" icon="file-plus">
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
          <div className="border-t border-warm-border bg-canvas/50 px-4 py-2 text-xs text-ink-muted">
            Showing {filtered.length} of {assets.length} asset
            {assets.length === 1 ? '' : 's'}
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
      <LeaseDetailModal lease={detailLease} onClose={() => setDetailLease(null)} />
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
