'use client';

import { AlertBanner, Badge, Button, Card, KpiCard, PageHeader, useToast } from '@enagar/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  BookingSummaryPanel,
  type BookingSummaryResponse,
} from '../../components/booking-summary-panel';
import { DashboardTrendsChart } from '../../components/dashboard-trends-chart';
import {
  PaymentSummaryPanel,
  type PaymentSummaryResponse,
} from '../../components/payment-summary-panel';
import { useTenantAdminSession } from '../../components/tenant-admin-session';

import type { Route } from 'next';

type DashboardSnapshot = {
  tenant_id: string;
  tenant_code?: string;
  applications_total: number;
  applications_open: number;
  grievances_open: number;
  grievances_sla_breached_open: number;
  citizens_registered: number;
};

type DashboardDeep = {
  application_trends_30d: Array<{ date: string; submitted: number }>;
  payment_trends_30d: Array<{ date: string; settled: number; amount_paise: number }>;
  breached_grievances: Array<{
    id: string;
    reference: string;
    category: string;
    status: string;
    sla_due_at: string | null;
    sla_breached_at: string | null;
    updated_at: string;
  }>;
  breached_applications: Array<{
    id: string;
    docket_no: string;
    service_code: string;
    status: string;
    pending_role: string | null;
    submitted_at: string;
    updated_at: string;
    expected_sla_at: string | null;
  }>;
  top_services: Array<{
    service_code: string;
    name: unknown;
    open_applications: number;
    recent_submissions_30d: number;
  }>;
};

function pickLabel(json: unknown): string {
  if (typeof json === 'string') {
    return json;
  }
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const rec = json as Record<string, unknown>;
    for (const key of ['en', 'bn', 'hi']) {
      const v = rec[key];
      if (typeof v === 'string' && v.trim()) {
        return v;
      }
    }
    const first = Object.values(rec).find((x) => typeof x === 'string' && x.trim());
    if (typeof first === 'string') {
      return first;
    }
  }
  return '—';
}

