'use client';

import { AlertBanner, Button, KpiCard } from '@enagar/ui';

import { JsonFallbackPanel } from './json-fallback-panel';
import { StateTenantGrievanceCatalogueSection } from './state-tenant-grievance-catalogue-section';

import type { JSX } from 'react';

export type TenantDetail = {
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
  config: unknown;
  logo_url: string | null;
  active_services_total: number;
  grievances_open: number;
  payments_total: number;
  banners_active: number;
  staff_assignments_total: number;
  recent_audit_logs: Array<{
    id: string;
    action: string;
    actorSubject: string;
    createdAt: string;
  }>;
  warnings: string[];
};

export function StateTenantDetailDrawer({
  tenant,
  api,
  onClose,
  onEdit,
  onImpersonate,
}: {
  tenant: TenantDetail;
  api?: <T>(path: string, init?: RequestInit) => Promise<T>;
  onClose: () => void;
  onEdit: () => void;
  onImpersonate: () => void;
}): JSX.Element {
  const stats: Array<{ label: string; value: number; accent?: 'default' | 'danger' | 'success' }> =
    [
      { label: 'Services', value: tenant.services_total },
      { label: 'Active', value: tenant.active_services_total, accent: 'success' },
      { label: 'Citizens', value: tenant.citizens_total },
      { label: 'Applications', value: tenant.applications_total },
      { label: 'Open grievances', value: tenant.grievances_open, accent: 'danger' },
      { label: 'Payments', value: tenant.payments_total },
      { label: 'Banners', value: tenant.banners_active },
      { label: 'Staff', value: tenant.staff_assignments_total },
    ];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-sidebar/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tenant-drawer-title"
    >
      <button
        type="button"
        className="flex-1 cursor-default"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-warm-border bg-surface shadow-2xl">
        <header className="border-b border-warm-border bg-platform-band/40 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-platform-accent">
                Municipality profile
              </p>
              <h2 id="tenant-drawer-title" className="text-xl font-bold text-ink-primary">
                {tenant.code} · {tenant.name}
              </h2>
              <p className="mt-1 text-sm text-ink-secondary">
                {tenant.district ?? 'No district'} · {tenant.is_active ? 'Active' : 'Inactive'} ·{' '}
                {tenant.ward_count ?? '—'} wards
              </p>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button icon="file-text" type="button" size="sm" variant="secondary" onClick={onEdit}>
              Edit in wizard
            </Button>
            <Button icon="user" type="button" size="sm" onClick={onImpersonate}>
              Impersonate
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tenant.warnings.length ? (
            <AlertBanner tone="warning" title="Health warnings" className="mb-4">
              {tenant.warnings.join(' · ')}
            </AlertBanner>
          ) : null}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map((stat) => (
              <KpiCard
                key={stat.label}
                label={stat.label}
                value={stat.value.toLocaleString()}
                accent={stat.accent}
                className="p-3 text-sm [&_p:first-child]:text-[10px] [&_p:last-child]:text-lg"
              />
            ))}
          </div>

          {api ? <StateTenantGrievanceCatalogueSection tenantCode={tenant.code} api={api} /> : null}

          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-ink-primary">Recent tenant audit</p>
            <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
              {tenant.recent_audit_logs.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-warm-border bg-canvas px-3 py-2"
                >
                  <span className="font-semibold text-ink-primary">{row.action}</span>
                  <span className="block text-ink-secondary">
                    {row.actorSubject} · {new Date(row.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <JsonFallbackPanel
              title="Config JSON (read-only)"
              readOnly
              value={JSON.stringify(tenant.config, null, 2)}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
