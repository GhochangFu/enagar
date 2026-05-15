'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { publicEnv } from '../../lib/env/public-env';
import {
  ADMIN_OAUTH_STORAGE_KEY,
  type AdminOAuthBundle,
} from '../../lib/oauth/session-storage-keys';

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

function readStoredAuth(): AdminOAuthBundle | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = sessionStorage.getItem(ADMIN_OAUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AdminOAuthBundle;
    if (!parsed.access_token || typeof parsed.expires_at !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default function DashboardClient(): JSX.Element {
  const router = useRouter();
  const fallbackApi = useMemo(() => publicEnv().apiBaseUrl, []);

  const [token, setToken] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState(fallbackApi);
  const [status, setStatus] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [slaDrafts, setSlaDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const auth = readStoredAuth();
    if (!auth) {
      router.replace('/login');
      return;
    }
    if (auth.expires_at < Math.floor(Date.now() / 1000)) {
      sessionStorage.removeItem(ADMIN_OAUTH_STORAGE_KEY);
      router.replace('/login?error=session_expired');
      return;
    }
    setToken(auth.access_token);
    setApiBase(auth.api_base_url ?? fallbackApi);
  }, [router, fallbackApi]);

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
      const [dashRes, svcRes] = await Promise.all([
        fetch(`${apiBase}/admin/tenant/dashboard`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/services`, { headers: authHeaders() }),
      ]);
      if (!dashRes.ok || !svcRes.ok) {
        const body = await dashRes.text().catch(() => '');
        const body2 = await svcRes.text().catch(() => '');
        setStatus(
          `API error (${dashRes.status} / ${svcRes.status}) ${body.slice(0, 120)} ${body2.slice(0, 120)}`,
        );
        return;
      }
      const dashJson = (await dashRes.json()) as DashboardSnapshot;
      const svcJson = (await svcRes.json()) as ServiceRow[];
      setDashboard(dashJson);
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
  }, [apiBase, authHeaders, token]);

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

  function logout(): void {
    sessionStorage.removeItem(ADMIN_OAUTH_STORAGE_KEY);
    router.replace('/login');
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-slate-600">Checking session…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Tenant Admin · Sprint 6.1
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            {dashboard?.tenant_code ? (
              <>
                Municipality <span className="font-mono">{dashboard.tenant_code}</span>
              </>
            ) : (
              <>Signed in</>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="/dashboard/masters"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Masters
          </a>
          <a
            href="/dashboard/operations"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Operations
          </a>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

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
        <p className="text-slate-600">Loading KPIs…</p>
      )}

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
                      <button
                        type="button"
                        className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800"
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
                      </button>
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
    </main>
  );
}

function KpiCard({ title, value }: { title: string; value: number }): JSX.Element {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
    </article>
  );
}
