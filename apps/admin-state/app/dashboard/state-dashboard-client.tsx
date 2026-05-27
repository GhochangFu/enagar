'use client';

import { Button, OperatorAppFooter, PageHeader } from '@enagar/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { StateAdminShell } from '../../components/state-admin-shell';
import { StateAnalyticsPanel, type AnalyticsV2 } from '../../components/state-analytics-panel';
import {
  StateIntegrationSection,
  StateLibrarySection,
  StateTenantSection,
} from '../../components/state-config-sections';
import { StateDashboardTheme } from '../../components/state-dashboard-theme';
import { StateGrievanceLibraryPanel } from '../../components/state-grievance-library-panel';
import { StateKpiStrip } from '../../components/state-kpi-strip';
import {
  StateTenantDetailDrawer,
  type TenantDetail,
} from '../../components/state-tenant-detail-drawer';
import {
  STATE_OAUTH_STORAGE_KEY,
  type StateOAuthBundle,
} from '../../lib/oauth/session-storage-keys';
import { type StateAdminTabId } from '../../lib/state-admin-nav';
import {
  EMPTY_INTEGRATION_DRAFT,
  EMPTY_LIBRARY_DRAFT,
  EMPTY_TENANT_DRAFT,
  integrationDraftToPayload,
  integrationRowToDraft,
  libraryDraftToPayload,
  libraryRowToDraft,
  tenantDraftToPayload,
  tenantRowToDraft,
  type IntegrationDraft,
  type LibraryDraft,
  type TenantDraft,
} from '../../lib/state-dashboard-forms';

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
  actorRole: string;
  targetCode: string | null;
  metadata: unknown;
  createdAt: string;
};

type AuditPage = {
  rows: AuditRow[];
  next_cursor: string | null;
};

type GlobalServiceTemplateRow = {
  code: string;
  category_code: string;
  name: unknown;
  lifecycle_status: string;
  library_version: number;
  tenant_adoptions: number;
  default_sla_days: number | null;
  curator_notes: string | null;
};

type IntegrationRow = {
  provider_key: string;
  environment: string;
  status: string;
  owner: string | null;
  notes: string | null;
  readiness: unknown;
  last_checked_at: string | null;
};

type AuditCoverage = {
  covered_actions: string[];
  required_actions: string[];
  missing_actions: string[];
};

type DashboardTab = StateAdminTabId;

