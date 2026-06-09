'use client';

import { AlertBanner, Badge, Button, Card } from '@enagar/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { authHeaders, formatInrFromPaise, readApiError } from '../lib/workspace-http';

import type { TokenResponse } from '../lib/workspace-types';

type LeaseInvoiceStatus = 'PENDING' | 'OVERDUE' | 'PAID' | 'WAIVED';

type CitizenLeaseInvoice = {
  id: string;
  invoiceNo: string;
  amountPaise: number;
  lateFeePaise: number;
  status: LeaseInvoiceStatus;
  dueDate: string;
};

type CitizenLeaseRow = {
  id: string;
  lessorName: string;
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
  tenantCode: string | null;
  asset: { id: string; name: Record<string, string>; assetType: string };
  invoices: (CitizenLeaseInvoice & { tenantCode: string | null })[];
};

/**
 * Row shape the panel actually renders. Today the only source is lease
 * invoices, so `type` is hard-coded to `'Rent'` at the call site, but the
 * field is kept on the row so future invoice kinds (trade licence, water
 * tax, …) can drop in with a different `type` pill and reuse the same tab.
 */
type InvoiceRow = CitizenLeaseInvoice & {
  type: string;
  leaseId: string;
  lessorName: string;
  assetName: string;
  tenantCode: string | null;
};

const INVOICE_TYPE_BADGE_TONE: Record<
  string,
  'info' | 'success' | 'warning' | 'danger' | 'neutral'
> = {
  Rent: 'info',
  // Reserved for future invoice kinds:
  // 'Trade Licence': 'success',
  // 'Water Tax': 'warning',
};

const STATUS_TONE: Record<LeaseInvoiceStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  WAIVED: 'neutral',
};

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function redirectUrlQuery(redirectUrl: string): { paymentId: string; orderId: string } {
  // The backend returns `/payments/stub/complete?payment_id=…&order_id=…`.
  // We only need the two ids from it; the actual stub-complete call goes
  // through the same endpoint `simulateStubSettlement` already uses.
  const url = new URL(redirectUrl, 'http://placeholder.local');
  return {
    paymentId: url.searchParams.get('payment_id') ?? '',
    orderId: url.searchParams.get('order_id') ?? '',
  };
}

