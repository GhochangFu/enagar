'use client';

import {
  Badge,
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableElement,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from '@enagar/ui';
import Link from 'next/link';
import { useState } from 'react';

import { pickLabel, countPreviewFormFields } from '../lib/state-dashboard-forms';

import { FormField, FormSelect, GuidedFormCard } from './guided-form-primitives';
import { JsonFallbackPanel } from './json-fallback-panel';
import { RecordListItem, RecordListPanel } from './record-list-panel';
import { SectionNav } from './section-nav';
import { TenantOnboardingWizard } from './tenant-onboarding-wizard';

import type { IntegrationDraft, LibraryDraft, TenantDraft } from '../lib/state-dashboard-forms';
import type { JSX } from 'react';

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
  has_usable_form_schema?: boolean;
};

type IntegrationRow = {
  provider_key: string;
  environment: string;
  status: string;
  owner: string | null;
  last_checked_at: string | null;
};

function lifecycleBadge(status: string): JSX.Element {
  if (status === 'published') return <Badge tone="success">Published</Badge>;
  if (status === 'deprecated') return <Badge tone="danger">Deprecated</Badge>;
  return <Badge tone="warning">Draft</Badge>;
}

function integrationReadiness(status: string): {
  label: string;
  tone: 'success' | 'warning' | 'danger';
} {
  if (status === 'ready') return { label: 'Ready', tone: 'success' };
  if (status === 'blocked') return { label: 'Blocked', tone: 'danger' };
  return { label: 'Partial', tone: 'warning' };
}

type TenantPanelSection = 'wizard' | 'directory' | 'json';

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
    published_services: Array<{
      code: string;
      category_code: string;
      has_usable_form_schema: boolean;
    }>;
  }>;
}): JSX.Element {
  const [section, setSection] = useState<TenantPanelSection>('wizard');
  const [listQuery, setListQuery] = useState('');

  const filteredTenants = tenants.filter((row) => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return true;
    return row.code.toLowerCase().includes(q) || row.name.toLowerCase().includes(q);
  });

  return (
    <section className="grid gap-6 lg:grid-cols-[200px_280px_1fr] xl:grid-cols-[200px_300px_1fr]">
      <SectionNav
        aria-label="Municipality sections"
        items={[
          { id: 'wizard', label: 'Onboarding wizard' },
          { id: 'directory', label: 'Directory table' },
          { id: 'json', label: 'JSON advanced' },
        ]}
        active={section}
        onSelect={setSection}
      />

      <RecordListPanel title="Municipalities" newLabel="New ULB" onNew={onNewTenant}>
        <div className="mb-2 px-1">
          <input
            type="search"
            placeholder="Search ULB…"
            value={listQuery}
            onChange={(event) => setListQuery(event.target.value)}
            className="w-full rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm"
          />
        </div>
        {filteredTenants.map((row) => (
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
        {section === 'wizard' ? (
          <>
            <TenantOnboardingWizard
              key={selectedCode ?? '__new__'}
              draft={draft}
              onDraftChange={onDraftChange}
              onSave={onSaveGuided}
              fetchCatalogue={fetchOnboardingCatalogue}
              mode={selectedCode ? 'reonboard' : 'new'}
              municipalityCode={selectedCode}
            />
            {selectedCode ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onOpenDetail(selectedCode)}
              >
                Open detail drawer
              </Button>
            ) : null}
          </>
        ) : null}

        {section === 'directory' ? (
          <DataTable
            toolbar={
              <>
                <p className="text-sm font-semibold text-ink-primary">ULB directory</p>
              </>
            }
          >
            <DataTableElement>
              <DataTableHead>
                <tr>
                  <DataTableHeaderCell>Code</DataTableHeaderCell>
                  <DataTableHeaderCell>Name</DataTableHeaderCell>
                  <DataTableHeaderCell>District</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  <DataTableHeaderCell />
                </tr>
              </DataTableHead>
              <DataTableBody>
                {filteredTenants.map((row) => (
                  <DataTableRow key={row.code}>
                    <DataTableCell>
                      <span className="font-mono text-xs font-semibold">{row.code}</span>
                    </DataTableCell>
                    <DataTableCell>{row.name}</DataTableCell>
                    <DataTableCell>{row.district ?? '—'}</DataTableCell>
                    <DataTableCell>
                      <Badge tone={row.is_active ? 'success' : 'warning'}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenDetail(row.code)}
                      >
                        Profile
                      </Button>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableElement>
          </DataTable>
        ) : null}

        {section === 'json' ? (
          <JsonFallbackPanel
            value={tenantJson}
            onChange={onTenantJsonChange}
            onSave={onSaveJson}
            saveLabel="Save JSON"
          />
        ) : null}
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
    <section className="grid gap-6 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)]">
      <RecordListPanel title="Global templates" newLabel="New template" onNew={onNew}>
        {library.map((row) => (
          <RecordListItem
            key={row.code}
            itemKey={row.code}
            selected={selectedCode === row.code}
            title={pickLabel(row.name)}
            subtitle={`v${row.library_version} · ${row.category_code}`}
            meta={`${row.tenant_adoptions} adoptions · ${row.has_usable_form_schema ? 'form ready' : 'stub on adopt'}`}
            onSelect={() => onSelect(row.code)}
          />
        ))}
      </RecordListPanel>

      <div className="space-y-4">
        {selectedCode ? (
          <div className="flex flex-wrap items-center gap-2">
            {lifecycleBadge(draft.lifecycle_status)}
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
                { value: '', label: '— Select lifecycle —' },
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
                { value: '', label: '— Select fee type —' },
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
            <div className="sm:col-span-2 rounded-2xl border border-warm-border bg-canvas px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                Citizen apply form
              </p>
              <p className="mt-1 text-sm text-ink-primary">
                {countPreviewFormFields(draft.form_schema_json) > 0
                  ? `Template ready — ${countPreviewFormFields(draft.form_schema_json)} input field(s).`
                  : 'Stub on adopt — onboarding publishes a minimal blank form until you add a template.'}
              </p>
              {selectedCode ? (
                <Link
                  href={`/dashboard/library/${selectedCode}/form`}
                  className="mt-3 inline-flex rounded-xl border border-brand/30 bg-surface px-3 py-2 text-sm font-medium text-brand hover:bg-brand-muted"
                >
                  Edit apply form
                </Link>
              ) : (
                <p className="mt-2 text-xs text-ink-secondary">
                  Save the template code first, then open the visual form editor.
                </p>
              )}
            </div>
          </div>
        </GuidedFormCard>

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
    <section className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((row) => {
          const readiness = integrationReadiness(row.status);
          const selected = selectedKey === row.provider_key;
          return (
            <button
              key={row.provider_key}
              type="button"
              onClick={() => onSelect(row.provider_key)}
              className={[
                'rounded-2xl border p-4 text-left transition',
                selected
                  ? 'border-brand bg-brand-muted shadow-sm'
                  : 'border-warm-border bg-surface hover:bg-platform-band/40',
              ].join(' ')}
            >
              <p className="font-semibold text-ink-primary">{row.provider_key}</p>
              <p className="text-sm text-ink-secondary">{row.environment}</p>
              <Badge tone={readiness.tone} className="mt-3">
                {readiness.label}
              </Badge>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onNew}
          className="rounded-2xl border border-dashed border-warm-border bg-canvas p-4 text-left text-sm font-medium text-ink-secondary hover:border-brand hover:text-brand"
        >
          + Add provider
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.6fr)]">
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

        <div className="space-y-4">
          {selectedKey ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onCheck(selectedKey)}
            >
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
      </div>
    </section>
  );
}
