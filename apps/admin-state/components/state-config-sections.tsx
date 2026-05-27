'use client';

import { Button } from '@enagar/ui';

import { pickLabel } from '../lib/state-dashboard-forms';

import { FormField, FormSelect, GuidedFormCard } from './guided-form-primitives';
import { JsonFallbackPanel } from './json-fallback-panel';
import { RecordListItem, RecordListPanel } from './record-list-panel';
import { TenantOnboardingWizard } from './tenant-onboarding-wizard';

import type { IntegrationDraft, LibraryDraft, TenantDraft } from '../lib/state-dashboard-forms';

type TenantRow = {
  code: string;
  name: string;
  district: string | null;
  is_active: boolean;
  services_total: number;
  applications_total: number;
};

type LibraryRow = {
  code: string;
  category_code: string;
  name: unknown;
  lifecycle_status: string;
  library_version: number;
  tenant_adoptions: number;
  default_sla_days: number | null;
};

type IntegrationRow = {
  provider_key: string;
  environment: string;
  status: string;
  owner: string | null;
  last_checked_at: string | null;
};

export function StateTenantSection({
  tenants,
  selectedCode,
  draft,
  tenantJson,
  onSelectTenant,
  onNewTenant,
  onDraftChange,
  onTenantJsonChange,
  onSaveGuided,
  onSaveJson,
  onOpenDetail,
  fetchOnboardingCatalogue,
}: {
  tenants: TenantRow[];
  selectedCode: string | null;
  draft: TenantDraft;
  tenantJson: string;
  onSelectTenant: (code: string) => void;
  onNewTenant: () => void;
  onDraftChange: (draft: TenantDraft) => void;
  onTenantJsonChange: (json: string) => void;
  onSaveGuided: () => void;
  onSaveJson: () => void;
  onOpenDetail: (code: string) => void;
  fetchOnboardingCatalogue: () => Promise<{
    service_categories: Array<{ code: string; name: unknown; published_service_count?: number }>;
    grievance_categories: Array<{ code: string; name: unknown }>;
    published_service_total: number;
  }>;
}): JSX.Element {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(240px,0.85fr)_minmax(0,1.15fr)]">
      <RecordListPanel title="Municipalities" newLabel="New ULB" onNew={onNewTenant}>
        {tenants.map((row) => (
          <RecordListItem
            key={row.code}
            itemKey={row.code}
            selected={selectedCode === row.code}
            title={row.name}
            subtitle={row.district ?? '—'}
            meta={`${row.services_total} services · ${row.applications_total} apps · ${row.is_active ? 'active' : 'inactive'}`}
            onSelect={() => onSelectTenant(row.code)}
          />
        ))}
      </RecordListPanel>

      <div className="space-y-4">
        <TenantOnboardingWizard
          key={selectedCode ?? '__new__'}
          draft={draft}
          onDraftChange={onDraftChange}
          onSave={onSaveGuided}
          fetchCatalogue={fetchOnboardingCatalogue}
          mode={selectedCode ? 'reonboard' : 'new'}
          municipalityCode={selectedCode}
        />

        <article className="rounded-2xl border border-warm-border bg-surface p-4 shadow-sm">
          <p className="text-sm font-semibold text-ink-primary">Directory quick view</p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-warm-border">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-cyan-50/70 text-[10px] uppercase text-ink-secondary">
                <tr>
                  <th className="px-2 py-2">ULB</th>
                  <th className="px-2 py-2">District</th>
                  <th className="px-2 py-2">Svc</th>
                  <th className="px-2 py-2">Apps</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {tenants.map((row) => (
                  <tr key={row.code} className="border-t border-warm-border hover:bg-mint-band/20">
                    <td className="px-2 py-1.5 font-mono font-semibold text-platform-accent">
                      {row.code}
                    </td>
                    <td className="px-2 py-1.5">{row.district}</td>
                    <td className="px-2 py-1.5 tabular-nums">{row.services_total}</td>
                    <td className="px-2 py-1.5 tabular-nums">{row.applications_total}</td>
                    <td className="px-2 py-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onOpenDetail(row.code)}
                      >
                        Profile
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <JsonFallbackPanel
          value={tenantJson}
          onChange={onTenantJsonChange}
          onSave={onSaveJson}
          saveLabel="Save JSON"
        />
      </div>
    </section>
  );
}

export function StateLibrarySection({
  library,
  selectedCode,
  draft,
  libraryJson,
  onSelect,
  onNew,
  onDraftChange,
  onJsonChange,
  onSaveGuided,
  onSaveJson,
  onLifecycle,
}: {
  library: LibraryRow[];
  selectedCode: string | null;
  draft: LibraryDraft;
  libraryJson: string;
  onSelect: (code: string) => void;
  onNew: () => void;
  onDraftChange: (draft: LibraryDraft) => void;
  onJsonChange: (json: string) => void;
  onSaveGuided: () => void;
  onSaveJson: () => void;
  onLifecycle: (code: string, action: 'publish' | 'deprecate') => void;
}): JSX.Element {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(240px,0.85fr)_minmax(0,1.15fr)]">
      <RecordListPanel title="Global templates" newLabel="New template" onNew={onNew}>
        {library.map((row) => (
          <RecordListItem
            key={row.code}
            itemKey={row.code}
            selected={selectedCode === row.code}
            title={pickLabel(row.name)}
            subtitle={`${row.lifecycle_status} · v${row.library_version}`}
            meta={`${row.category_code} · ${row.tenant_adoptions} adoptions`}
            onSelect={() => onSelect(row.code)}
          />
        ))}
      </RecordListPanel>

      <div className="space-y-4">
        <GuidedFormCard
          eyebrow="Service library curator"
          title={selectedCode ? `Edit · ${selectedCode}` : 'New template'}
          saveLabel="Save template"
          onSave={onSaveGuided}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Code"
              value={draft.code}
              onChange={(v) => onDraftChange({ ...draft, code: v })}
            />
            <FormField
              label="Category"
              value={draft.category_code}
              onChange={(v) => onDraftChange({ ...draft, category_code: v })}
            />
            <FormField
              label="Name (EN)"
              value={draft.name_en}
              onChange={(v) => onDraftChange({ ...draft, name_en: v })}
            />
            <FormField
              label="SLA (days)"
              type="number"
              value={draft.default_sla_days}
              onChange={(v) => onDraftChange({ ...draft, default_sla_days: v })}
            />
            <FormField
              label="Workflow"
              value={draft.workflow_pattern}
              onChange={(v) => onDraftChange({ ...draft, workflow_pattern: v })}
            />
            <FormSelect
              label="Lifecycle"
              value={draft.lifecycle_status}
              onChange={(v) => onDraftChange({ ...draft, lifecycle_status: v })}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
                { value: 'deprecated', label: 'Deprecated' },
              ]}
            />
            <FormSelect
              label="Fee type"
              value={draft.fee_type}
              onChange={(v) => onDraftChange({ ...draft, fee_type: v })}
              options={[
                { value: 'fixed', label: 'Fixed' },
                { value: 'slab', label: 'Slab' },
              ]}
            />
            <FormField
              label="Fee (₹)"
              type="number"
              value={draft.fee_amount_rupees}
              onChange={(v) => onDraftChange({ ...draft, fee_amount_rupees: v })}
            />
            <div className="sm:col-span-2">
              <FormField
                label="Description (EN)"
                value={draft.description_en}
                onChange={(v) => onDraftChange({ ...draft, description_en: v })}
              />
            </div>
            <div className="sm:col-span-2">
              <FormField
                label="Curator notes"
                value={draft.curator_notes}
                onChange={(v) => onDraftChange({ ...draft, curator_notes: v })}
              />
            </div>
          </div>
        </GuidedFormCard>

        {selectedCode ? (
          <div className="flex flex-wrap gap-2">
            {(['publish', 'deprecate'] as const).map((action) => (
              <Button
                key={action}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onLifecycle(selectedCode, action)}
              >
                {action}
              </Button>
            ))}
          </div>
        ) : null}

        <JsonFallbackPanel
          value={libraryJson}
          onChange={onJsonChange}
          onSave={onSaveJson}
          saveLabel="Save JSON"
        />
      </div>
    </section>
  );
}

