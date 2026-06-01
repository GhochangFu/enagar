'use client';

import {
  AlertBanner,
  Badge,
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableElement,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  OperatorAppFooter,
  PageHeader,
  ToastProvider,
  useToast,
} from '@enagar/ui';
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
  tenantDraftForReonboard,
  tenantDraftToPayload,
  tenantRowToDraft,
  type TenantOnboardingContext,
  type IntegrationDraft,
  type LibraryDraft,
  type TenantDraft,
} from '../../lib/state-dashboard-forms';

import type { StateAdminSearchHit } from '../../lib/state-admin-search';

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
  form_schema: unknown;
  has_usable_form_schema: boolean;
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

const TAB_COPY: Record<DashboardTab, { title: string; subtitle: string }> = {
  overview: {
    title: 'Platform operations dashboard',
    subtitle: 'Statewide KPIs, municipality health, and cross-tenant analytics.',
  },
  tenants: {
    title: 'Municipality directory',
    subtitle: 'Onboard ULBs, re-publish catalogues, and inspect health.',
  },
  library: {
    title: 'Service library curator',
    subtitle: 'Publish form schemas and workflow seeds for tenant adoption.',
  },
  grievanceLibrary: {
    title: 'Grievance catalogue',
    subtitle: 'Global categories and subtypes seeded to tenant desks.',
  },
  integrations: {
    title: 'Integration cockpit',
    subtitle: 'Provider readiness, owners, and last-checked status.',
  },
  security: {
    title: 'Audit & access controls',
    subtitle: 'Audited impersonation and searchable platform audit log.',
  },
};

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
  return (
    <ToastProvider>
      <StateDashboardClientInner />
    </ToastProvider>
  );
}