export function InvoicesPanel({
  apiBaseUrl,
  mode,
  phone,
  tenantCode,
  token,
  onPaymentRecorded,
}: {
  apiBaseUrl: string;
  mode: 'hub' | 'tenant';
  phone: string;
  tenantCode?: string;
  token: TokenResponse | null;
  /**
   * Called after a successful Pay Now so the parent can re-fetch the
   * `payments` list (the new settled payment will appear there with a
   * `Rent` badge). The parent also re-fetches the invoices itself.
   */
  onPaymentRecorded?: () => void;
}): JSX.Element {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banners, setBanners] = useState<{
    tone: 'warning' | 'danger' | 'info';
    message: string;
  } | null>(null);

  const fetchRows = useCallback(async () => {
    if (!token || !phone) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/lease-invoices/lookup?phone=${encodeURIComponent(phone)}`,
        { headers: authHeaders(token, false) },
      );
      if (!res.ok) {
        throw new Error(await readApiError(res));
      }
      const data = (await res.json()) as CitizenLeaseRow[];
      // Flatten leases → invoices and tag every row with `type: 'Rent'`.
      // Each row carries the invoice's `tenantCode` (mirrored on the
      // agreement and invoice by the backend `lookupLeasesByPhone` method)
      // so the workspace mode can client-filter to the selected ULB.
      const flat: InvoiceRow[] = data.flatMap((lease) =>
        lease.invoices.map((inv) => ({
          ...inv,
          type: 'Rent',
          leaseId: lease.id,
          lessorName: lease.lessorName,
          assetName: lease.asset.name?.en ?? 'Asset',
          tenantCode: inv.tenantCode ?? lease.tenantCode ?? null,
        })),
      );
      // Sort: PENDING/OVERDUE first (newest dueDate), then PAID/WAIVED.
      flat.sort((a, b) => {
        const rank = (s: LeaseInvoiceStatus) =>
          s === 'OVERDUE' ? 0 : s === 'PENDING' ? 1 : s === 'PAID' ? 2 : 3;
        if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      });
      setRows(flat);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, phone, token]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const scopedRows = useMemo(() => {
    if (mode !== 'tenant' || !tenantCode) return rows;
    return rows.filter((row) => row.tenantCode === tenantCode);
  }, [mode, rows, tenantCode]);

  const handlePayNow = useCallback(
    async (row: InvoiceRow) => {
      if (!token) return;
      setPayingId(row.id);
      setBanners(null);
      try {
        // 1. Initiate the online payment against the citizen-scoped endpoint.
        //    The backend re-validates the phone matches the agreement's
        //    lessorPhone, so passing the citizen's phone here is both
        //    authorization and an audit field.
        const initRes = await fetch(`${apiBaseUrl}/lease-invoices/${row.id}/pay-as-citizen`, {
          method: 'POST',
          headers: authHeaders(token, true),
          body: JSON.stringify({ method: 'ONLINE_GATEWAY', phone }),
        });
        if (!initRes.ok) {
          throw new Error(await readApiError(initRes));
        }
        const initData = (await initRes.json()) as { paymentId: string; redirectUrl: string };
        const { paymentId, orderId } = redirectUrlQuery(initData.redirectUrl);
        if (!paymentId || !orderId) {
          throw new Error('Stub gateway returned a malformed redirect URL.');
        }
        // 2. Complete the stub capture. This is the same call the existing
        //    `simulateStubSettlement` makes, just with a per-tenant scope
        //    header so the receipt is created under the right ULB.
        const settleRes = await fetch(`${apiBaseUrl}/payments/stub/complete`, {
          method: 'POST',
          headers: authHeaders(token, true, row.tenantCode ?? tenantCode ?? null),
          body: JSON.stringify({ payment_id: paymentId, gateway_order_id: orderId }),
        });
        if (!settleRes.ok) {
          throw new Error(await readApiError(settleRes));
        }
        setBanners({
          tone: 'info',
          message: `Payment for ${row.invoiceNo} captured. Receipt will be in My Payments.`,
        });
        // 3. Refresh both lists.
        await fetchRows();
        onPaymentRecorded?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setBanners({ tone: 'danger', message: `Could not capture payment: ${message}` });
      } finally {
        setPayingId(null);
      }
    },
    [apiBaseUrl, fetchRows, onPaymentRecorded, phone, tenantCode, token],
  );

  if (!token) {
    return (
      <AlertBanner tone="warning" title="Please sign in">
        You must be signed in to view your invoices.
      </AlertBanner>
    );
  }

  if (loading && rows.length === 0) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  if (error) {
    return (
      <AlertBanner tone="danger" title="Could not load invoices">
        {error}
      </AlertBanner>
    );
  }

  if (scopedRows.length === 0) {
    return (
      <AlertBanner tone="info" title="No invoices found">
        {mode === 'tenant' && tenantCode
          ? `We could not find any active invoices for ${tenantCode} linked to your phone number.`
          : 'We could not find any invoices linked to your phone number. Active leases with the ULB will appear here once rent is billed.'}
      </AlertBanner>
    );
  }

  return (
    <div className="space-y-3">
      {banners ? (
        <AlertBanner
          tone={banners.tone}
          title={banners.tone === 'danger' ? 'Payment error' : 'Payment captured'}
        >
          {banners.message}
        </AlertBanner>
      ) : null}
      {scopedRows.map((row) => {
        const total = row.amountPaise + row.lateFeePaise;
        const payNow = row.status === 'PENDING' || row.status === 'OVERDUE';
        const typeTone = INVOICE_TYPE_BADGE_TONE[row.type] ?? 'info';
        return (
          <Card className="p-4" key={row.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={typeTone}>Invoice type: {row.type}</Badge>
                  <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                </div>
                <p className="mt-2 font-mono text-xs text-ink-secondary">{row.invoiceNo}</p>
                <p className="mt-1 text-sm font-semibold text-ink-primary">{row.assetName}</p>
                <p className="text-xs text-ink-muted">
                  Lessor: {row.lessorName}
                  {row.tenantCode ? ` · ULB: ${row.tenantCode}` : ''}
                </p>
                <p className="mt-1 text-xs text-ink-muted">Due {formatDueDate(row.dueDate)}</p>
              </div>
              <div className="text-right">
                <strong className="text-lg font-black text-ink-primary">
                  {formatInrFromPaise(total)}
                </strong>
                {row.lateFeePaise > 0 ? (
                  <p className="mt-0.5 text-[11px] font-semibold text-danger">
                    incl. {formatInrFromPaise(row.lateFeePaise)} late fee
                  </p>
                ) : null}
                {payNow ? (
                  <Button
                    className="mt-2"
                    disabled={payingId === row.id}
                    loading={payingId === row.id}
                    onClick={() => void handlePayNow(row)}
                    size="sm"
                  >
                    Pay Now
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