export default function DashboardClient(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const { token, apiBase } = useTenantAdminSession();
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [dashboardDeep, setDashboardDeep] = useState<DashboardDeep | null>(null);
  const [bookingSummary, setBookingSummary] = useState<BookingSummaryResponse | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummaryResponse | null>(null);

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const loadAll = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const [dashRes, deepRes, bookingSummaryRes, paymentSummaryRes] = await Promise.all([
        fetch(`${apiBase}/admin/tenant/dashboard`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/dashboard/deep`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/dashboard/booking-summary`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/dashboard/payment-summary`, { headers: authHeaders() }),
      ]);
      if (!dashRes.ok || !deepRes.ok || !bookingSummaryRes.ok || !paymentSummaryRes.ok) {
        if (
          dashRes.status === 403 ||
          deepRes.status === 403 ||
          bookingSummaryRes.status === 403 ||
          paymentSummaryRes.status === 403
        ) {
          const deskRes = await fetch(`${apiBase}/admin/tenant/desk/me`, {
            headers: authHeaders(),
          });
          if (deskRes.ok) {
            router.replace('/dashboard/desk');
            return;
          }
        }
        const body = await dashRes.text().catch(() => '');
        toast(`API error loading dashboard (${dashRes.status}): ${body.slice(0, 120)}`, 'danger');
        return;
      }
      const dashJson = (await dashRes.json()) as DashboardSnapshot;
      const deepJson = (await deepRes.json()) as DashboardDeep;
      const bookingSummaryJson = (await bookingSummaryRes.json()) as BookingSummaryResponse;
      const paymentSummaryJson = (await paymentSummaryRes.json()) as PaymentSummaryResponse;
      setDashboard(dashJson);
      setDashboardDeep(deepJson);
      setBookingSummary(bookingSummaryJson);
      setPaymentSummary(paymentSummaryJson);
    } catch {
      toast('Network error loading dashboard.', 'danger');
    }
  }, [apiBase, authHeaders, router, toast, token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function downloadExport(kind: string): Promise<void> {
    if (!token) {
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/exports/${kind}.csv`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      toast(`Export failed (${res.status}): ${text.slice(0, 120)}`, 'danger');
      return;
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${kind}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    toast(`${kind} CSV exported.`, 'success');
  }

  const slaBreaches =
    (dashboard?.grievances_sla_breached_open ?? 0) +
    (dashboardDeep?.breached_applications.length ?? 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Dashboard"
        subtitle={
          dashboard?.tenant_code ? `Municipality ${dashboard.tenant_code}` : 'Municipality overview'
        }
        actions={
          <Button type="button" variant="secondary" onClick={() => void loadAll()}>
            Refresh data
          </Button>
        }
      />

      {slaBreaches > 0 ? (
        <AlertBanner
          tone="warning"
          title={`${slaBreaches} item${slaBreaches === 1 ? '' : 's'} past SLA`}
          action={
            <Link
              href="/dashboard/desk"
              className="text-sm font-semibold text-brand hover:underline"
            >
              Open in Desk →
            </Link>
          }
        >
          Review breached applications and grievances in the operator Desk.
        </AlertBanner>
      ) : null}

      {dashboard ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Applications (total)" value={dashboard.applications_total} />
          <KpiCard label="Applications (open)" value={dashboard.applications_open} />
          <KpiCard label="Citizens registered" value={dashboard.citizens_registered} />
          <KpiCard label="Grievances (open)" value={dashboard.grievances_open} />
          <KpiCard
            label="SLA breached (open)"
            value={dashboard.grievances_sla_breached_open}
            accent="danger"
          />
        </section>
      ) : (
        <p className="text-ink-secondary">Loading KPIs…</p>
      )}

      <section className="grid gap-6 xl:grid-cols-2">
        <PaymentSummaryPanel summary={paymentSummary} />
        <BookingSummaryPanel summary={bookingSummary} variant="summary" />
      </section>

      {dashboardDeep ? (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-primary">30-day trends</h2>
                <p className="text-sm text-ink-secondary">Applications submitted</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['applications', 'payments', 'grievances'].map((kind) => (
                  <Button
                    key={kind}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void downloadExport(kind)}
                  >
                    CSV {kind}
                  </Button>
                ))}
              </div>
            </div>
            <DashboardTrendsChart rows={dashboardDeep.application_trends_30d} />
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-ink-primary">Top active workload</h2>
            <ul className="mt-4 space-y-3">
              {dashboardDeep.top_services.length ? (
                dashboardDeep.top_services.map((row) => (
                  <li
                    key={row.service_code}
                    className="flex items-center justify-between gap-3 rounded-xl border border-warm-border px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink-primary">{pickLabel(row.name)}</p>
                      <p className="font-mono text-xs text-ink-secondary">{row.service_code}</p>
                    </div>
                    <Badge tone="warning">{row.open_applications} open</Badge>
                  </li>
                ))
              ) : (
                <li className="text-sm text-ink-secondary">No recent service activity.</li>
              )}
            </ul>
          </Card>

          <QueueCard
            title="Breached applications"
            empty="No application SLA breaches detected."
            rows={dashboardDeep.breached_applications.map((row) => ({
              key: row.id,
              href: `/dashboard/desk?docket=${encodeURIComponent(row.docket_no)}`,
              title: row.docket_no,
              subtitle: `${row.service_code} · ${row.status}`,
              meta: row.expected_sla_at
                ? `Expected by ${new Date(row.expected_sla_at).toLocaleString()}`
                : 'No SLA date',
            }))}
          />
          <QueueCard
            title="Breached grievances"
            empty="No open breached grievances."
            rows={dashboardDeep.breached_grievances.map((row) => ({
              key: row.id,
              href: `/dashboard/desk?grievance=${encodeURIComponent(row.id)}`,
              title: row.reference,
              subtitle: `${row.category} · ${row.status}`,
              meta: row.sla_breached_at
                ? `Breached ${new Date(row.sla_breached_at).toLocaleString()}`
                : 'No breach timestamp',
            }))}
          />
        </section>
      ) : null}
    </div>
  );
}

function QueueCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ key: string; href: string; title: string; subtitle: string; meta: string }>;
  empty: string;
}): JSX.Element {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
      <p className="mt-1 text-xs text-ink-secondary">Open in Desk</p>
      <ul className="mt-4 space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href as Route}
                className="block rounded-xl border border-danger/20 bg-danger-bg/40 p-3 transition hover:border-danger/40"
              >
                <p className="font-mono text-xs font-semibold text-ink-primary">{row.title}</p>
                <p className="mt-1 text-sm text-ink-secondary">{row.subtitle}</p>
                <p className="mt-1 text-xs text-ink-secondary">{row.meta}</p>
              </Link>
            </li>
          ))
        ) : (
          <li className="text-sm text-ink-secondary">{empty}</li>
        )}
      </ul>
    </Card>
  );
}