function StateDashboardClientInner(): JSX.Element {
  const { toast } = useToast();
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
      const message = error instanceof Error ? error.message : 'Failed to load state-admin data';
      setStatus(message);
      toast(message, 'danger');
    }
  }, [api, auth, auditFilters, analyticsRange, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function selectTenantForEdit(code: string): Promise<void> {
    const row = tenants.find((item) => item.code === code);
    if (!row) return;
    setActiveTab('tenants');
    setStatus(`Loading re-onboard context for ${code}…`);
    try {
      const context = await api<TenantOnboardingContext>(
        `/admin/state/tenants/${encodeURIComponent(code)}/onboarding-context`,
      );
      const draft = tenantDraftForReonboard(row, context);
      setSelectedTenantCode(code);
      setTenantDraft(draft);
      setTenantJson(JSON.stringify(tenantDraftToPayload(draft), null, 2));
      setStatus(`Re-onboard ${code} — update catalogues, tenant admin, and services.`);
    } catch (error) {
      const draft = tenantRowToDraft(row);
      setSelectedTenantCode(code);
      setTenantDraft(draft);
      setTenantJson(JSON.stringify(tenantDraftToPayload(draft), null, 2));
      setStatus(
        error instanceof Error
          ? `${error.message} (showing basic profile only)`
          : 'Failed to load onboarding context',
      );
    }
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
      const payload = tenantDraftToPayload({
        ...tenantDraft,
        status: selectedTenantCode ? tenantDraft.status : 'active',
        inherit_default_services:
          tenantDraft.service_category_codes.length > 0
            ? 'false'
            : tenantDraft.inherit_default_services,
        tenant_admin_username:
          tenantDraft.tenant_admin_username.trim() ||
          `${tenantDraft.code.trim().toLowerCase()}-tenant-admin`,
      });
      setTenantJson(JSON.stringify(payload, null, 2));
      setStatus(
        selectedTenantCode
          ? `Applying onboarding for ${tenantDraft.code}…`
          : 'Activating municipality…',
      );
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
      const message = error instanceof Error ? error.message : 'Tenant profile failed';
      setStatus(message);
      toast(message, 'danger');
    }
  }

  const handleSearchHit = useCallback(
    (hit: StateAdminSearchHit) => {
      if (hit.kind === 'tenant') {
        setActiveTab('tenants');
        void openTenantDetail(hit.code);
        return;
      }
      if (hit.kind === 'library') {
        setActiveTab('library');
        selectLibraryForEdit(hit.code);
        toast(`Opened template ${hit.code}.`, 'info');
        return;
      }
      setActiveTab('security');
      setAuditFilters((prev) => ({ ...prev, actor: hit.actor }));
      toast(`Filtering audit log by ${hit.actor}.`, 'info');
    },
    [toast],
  );

  const tabCopy = TAB_COPY[activeTab];

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
      searchCatalogue={{ tenants, library }}
      onSearchHit={handleSearchHit}
    >
      <StateDashboardTheme />
      {drawerTenant ? (
        <StateTenantDetailDrawer
          tenant={drawerTenant}
          api={api}
          onClose={() => setDrawerTenant(null)}
          onEdit={() => {
            void selectTenantForEdit(drawerTenant.code);
            setDrawerTenant(null);
          }}
          onImpersonate={() => {
            setImpersonationTenant(drawerTenant.code);
            setActiveTab('security');
            void impersonate();
          }}
        />
      ) : null}

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-6">
        <PageHeader
          tenantBar
          className="[&_p:first-child]:text-platform-accent"
          eyebrow="West Bengal · State operations"
          title={tabCopy.title}
          subtitle={tabCopy.subtitle}
          actions={
            activeTab === 'overview' ? (
              <Button type="button" size="sm" onClick={() => void refresh()}>
                Refresh data
              </Button>
            ) : undefined
          }
        />

        {activeTab === 'overview' && analyticsV2?.anomaly_hints.length ? (
          <AlertBanner tone="warning" title="Anomaly hints">
            {analyticsV2.anomaly_hints.join(' · ')}
          </AlertBanner>
        ) : null}

        {activeTab === 'security' && auditCoverage?.missing_actions.length ? (
          <AlertBanner tone="info" title="Audit coverage gap">
            Missing actions: {auditCoverage.missing_actions.join(', ')}
          </AlertBanner>
        ) : null}

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
            onSelectTenant={(code) => void selectTenantForEdit(code)}
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
          <section className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-ink-primary">Audited impersonation</h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  15-minute support token with audit trail.
                </p>
                <AlertBanner tone="warning" className="mt-4">
                  Creates a short-lived token — action is logged.
                </AlertBanner>
                <div className="mt-4 grid gap-3">
                  <label className="text-xs font-semibold uppercase text-ink-secondary">
                    Tenant code
                    <input
                      className="mt-1 w-full rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm normal-case"
                      value={impersonationTenant}
                      onChange={(event) => setImpersonationTenant(event.target.value.toUpperCase())}
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase text-ink-secondary">
                    Reason
                    <input
                      className="mt-1 w-full rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm normal-case"
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
                <h2 className="text-lg font-semibold text-ink-primary">Coverage summary</h2>
                <p className="mt-1 text-sm text-ink-secondary">Required vs covered audit actions</p>
                {auditCoverage ? (
                  <ul className="mt-4 space-y-2 text-sm">
                    {auditCoverage.required_actions.map((action) => {
                      const covered = auditCoverage.covered_actions.includes(action);
                      return (
                        <li key={action} className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs">{action}</span>
                          <Badge tone={covered ? 'success' : 'danger'}>
                            {covered ? 'OK' : 'Missing'}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </article>
            </div>

            <DataTable
              toolbar={
                <>
                  <p className="text-sm font-semibold text-ink-primary">Audit log</p>
                  <input
                    className="rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm"
                    placeholder="Actor"
                    value={auditFilters.actor}
                    onChange={(event) =>
                      setAuditFilters((prev) => ({ ...prev, actor: event.target.value }))
                    }
                  />
                  <input
                    className="rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm"
                    placeholder="Action"
                    value={auditFilters.action}
                    onChange={(event) =>
                      setAuditFilters((prev) => ({ ...prev, action: event.target.value }))
                    }
                  />
                  <input
                    className="rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm"
                    placeholder="Tenant"
                    value={auditFilters.tenant_code}
                    onChange={(event) =>
                      setAuditFilters((prev) => ({ ...prev, tenant_code: event.target.value }))
                    }
                  />
                  <Button
                    icon="receipt"
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void exportAuditCsv()}
                  >
                    Export CSV
                  </Button>
                </>
              }
            >
              <DataTableElement>
                <DataTableHead>
                  <tr>
                    <DataTableHeaderCell>Time</DataTableHeaderCell>
                    <DataTableHeaderCell>Action</DataTableHeaderCell>
                    <DataTableHeaderCell>Actor</DataTableHeaderCell>
                    <DataTableHeaderCell>Target</DataTableHeaderCell>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {auditLogs.map((row) => (
                    <DataTableRow key={row.id}>
                      <DataTableCell>{new Date(row.createdAt).toLocaleString()}</DataTableCell>
                      <DataTableCell>{row.action}</DataTableCell>
                      <DataTableCell>{row.actorSubject}</DataTableCell>
                      <DataTableCell>{row.targetCode ?? 'state'}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTableElement>
            </DataTable>
            {auditCursor ? (
              <div className="flex justify-center">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void loadMoreAudit()}
                >
                  Load more
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}
        <OperatorAppFooter operatorHelpHref="/help/operator-help-admin-state.html" />
      </main>
    </StateAdminShell>
  );
}