export function StateIntegrationSection({
  integrations,
  selectedKey,
  draft,
  integrationJson,
  onSelect,
  onNew,
  onDraftChange,
  onJsonChange,
  onSaveGuided,
  onSaveJson,
  onCheck,
}: {
  integrations: IntegrationRow[];
  selectedKey: string | null;
  draft: IntegrationDraft;
  integrationJson: string;
  onSelect: (key: string) => void;
  onNew: () => void;
  onDraftChange: (draft: IntegrationDraft) => void;
  onJsonChange: (json: string) => void;
  onSaveGuided: () => void;
  onSaveJson: () => void;
  onCheck: (providerKey: string) => void;
}): JSX.Element {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(240px,0.85fr)_minmax(0,1.15fr)]">
      <RecordListPanel title="Integrations" newLabel="New provider" onNew={onNew}>
        {integrations.map((row) => (
          <RecordListItem
            key={row.provider_key}
            itemKey={row.provider_key}
            selected={selectedKey === row.provider_key}
            title={`${row.environment} · ${row.status}`}
            subtitle={row.owner ?? 'Unassigned owner'}
            meta={row.last_checked_at ? `Checked ${row.last_checked_at}` : 'Never checked'}
            onSelect={() => onSelect(row.provider_key)}
          />
        ))}
      </RecordListPanel>

      <div className="space-y-4">
        <GuidedFormCard
          eyebrow="Integration cockpit"
          title={selectedKey ? `Edit · ${selectedKey}` : 'New integration'}
          saveLabel="Save metadata"
          onSave={onSaveGuided}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Provider key"
              value={draft.provider_key}
              onChange={(v) => onDraftChange({ ...draft, provider_key: v })}
            />
            <FormSelect
              label="Environment"
              value={draft.environment}
              onChange={(v) => onDraftChange({ ...draft, environment: v })}
              options={[
                { value: 'sandbox', label: 'Sandbox' },
                { value: 'uat', label: 'UAT' },
                { value: 'production', label: 'Production' },
              ]}
            />
            <FormSelect
              label="Status"
              value={draft.status}
              onChange={(v) => onDraftChange({ ...draft, status: v })}
              options={[
                { value: 'manual_check_required', label: 'Manual check required' },
                { value: 'ready', label: 'Ready' },
                { value: 'blocked', label: 'Blocked' },
              ]}
            />
            <FormField
              label="Owner"
              value={draft.owner}
              onChange={(v) => onDraftChange({ ...draft, owner: v })}
            />
            <div className="sm:col-span-2">
              <FormField
                label="Notes"
                value={draft.notes}
                onChange={(v) => onDraftChange({ ...draft, notes: v })}
              />
            </div>
            <div className="sm:col-span-2">
              <FormField
                label="Required docs"
                value={draft.required_docs}
                onChange={(v) => onDraftChange({ ...draft, required_docs: v })}
                hint="Comma-separated"
              />
            </div>
          </div>
        </GuidedFormCard>

        {selectedKey ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => onCheck(selectedKey)}>
            Run readiness check
          </Button>
        ) : null}

        <JsonFallbackPanel
          value={integrationJson}
          onChange={onJsonChange}
          onSave={onSaveJson}
          saveLabel="Save JSON"
        />
      </div>
    </section>
  );
}