async function readApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { message?: string | string[] };
    if (typeof json.message === 'string') return json.message;
    if (Array.isArray(json.message)) return json.message.join(', ');
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
    if (!parsed.access_token || parsed.expires_at < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function queryString(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export function StateDashboardClient(): JSX.Element {
  const [auth, setAuth] = useState<StateOAuthBundle | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsV2, setAnalyticsV2] = useState<AnalyticsV2 | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState({ from: '', to: '' });
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditFilters, setAuditFilters] = useState({
    actor: '',
    action: '',
    tenant_code: '',
    from: '',
    to: '',
  });
  const [drawerTenant, setDrawerTenant] = useState<TenantDetail | null>(null);
  const [tenantDraft, setTenantDraft] = useState<TenantDraft>(EMPTY_TENANT_DRAFT);
  const [selectedTenantCode, setSelectedTenantCode] = useState<string | null>(null);
  const [tenantJson, setTenantJson] = useState(
    JSON.stringify(tenantDraftToPayload(EMPTY_TENANT_DRAFT), null, 2),
  );
  const [library, setLibrary] = useState<GlobalServiceTemplateRow[]>([]);
  const [libraryDraft, setLibraryDraft] = useState<LibraryDraft>(EMPTY_LIBRARY_DRAFT);
  const [selectedLibraryCode, setSelectedLibraryCode] = useState<string | null>(null);
  const [libraryJson, setLibraryJson] = useState(
    JSON.stringify(libraryDraftToPayload(EMPTY_LIBRARY_DRAFT), null, 2),
  );
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [integrationDraft, setIntegrationDraft] =
    useState<IntegrationDraft>(EMPTY_INTEGRATION_DRAFT);
  const [selectedIntegrationKey, setSelectedIntegrationKey] = useState<string | null>(null);
  const [integrationJson, setIntegrationJson] = useState(
    JSON.stringify(integrationDraftToPayload(EMPTY_INTEGRATION_DRAFT), null, 2),
  );
  const [auditCoverage, setAuditCoverage] = useState<AuditCoverage | null>(null);
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
      if (!response.ok) throw new Error(await readApiError(response));
      return (await response.json()) as T;
    },
    [apiBase, auth],
  );

  const refresh = useCallback(async () => {
    if (!auth) return;
    setStatus('Loading state-wide analytics...');
    try {
      const [
        analyticsRes,
        analyticsV2Res,
        tenantsRes,
        auditRes,
        libraryRes,
        integrationsRes,
        auditCoverageRes,
      ] = await Promise.all([
        api<Analytics>('/admin/state/analytics'),
        api<AnalyticsV2>(`/admin/state/analytics/v2${queryString(analyticsRange)}`),
        api<TenantRow[]>('/admin/state/tenants'),
        api<AuditPage>(`/admin/state/audit-logs${queryString({ ...auditFilters, limit: '25' })}`),
        api<GlobalServiceTemplateRow[]>('/admin/state/global-service-library'),
        api<IntegrationRow[]>('/admin/state/integrations'),
        api<AuditCoverage>('/admin/state/audit-coverage'),
      ]);
      setAnalytics(analyticsRes);
      setAnalyticsV2(analyticsV2Res);
      setTenants(tenantsRes);
      setAuditLogs(auditRes.rows);
      setAuditCursor(auditRes.next_cursor);
      setLibrary(libraryRes);
      setIntegrations(integrationsRes);
      setAuditCoverage(auditCoverageRes);
      setStatus(`Loaded ${tenantsRes.length} municipalities.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load state-admin data');
    }
  }, [api, auth, auditFilters, analyticsRange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function selectTenantForEdit(code: string): void {
    const row = tenants.find((item) => item.code === code);
    if (!row) return;
    const draft = tenantRowToDraft(row);
    setSelectedTenantCode(code);
    setTenantDraft(draft);
    setTenantJson(JSON.stringify(tenantDraftToPayload(draft), null, 2));
    setActiveTab('tenants');
  }

  function newTenant(): void {
    setActiveTab('tenants');
    setSelectedTenantCode(null);
    setTenantDraft(EMPTY_TENANT_DRAFT);
    setTenantJson(JSON.stringify(tenantDraftToPayload(EMPTY_TENANT_DRAFT), null, 2));
    setStatus('New municipality — complete the onboarding wizard and activate.');
  }

  function selectLibraryForEdit(code: string): void {
    const row = library.find((item) => item.code === code);
    if (!row) return;
    const draft = libraryRowToDraft(row);
    setSelectedLibraryCode(code);
    setLibraryDraft(draft);
    setLibraryJson(JSON.stringify(libraryDraftToPayload(draft), null, 2));
  }

  function newLibraryTemplate(): void {
    setSelectedLibraryCode(null);
    setLibraryDraft(EMPTY_LIBRARY_DRAFT);
    setLibraryJson(JSON.stringify(libraryDraftToPayload(EMPTY_LIBRARY_DRAFT), null, 2));
  }

  function selectIntegrationForEdit(key: string): void {
    const row = integrations.find((item) => item.provider_key === key);
    if (!row) return;
    const draft = integrationRowToDraft(row);
    setSelectedIntegrationKey(key);
    setIntegrationDraft(draft);
    setIntegrationJson(JSON.stringify(integrationDraftToPayload(draft), null, 2));
  }

  function newIntegration(): void {
    setSelectedIntegrationKey(null);
    setIntegrationDraft(EMPTY_INTEGRATION_DRAFT);
    setIntegrationJson(JSON.stringify(integrationDraftToPayload(EMPTY_INTEGRATION_DRAFT), null, 2));
  }

  async function saveTenantFromJson(): Promise<void> {
    try {
      const payload = JSON.parse(tenantJson) as Record<string, unknown>;
      setStatus('Saving municipality (JSON)...');
      await api<TenantRow>('/admin/state/tenants', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Tenant save failed');
    }
  }

  async function saveTenantGuided(): Promise<void> {
    try {
      const activating = !selectedTenantCode;
      const payload = tenantDraftToPayload({
        ...tenantDraft,
        status: activating ? 'active' : tenantDraft.status,
        tenant_admin_username:
          tenantDraft.tenant_admin_username.trim() ||
          `${tenantDraft.code.trim().toLowerCase()}-tenant-admin`,
      });
      setTenantJson(JSON.stringify(payload, null, 2));
      setStatus('Saving municipality...');
      await api<TenantRow>('/admin/state/tenants', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSelectedTenantCode(tenantDraft.code.trim().toUpperCase());
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Tenant save failed');
    }
  }

  async function saveLibraryFromJson(): Promise<void> {
    try {
      const payload = JSON.parse(libraryJson) as Record<string, unknown>;
      setStatus('Saving template (JSON)...');
      await api<GlobalServiceTemplateRow>('/admin/state/global-service-library', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Library save failed');
    }
  }

  async function saveLibraryGuided(): Promise<void> {
    try {
      const payload = libraryDraftToPayload(libraryDraft);
      setLibraryJson(JSON.stringify(payload, null, 2));
      setStatus('Saving global template...');
      await api<GlobalServiceTemplateRow>('/admin/state/global-service-library', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSelectedLibraryCode(libraryDraft.code);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Library save failed');
    }
  }

  async function updateLibraryLifecycle(
    code: string,
    action: 'publish' | 'deprecate',
  ): Promise<void> {
    try {
      setStatus(`${action} ${code}...`);
      await api<GlobalServiceTemplateRow>('/admin/state/global-service-library/lifecycle', {
        method: 'POST',
        body: JSON.stringify({ code, action }),
      });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Lifecycle update failed');
    }
  }

  async function saveIntegrationFromJson(): Promise<void> {
    try {
      const payload = JSON.parse(integrationJson) as Record<string, unknown>;
      setStatus('Saving integration (JSON)...');
      await api<IntegrationRow>('/admin/state/integrations', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Integration save failed');
    }
  }

  async function saveIntegrationGuided(): Promise<void> {
    try {
      const payload = integrationDraftToPayload(integrationDraft);
      setIntegrationJson(JSON.stringify(payload, null, 2));
      setStatus('Saving integration metadata...');
      await api<IntegrationRow>('/admin/state/integrations', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSelectedIntegrationKey(integrationDraft.provider_key);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Integration save failed');
    }
  }

  async function checkIntegration(providerKey: string): Promise<void> {
    try {
      setStatus(`Checking ${providerKey}...`);
      await api<IntegrationRow>(`/admin/state/integrations/${providerKey}/check`, {
        method: 'POST',
      });
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Integration check failed');
    }
  }

  async function impersonate(): Promise<void> {
    try {
      setStatus('Creating impersonation token...');
      const result = await api<{ token_id: string; expires_at: string }>(
        '/admin/state/impersonation',
        {
          method: 'POST',
          body: JSON.stringify({ tenant_code: impersonationTenant, reason: impersonationReason }),
        },
      );
      setStatus(`Token ${result.token_id} expires ${result.expires_at}.`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Impersonation failed');
    }
  }

  async function loadMoreAudit(): Promise<void> {
    if (!auditCursor) return;
    try {
      const page = await api<AuditPage>(
        `/admin/state/audit-logs${queryString({ ...auditFilters, cursor: auditCursor, limit: '25' })}`,
      );
      setAuditLogs((prev) => [...prev, ...page.rows]);
      setAuditCursor(page.next_cursor);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Audit pagination failed');
    }
  }

  async function exportAuditCsv(): Promise<void> {
    if (!auth) return;
    const response = await fetch(
      `${apiBase}/admin/state/audit-logs.csv${queryString(auditFilters)}`,
      { headers: { authorization: `Bearer ${auth.access_token}` } },
    );
    if (!response.ok) {
      setStatus(await readApiError(response));
      return;
    }
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'state-audit-logs.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    setStatus('Audit CSV exported.');
  }

  async function openTenantDetail(code: string): Promise<void> {
    try {
      setStatus(`Loading ${code} profile...`);
      const detail = await api<TenantDetail>(`/admin/state/tenants/${encodeURIComponent(code)}`);
      setDrawerTenant(detail);
      setImpersonationTenant(detail.code);
      setStatus(`Opened ${detail.code} profile.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Tenant profile failed');
    }
  }

  if (!auth) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 bg-canvas px-6">
        <StateDashboardTheme />
        <h1 className="text-2xl font-bold text-ink-primary">State Super-Admin Portal</h1>
        <p className="text-sm text-ink-secondary">{status}</p>
        <Link href="/login" className="inline-flex">
          <Button type="button">Sign in</Button>
        </Link>
      </main>
    );
  }

  return (
    <StateAdminShell
      activeTab={activeTab}
      onRefresh={() => void refresh()}
      onSelectTab={setActiveTab}
    >
      <StateDashboardTheme />
      {drawerTenant ? (
        <StateTenantDetailDrawer
          tenant={drawerTenant}
          api={api}
          onClose={() => setDrawerTenant(null)}
          onEdit={() => {
            selectTenantForEdit(drawerTenant.code);
            setDrawerTenant(null);
          }}
          onImpersonate={() => {
            setImpersonationTenant(drawerTenant.code);
            setActiveTab('security');
            void impersonate();
          }}
        />
      ) : null}

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6">
        <PageHeader
          tenantBar
          eyebrow="West Bengal · State operations"
          title="Platform operations dashboard"
          subtitle="Statewide KPIs, municipality onboarding, global service templates, and audited cross-tenant controls."
        />

        <p className="rounded-2xl border border-warm-border bg-brand-muted/40 px-4 py-3 text-sm font-medium text-ink-secondary shadow-sm">
          {status}
        </p>

        {activeTab === 'overview' ? (
          <div className="space-y-6">
            {analytics ? <StateKpiStrip analytics={analytics} /> : null}
            {analyticsV2 ? (
              <StateAnalyticsPanel
                analyticsV2={analyticsV2}
                analyticsRange={analyticsRange}
                onRangeChange={setAnalyticsRange}
                onTenantSelect={(code) => void openTenantDetail(code)}
              />
            ) : null}
          </div>
        ) : null}

        {activeTab === 'tenants' ? (
          <StateTenantSection
            tenants={tenants}
            selectedCode={selectedTenantCode}
            draft={tenantDraft}
            tenantJson={tenantJson}
            onSelectTenant={selectTenantForEdit}
            onNewTenant={newTenant}
            onDraftChange={setTenantDraft}
            onTenantJsonChange={setTenantJson}
            onSaveGuided={() => void saveTenantGuided()}
            onSaveJson={() => void saveTenantFromJson()}
            onOpenDetail={(code) => void openTenantDetail(code)}
            fetchOnboardingCatalogue={() => api('/admin/state/onboarding/catalogue')}
          />
        ) : null}

        {activeTab === 'library' ? (
          <StateLibrarySection
            library={library}
            selectedCode={selectedLibraryCode}
            draft={libraryDraft}
            libraryJson={libraryJson}
            onSelect={selectLibraryForEdit}
            onNew={newLibraryTemplate}
            onDraftChange={setLibraryDraft}
            onJsonChange={setLibraryJson}
            onSaveGuided={() => void saveLibraryGuided()}
            onSaveJson={() => void saveLibraryFromJson()}
            onLifecycle={(code, action) => void updateLibraryLifecycle(code, action)}
          />
        ) : null}

        {activeTab === 'grievanceLibrary' ? <StateGrievanceLibraryPanel api={api} /> : null}

        {activeTab === 'integrations' ? (
          <StateIntegrationSection
            integrations={integrations}
            selectedKey={selectedIntegrationKey}
            draft={integrationDraft}
            integrationJson={integrationJson}
            onSelect={selectIntegrationForEdit}
            onNew={newIntegration}
            onDraftChange={setIntegrationDraft}
            onJsonChange={setIntegrationJson}
            onSaveGuided={() => void saveIntegrationGuided()}
            onSaveJson={() => void saveIntegrationFromJson()}
            onCheck={(key) => void checkIntegration(key)}
          />
        ) : null}

        {activeTab === 'security' ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-ink-primary">Audited impersonation</h2>
              <p className="mt-1 text-sm text-ink-secondary">
                15-minute support token with audit trail.
              </p>
              <div className="mt-4 grid gap-3">
                <label className="text-xs font-semibold uppercase text-ink-secondary">
                  Tenant code
                  <input
                    className="mt-1 w-full rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm"
                    value={impersonationTenant}
                    onChange={(event) => setImpersonationTenant(event.target.value.toUpperCase())}
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-ink-secondary">
                  Reason
                  <input
                    className="mt-1 w-full rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm"
                    value={impersonationReason}
                    onChange={(event) => setImpersonationReason(event.target.value)}
                  />
                </label>
                <Button icon="user" type="button" onClick={() => void impersonate()}>
                  Create 15-minute token
                </Button>
              </div>
            </article>

            <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink-primary">Audit log search</h2>
                  <p className="mt-1 text-sm text-ink-secondary">
                    Filter, paginate, and export events.
                  </p>
                </div>
                <Button
                  icon="receipt"
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void exportAuditCsv()}
                >
                  Export CSV
                </Button>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {(
                  [
                    ['actor', 'Actor'],
                    ['action', 'Action'],
                    ['tenant_code', 'Tenant'],
                    ['from', 'From'],
                    ['to', 'To'],
                  ] as Array<[keyof typeof auditFilters, string]>
                ).map(([key, label]) => (
                  <label key={key} className="text-xs font-semibold uppercase text-ink-secondary">
                    {label}
                    <input
                      className="mt-1 w-full rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm normal-case"
                      value={auditFilters[key]}
                      onChange={(event) =>
                        setAuditFilters((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
              <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto text-sm">
                {auditLogs.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-warm-border bg-canvas px-3 py-2"
                  >
                    <span className="font-semibold text-ink-primary">{row.action}</span>
                    <span className="ml-2 text-ink-secondary">{row.targetCode ?? 'state'}</span>
                    <span className="block text-xs text-ink-secondary">
                      {row.actorSubject} · {new Date(row.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
              {auditCursor ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-4"
                  onClick={() => void loadMoreAudit()}
                >
                  Load more
                </Button>
              ) : null}
              {auditCoverage ? (
                <div className="mt-4 rounded-xl border border-warm-border bg-canvas p-3 text-xs">
                  <p className="font-semibold text-ink-primary">Audit coverage</p>
                  <p className="mt-1 text-ink-secondary">
                    {auditCoverage.covered_actions.length}/{auditCoverage.required_actions.length}{' '}
                    actions
                  </p>
                  {auditCoverage.missing_actions.length ? (
                    <p className="mt-1 text-amber-800">
                      Missing: {auditCoverage.missing_actions.join(', ')}
                    </p>
                  ) : (
                    <p className="mt-1 text-emerald-700">All required actions observed.</p>
                  )}
                </div>
              ) : null}
            </article>
          </section>
        ) : null}
        <OperatorAppFooter />
      </main>
    </StateAdminShell>
  );
}
