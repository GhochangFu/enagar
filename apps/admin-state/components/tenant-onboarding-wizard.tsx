'use client';

import { Button } from '@enagar/ui';
import { useEffect, useMemo, useState } from 'react';

import { FormField, FormSelect } from './guided-form-primitives';

import type { TenantDraft } from '../lib/state-dashboard-forms';

type CatalogueOption = {
  code: string;
  name: unknown;
  published_service_count?: number;
};

type OnboardingCatalogue = {
  service_categories: CatalogueOption[];
  grievance_categories: CatalogueOption[];
  published_service_total: number;
};

const STEPS = ['Profile', 'Catalogues', 'Tenant admin', 'Review'] as const;

function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Category';
  }
  return 'Category';
}

export function TenantOnboardingWizard({
  draft,
  onDraftChange,
  onSave,
  fetchCatalogue,
}: {
  draft: TenantDraft;
  onDraftChange: (draft: TenantDraft) => void;
  onSave: () => void;
  fetchCatalogue: () => Promise<OnboardingCatalogue>;
}): JSX.Element {
  const [step, setStep] = useState(0);
  const [catalogue, setCatalogue] = useState<OnboardingCatalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchCatalogue();
        if (!cancelled) {
          setCatalogue(data);
          setCatalogueError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setCatalogueError(error instanceof Error ? error.message : 'Failed to load catalogues');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCatalogue]);

  const adoptedServicePreview = useMemo(() => {
    if (!catalogue) {
      return [];
    }
    return catalogue.service_categories
      .filter((row) => draft.service_category_codes.includes(row.code))
      .map((row) => ({
        code: row.code,
        label: pickLabel(row.name),
        count: row.published_service_count ?? 0,
      }));
  }, [catalogue, draft.service_category_codes]);

  const adoptedServiceTotal = adoptedServicePreview.reduce((sum, row) => sum + row.count, 0);

  function toggleCode(
    field: 'service_category_codes' | 'grievance_category_codes',
    code: string,
  ): void {
    const current = draft[field];
    const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
    onDraftChange({ ...draft, [field]: next });
  }

  function canAdvance(): boolean {
    if (step === 0) {
      return Boolean(
        draft.code.trim() &&
        draft.name.trim() &&
        draft.district.trim() &&
        Number(draft.ward_count) > 0,
      );
    }
    if (step === 1) {
      return draft.service_category_codes.length > 0;
    }
    if (step === 2) {
      return Boolean(draft.tenant_admin_username.trim() && draft.tenant_admin_password.trim());
    }
    return true;
  }

  return (
    <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-platform-accent">
            Tenant onboarding
          </p>
          <h2 className="text-lg font-semibold text-ink-primary">New municipality wizard</h2>
          <p className="mt-1 text-xs text-ink-secondary">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
          >
            Back
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canAdvance()}
            onClick={() => {
              if (step < STEPS.length - 1) {
                if (canAdvance()) {
                  setStep(step + 1);
                }
                return;
              }
              onSave();
            }}
          >
            {step < STEPS.length - 1 ? 'Next' : 'Activate municipality'}
          </Button>
        </div>
      </div>

      {step === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Code"
            value={draft.code}
            onChange={(v) => onDraftChange({ ...draft, code: v.toUpperCase() })}
            hint="e.g. BLYM"
          />
          <FormField
            label="Name"
            value={draft.name}
            onChange={(v) => onDraftChange({ ...draft, name: v })}
          />
          <FormField
            label="District"
            value={draft.district}
            onChange={(v) => onDraftChange({ ...draft, district: v })}
          />
          <FormField
            label="Ward count"
            type="number"
            value={draft.ward_count}
            onChange={(v) => onDraftChange({ ...draft, ward_count: v })}
          />
          <FormField
            label="Theme colour"
            value={draft.theme_color}
            onChange={(v) => onDraftChange({ ...draft, theme_color: v })}
          />
          <FormField
            label="Languages"
            value={draft.languages_enabled}
            onChange={(v) => onDraftChange({ ...draft, languages_enabled: v })}
            hint="Comma-separated: en, bn"
          />
          <FormSelect
            label="Default language"
            value={draft.default_language}
            onChange={(v) => onDraftChange({ ...draft, default_language: v })}
            options={[
              { value: 'en', label: 'English' },
              { value: 'bn', label: 'Bengali' },
            ]}
          />
          <FormField
            label="Support email"
            value={draft.support_email}
            onChange={(v) => onDraftChange({ ...draft, support_email: v })}
          />
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          {catalogueError ? <p className="text-sm text-red-700">{catalogueError}</p> : null}
          <p className="text-sm text-ink-secondary">
            Select categories to adopt <strong>published</strong> global services. Many categories
            does not mean many services — only published templates count (
            {catalogue?.published_service_total ?? '…'} published globally).
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(catalogue?.service_categories ?? []).map((row) => (
              <label
                key={row.code}
                className="flex cursor-pointer items-start gap-2 rounded-xl border border-warm-border px-3 py-2 hover:bg-mint-band/30"
              >
                <input
                  type="checkbox"
                  checked={draft.service_category_codes.includes(row.code)}
                  onChange={() => toggleCode('service_category_codes', row.code)}
                  className="mt-1"
                />
                <span className="text-sm">
                  <span className="font-semibold text-ink-primary">{pickLabel(row.name)}</span>
                  <span className="block font-mono text-xs text-ink-secondary">
                    {row.code} · {row.published_service_count ?? 0} published service(s)
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-sm font-medium text-ink-primary">
            Preview: {adoptedServiceTotal} citizen-visible service(s) from{' '}
            {draft.service_category_codes.length} categor
            {draft.service_category_codes.length === 1 ? 'y' : 'ies'}.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(catalogue?.grievance_categories ?? []).map((row) => (
              <label
                key={row.code}
                className="flex cursor-pointer items-start gap-2 rounded-xl border border-warm-border px-3 py-2 hover:bg-mint-band/30"
              >
                <input
                  type="checkbox"
                  checked={draft.grievance_category_codes.includes(row.code)}
                  onChange={() => toggleCode('grievance_category_codes', row.code)}
                  className="mt-1"
                />
                <span className="text-sm font-semibold text-ink-primary">
                  {pickLabel(row.name)}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Tenant admin username"
            value={draft.tenant_admin_username}
            onChange={(v) =>
              onDraftChange({
                ...draft,
                tenant_admin_username: v.toLowerCase().replace(/\s+/g, ''),
              })
            }
            hint="Defaults to {code}-tenant-admin"
          />
          <FormField
            label="Email"
            value={draft.tenant_admin_email}
            onChange={(v) => onDraftChange({ ...draft, tenant_admin_email: v })}
          />
          <FormField
            label="Temporary password"
            value={draft.tenant_admin_password}
            onChange={(v) => onDraftChange({ ...draft, tenant_admin_password: v })}
            hint="Shown once — share securely with the ULB"
          />
          <FormField
            label="First name"
            value={draft.tenant_admin_first_name}
            onChange={(v) => onDraftChange({ ...draft, tenant_admin_first_name: v })}
          />
          <FormField
            label="Last name"
            value={draft.tenant_admin_last_name}
            onChange={(v) => onDraftChange({ ...draft, tenant_admin_last_name: v })}
          />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3 text-sm text-ink-secondary">
          <p>
            <strong className="text-ink-primary">{draft.name}</strong> ({draft.code}) will be set to{' '}
            <strong className="text-ink-primary">active</strong>. Keycloak user{' '}
            <code className="rounded bg-canvas px-1 font-mono text-xs">
              {draft.tenant_admin_username || `${draft.code.toLowerCase()}-tenant-admin`}
            </code>{' '}
            receives <code className="rounded bg-canvas px-1 font-mono text-xs">tenant_admin</code>.
          </p>
          <ul className="list-inside list-disc">
            {adoptedServicePreview.map((row) => (
              <li key={row.code}>
                {row.label}: {row.count} service(s)
              </li>
            ))}
          </ul>
          <p>
            Grievance categories: {draft.grievance_category_codes.join(', ') || 'none selected'}.
          </p>
        </div>
      ) : null}
    </article>
  );
}
