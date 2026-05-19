'use client';

import { Button, PageHeader } from '@enagar/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

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
  payments_settled_last_30_days: number;
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

type ServiceRow = {
  id: string;
  code: string;
  name: unknown;
  description: unknown;
  is_active: boolean;
  effective_sla_days: number | null;
  updated_at: string;
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
  const { token, apiBase } = useTenantAdminSession();
  const [status, setStatus] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [dashboardDeep, setDashboardDeep] = useState<DashboardDeep | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [slaDrafts, setSlaDrafts] = useState<Record<string, string>>({});

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
    setStatus(null);
    try {
      const [dashRes, deepRes, svcRes] = await Promise.all([
        fetch(`${apiBase}/admin/tenant/dashboard`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/dashboard/deep`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/services`, { headers: authHeaders() }),
      ]);
      if (!dashRes.ok || !deepRes.ok || !svcRes.ok) {
        if (dashRes.status === 403 || deepRes.status === 403 || svcRes.status === 403) {
          const deskRes = await fetch(`${apiBase}/admin/tenant/desk/me`, {
            headers: authHeaders(),
          });
          if (deskRes.ok) {
            router.replace('/dashboard/desk');
            return;
          }
        }
        const body = await dashRes.text().catch(() => '');
        const deepBody = await deepRes.text().catch(() => '');
        const body2 = await svcRes.text().catch(() => '');
        setStatus(
          `API error (${dashRes.status} / ${deepRes.status} / ${svcRes.status}) ${body.slice(0, 120)} ${deepBody.slice(0, 120)} ${body2.slice(0, 120)}`,
        );
        return;
      }
      const dashJson = (await dashRes.json()) as DashboardSnapshot;
      const deepJson = (await deepRes.json()) as DashboardDeep;
      const svcJson = (await svcRes.json()) as ServiceRow[];
      setDashboard(dashJson);
      setDashboardDeep(deepJson);
      setServices(svcJson);
      const drafts: Record<string, string> = {};
      for (const row of svcJson) {
        drafts[row.id] =
          row.effective_sla_days === null || row.effective_sla_days === undefined
            ? ''
            : String(row.effective_sla_days);
      }
      setSlaDrafts(drafts);
    } catch {
      setStatus('Network error loading dashboard.');
    }
  }, [apiBase, authHeaders, router, token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function patchService(serviceId: string, body: Record<string, unknown>): Promise<void> {
    if (!token) {
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/services/${serviceId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      setStatus(`Save failed (${res.status}): ${errText.slice(0, 240)}`);
      await loadAll();
      return;
    }
    const updated = (await res.json()) as ServiceRow;
    setServices((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setStatus(null);
  }

  async function downloadExport(kind: string): Promise<void> {
    if (!token) {
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/exports/${kind}.csv`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      setStatus(`Export failed (${res.status}): ${text.slice(0, 180)}`);
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
    setStatus(`${kind} CSV exported.`);
  }

  async function downloadPdf(kind: string): Promise<void> {
    if (!token) {
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/exports/${kind}.pdf`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      setStatus(`PDF export failed (${res.status}): ${text.slice(0, 180)}`);
      return;
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${kind}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    setStatus(`${kind} PDF exported.`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Dashboard"
        subtitle={
          dashboard?.tenant_code
            ? `Municipality ${dashboard.tenant_code}`
            : 'Service catalogue and municipality KPIs'
        }
        actions={
          <Button type="button" variant="secondary" onClick={() => void loadAll()}>
            Refresh data
          </Button>
        }
      />

      {status ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {status}
        </p>
      ) : null}

      {dashboard ? (
        <section className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard title="Applications (total)" value={dashboard.applications_total} />
          <KpiCard title="Applications (open)" value={dashboard.applications_open} />
          <KpiCard title="Citizens registered" value={dashboard.citizens_registered} />
          <KpiCard title="Grievances (open)" value={dashboard.grievances_open} />
          <KpiCard title="SLA breached (open)" value={dashboard.grievances_sla_breached_open} />
          <KpiCard title="Payments settled (30d)" value={dashboard.payments_settled_last_30_days} />
        </section>
      ) : (
        <p className="text-ink-secondary">Loading KPIs…</p>
      )}

      {dashboardDeep ? (
        <section className="mb-12 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Sprint 6.9 · Dashboard depth
                </p>
                <h2 className="text-lg font-semibold text-slate-900">30-day trends</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {['applications', 'payments', 'grievances', 'sla-summary'].map((kind) => (
                  <div key={kind} className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void downloadExport(kind)}
                    >
                      CSV {kind}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void downloadPdf(kind)}
                    >
                      PDF
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TrendList
                title="Applications submitted"
                rows={dashboardDeep.application_trends_30d.slice(-7).map((row) => ({
                  label: row.date,
                  value: row.submitted,
                }))}
              />
              <TrendList
                title="Payments settled"
                rows={dashboardDeep.payment_trends_30d.slice(-7).map((row) => ({
                  label: row.date,
                  value: `${row.settled} / ₹${(row.amount_paise / 100).toFixed(2)}`,
                }))}
              />
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Top active workload</h2>
            <ul className="mt-4 space-y-3">
              {dashboardDeep.top_services.length ? (
                dashboardDeep.top_services.map((row) => (
                  <li key={row.service_code} className="rounded border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">{pickLabel(row.name)}</p>
                    <p className="font-mono text-xs text-slate-500">{row.service_code}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Open: {row.open_applications} · Recent 30d: {row.recent_submissions_30d}
                    </p>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500">No recent service activity.</li>
              )}
            </ul>
          </article>

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

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold text-slate-900">Service catalogue</h2>
          <p className="text-xs text-slate-500">
            Rows come from Postgres (<span className="font-mono">services</span>); citizen-facing{' '}
            <span className="font-mono">GET /services/tenants/:code</span> now resolves published
            database forms.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">SLA days</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Designer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={row.is_active}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setServices((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)),
                        );
                        void patchService(row.id, { is_active: next });
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-800">
                    {pickLabel(row.name)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        className="w-24 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                        value={slaDrafts[row.id] ?? ''}
                        onChange={(e) => setSlaDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const raw = slaDrafts[row.id]?.trim() ?? '';
                          const n = raw === '' ? undefined : Number.parseInt(raw, 10);
                          if (n === undefined || Number.isNaN(n) || n < 0) {
                            setStatus('SLA days must be a non-negative integer.');
                            return;
                          }
                          void patchService(row.id, { effective_sla_days: n });
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {new Date(row.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/dashboard/services/${row.id}`}
                      className="rounded bg-[rgb(var(--brand-rgb))] px-3 py-1.5 text-xs font-medium text-white hover:opacity-95"
                    >
                      Configure
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Dummy operators and MFA expectations: see{' '}
          <span className="font-mono">docs/runbooks/keycloak.md</span> in this repository.
        </p>
      </section>
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: number }): JSX.Element {
  return (
    <article className="rounded-2xl border border-warm-border bg-mint-band p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-forest">{title}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-forest">{value}</p>
    </article>
  );
}

function TrendList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string | number }>;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.label} className="flex justify-between gap-4">
            <span className="font-mono text-xs text-slate-500">{row.label}</span>
            <span className="font-semibold text-slate-900">{row.value}</span>
          </li>
        ))}
      </ul>
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
    <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
      <p className="mt-1 text-xs text-ink-secondary">Open in Desk</p>
      <ul className="mt-4 space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href as Route}
                className="block rounded-2xl border border-peach/80 bg-peach/25 p-3 transition hover:bg-peach/40"
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
    </article>
  );
}
