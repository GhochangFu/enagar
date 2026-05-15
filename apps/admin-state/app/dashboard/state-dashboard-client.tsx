'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  STATE_OAUTH_STORAGE_KEY,
  type StateOAuthBundle,
} from '../../lib/oauth/session-storage-keys';

type Analytics = Record<
  | 'tenants_total'
  | 'tenants_active'
  | 'services_total'
  | 'citizens_total'
  | 'applications_open'
  | 'grievances_open'
  | 'payments_settled_last_30_days',
  number
>;

type TenantRow = {
  code: string;
  name: string;
  district: string | null;
  ward_count: number | null;
  theme_color: string | null;
  languages_enabled: string[];
  is_active: boolean;
  services_total: number;
  citizens_total: number;
  applications_total: number;
};

type AuditRow = {
  id: string;
  action: string;
  actorSubject: string;
  targetCode: string | null;
  createdAt: string;
};

const tenantTemplate = {
  code: 'NBM',
  name: 'New Barrackpore Municipality',
  district: 'North 24 Pgs',
  ward_count: 20,
  theme_color: '#4F46E5',
  logo_url: null,
  languages_enabled: ['en', 'bn'],
  status: 'active',
  inherit_default_services: true,
  config: {
    default_language: 'bn',
    support_email: 'support@example.gov.in',
  },
};

async function readApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { message?: string | string[] };
    if (typeof json.message === 'string') {
      return json.message;
    }
    if (Array.isArray(json.message)) {
      return json.message.join(', ');
    }
  } catch {
    /* not JSON */
  }
  return text || `HTTP ${response.status}`;
}

function readStoredAuth(): StateOAuthBundle | null {
  const raw = window.sessionStorage.getItem(STATE_OAUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StateOAuthBundle;
    if (!parsed.access_token || parsed.expires_at < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function StateDashboardClient(): JSX.Element {
  const [auth, setAuth] = useState<StateOAuthBundle | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [tenantJson, setTenantJson] = useState(JSON.stringify(tenantTemplate, null, 2));
  const [impersonationTenant, setImpersonationTenant] = useState('KMC');
  const [impersonationReason, setImpersonationReason] = useState(
    'Support verification for tenant admin',
  );
  const [status, setStatus] = useState('Loading state-admin session...');

  useEffect(() => {
    const stored = readStoredAuth();
    setAuth(stored);
    if (!stored) setStatus('Sign in required.');
  }, []);

  const apiBase = useMemo(() => auth?.api_base_url ?? 'http://localhost:3001/api', [auth]);

  const api = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      if (!auth) throw new Error('Missing state-admin session');
      const response = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${auth.access_token}`,
          'content-type': 'application/json',
          ...(init?.headers ?? {}),
        },
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as T;
    },
    [apiBase, auth],
  );

  const refresh = useCallback(async () => {
    if (!auth) return;
    setStatus('Loading state-wide analytics...');
    try {
      const [analyticsRes, tenantsRes, auditRes] = await Promise.all([
        api<Analytics>('/admin/state/analytics'),
        api<TenantRow[]>('/admin/state/tenants'),
        api<AuditRow[]>('/admin/state/audit-logs'),
      ]);
      setAnalytics(analyticsRes);
      setTenants(tenantsRes);
      setAuditLogs(auditRes);
      setStatus(`Loaded ${tenantsRes.length} tenants.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load state-admin data');
    }
  }, [api, auth]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveTenant(): Promise<void> {
    try {
      const payload = JSON.parse(tenantJson) as Record<string, unknown>;
      setStatus('Saving tenant onboarding wizard data...');
      await api<TenantRow>('/admin/state/tenants', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Tenant onboarding failed');
    }
  }

  async function impersonate(): Promise<void> {
    try {
      setStatus('Creating short-lived impersonation token...');
      const result = await api<{ token_id: string; expires_at: string }>(
        '/admin/state/impersonation',
        {
          method: 'POST',
          body: JSON.stringify({ tenant_code: impersonationTenant, reason: impersonationReason }),
        },
      );
      setStatus(`Impersonation token ${result.token_id} expires at ${result.expires_at}.`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Impersonation failed');
    }
  }

  if (!auth) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6">
        <h1 className="text-2xl font-semibold">State Super-Admin Portal</h1>
        <p className="text-sm text-slate-600">{status}</p>
        <a
          className="rounded-lg bg-indigo-700 px-4 py-3 text-center text-sm font-medium text-white"
          href="/login"
        >
          Sign in
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="rounded-2xl bg-indigo-950 p-6 text-white shadow">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200">
          Sprint 6.5 · State Super-Admin
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Platform operations dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">
          Onboard municipalities, supervise tenant health, create audited support impersonation
          tokens, and inspect cross-tenant KPIs from one portal.
        </p>
      </header>

      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        {status}
      </p>

      <section className="grid gap-4 md:grid-cols-4">
        {analytics
          ? Object.entries(analytics).map(([key, value]) => (
              <article
                key={key}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {key.replace(/_/g, ' ')}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
              </article>
            ))
          : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Tenant onboarding wizard JSON</h2>
          <p className="mt-1 text-sm text-slate-600">
            V1 keeps the wizard schema explicit and auditable. Drag-step UX can layer on this API.
          </p>
          <textarea
            className="mt-4 h-96 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs"
            value={tenantJson}
            onChange={(event) => setTenantJson(event.target.value)}
          />
          <button
            className="mt-4 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800"
            type="button"
            onClick={() => void saveTenant()}
          >
            Save tenant
          </button>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Tenant directory</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2">District</th>
                  <th className="px-3 py-2">Services</th>
                  <th className="px-3 py-2">Applications</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.code} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <span className="font-semibold">{tenant.code}</span>
                      <span className="block text-xs text-slate-500">{tenant.name}</span>
                    </td>
                    <td className="px-3 py-2">{tenant.district}</td>
                    <td className="px-3 py-2">{tenant.services_total}</td>
                    <td className="px-3 py-2">{tenant.applications_total}</td>
                    <td className="px-3 py-2">{tenant.is_active ? 'active' : 'inactive'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Audited impersonation</h2>
          <div className="mt-4 grid gap-3">
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={impersonationTenant}
              onChange={(event) => setImpersonationTenant(event.target.value.toUpperCase())}
              placeholder="Tenant code"
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={impersonationReason}
              onChange={(event) => setImpersonationReason(event.target.value)}
              placeholder="Support reason"
            />
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              type="button"
              onClick={() => void impersonate()}
            >
              Create 15-minute token
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Recent audit log</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {auditLogs.map((row) => (
              <li key={row.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <span className="font-semibold">{row.action}</span>
                <span className="ml-2 text-slate-500">{row.targetCode ?? 'state'}</span>
                <span className="block text-xs text-slate-500">
                  {row.actorSubject} · {new Date(row.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
