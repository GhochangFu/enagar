'use client';

import { Badge, Card, Icon, type IconName } from '@enagar/ui';

import type { CitizenHubDashboardMunicipalityBucket } from '../lib/workspace-types';
import type { JSX } from 'react';

export type HubNavItem<T extends string> = {
  id: T;
  label: string;
  icon: IconName;
};

export type CitizenHubTenant = {
  id: string;
  code: string;
  name: string;
  district: string;
  ward_count: number;
  theme_color: string;
  logo_url: string | null;
  languages_enabled: Array<'en' | 'bn' | 'hi'>;
};

export function CitizenHubNavigation<T extends string>({
  activeTab,
  onSelect,
  tabs,
}: {
  activeTab: T;
  onSelect: (tab: T) => void;
  tabs: readonly HubNavItem<T>[];
}): JSX.Element {
  return (
    <nav
      aria-label="Citizen hub navigation"
      className="sticky top-3 z-20 rounded-[1.6rem] border border-warm-border bg-white/90 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/75"
    >
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-7">
        {tabs.map((tabEntry) => {
          const active = activeTab === tabEntry.id;
          return (
            <button
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
                active
                  ? 'bg-brand text-brand-fg shadow-sm'
                  : 'text-ink-secondary hover:bg-brand-muted hover:text-brand'
              }`}
              key={tabEntry.id}
              onClick={() => onSelect(tabEntry.id)}
              type="button"
            >
              <Icon name={tabEntry.icon} size={18} />
              <span className="max-w-full truncate">{tabEntry.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function HubKpiGrid({ items }: { items: readonly [string, string][] }): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map(([label, value]) => (
        <Card className="bg-white/90 shadow-sm" key={label} padding="sm">
          <span className="text-sm font-semibold text-ink-secondary">{label}</span>
          <strong className="mt-1 block text-3xl font-black text-ink-primary">{value}</strong>
        </Card>
      ))}
    </div>
  );
}

export function PinnedMunicipalityCard({
  bucket,
  catalogue,
  onEnter,
  shortName,
}: {
  bucket: CitizenHubDashboardMunicipalityBucket;
  catalogue: CitizenHubTenant | null;
  onEnter: () => void;
  shortName: string;
}): JSX.Element {
  return (
    <button
      className={`group relative overflow-hidden rounded-[1.75rem] border border-warm-border bg-white p-5 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
        catalogue
          ? 'hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg'
          : 'cursor-not-allowed opacity-60'
      }`}
      disabled={!catalogue}
      onClick={onEnter}
      type="button"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-2"
        style={{ backgroundColor: bucket.theme_color }}
      />
      <span className="mt-4 flex items-start justify-between gap-3">
        <span>
          <span className="block text-2xl font-black text-ink-primary">{bucket.tenant_code}</span>
          <span className="mt-1 block text-sm font-semibold text-ink-secondary">{shortName}</span>
          {catalogue ? (
            <span className="mt-1 block text-xs uppercase tracking-wide text-slate-400">
              {catalogue.district} · {catalogue.ward_count} wards
            </span>
          ) : null}
        </span>
        <span className="rounded-full bg-brand-muted p-2 text-brand transition group-hover:translate-x-0.5">
          <Icon name="chevron-right" size={18} />
        </span>
      </span>
      <span className="mt-5 flex flex-wrap gap-2">
        <Badge tone="brand">Apps {bucket.application_count}</Badge>
        <Badge tone="success">Pay {bucket.payment_count}</Badge>
        <Badge tone="warning">Grv {bucket.grievance_count}</Badge>
      </span>
      {!catalogue ? (
        <span className="mt-4 block text-xs font-semibold text-red-600">
          Tenant missing from picker catalogue.
        </span>
      ) : null}
    </button>
  );
}

export function ApplyMunicipalityCard({
  onEnter,
  tenant,
}: {
  onEnter: () => void;
  tenant: CitizenHubTenant;
}): JSX.Element {
  return (
    <button
      className="group relative overflow-hidden rounded-[1.75rem] border border-warm-border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      onClick={onEnter}
      type="button"
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-2"
        style={{ backgroundColor: tenant.theme_color }}
      />
      <span className="mt-4 flex items-start justify-between gap-3">
        <span>
          <span className="block text-2xl font-black text-ink-primary">{tenant.code}</span>
          <span className="mt-1 block text-sm font-semibold text-ink-secondary">
            {tenant.name.replace(' Municipal', '')}
          </span>
          <span className="mt-1 block text-xs uppercase tracking-wide text-slate-400">
            {tenant.district} - {tenant.ward_count} wards
          </span>
        </span>
        <span className="rounded-full bg-brand-muted p-2 text-brand transition group-hover:translate-x-0.5">
          <Icon name="chevron-right" size={18} />
        </span>
      </span>
      <span className="mt-5 inline-flex rounded-full bg-brand-muted px-3 py-1 text-xs font-black text-brand">
        Enter workspace
      </span>
    </button>
  );
}

export function ApplicationSummaryCard({
  docketNo,
  meta,
  onOpen,
  status,
  tenantCode,
  themeColor,
}: {
  docketNo: string;
  meta: string;
  onOpen: () => void;
  status: string;
  tenantCode: string;
  themeColor: string;
}): JSX.Element {
  return (
    <button
      className="group relative w-full overflow-hidden rounded-3xl border border-warm-border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      onClick={onOpen}
      type="button"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: themeColor }}
      />
      <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-700">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: themeColor }}
        />
        {tenantCode}
      </span>
      <span className="block font-black text-ink-primary">{docketNo}</span>
      <span className="mt-1 block text-sm text-ink-secondary">{meta}</span>
      <span className="mt-3 inline-flex rounded-full bg-brand-muted px-2.5 py-1 text-[11px] font-black text-brand">
        {status}
      </span>
    </button>
  );
}

export function BrowseMunicipalityModal({
  query,
  tenants,
  onChoose,
  onClose,
  onQueryChange,
}: {
  query: string;
  tenants: CitizenHubTenant[];
  onChoose: (tenant: CitizenHubTenant) => void;
  onClose: () => void;
  onQueryChange: (value: string) => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
      <div
        aria-modal="true"
        className="relative mt-8 w-full max-w-3xl rounded-[2rem] bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge tone="brand">Browse</Badge>
            <h3 className="mt-3 text-3xl font-black text-ink-primary">All municipalities</h3>
            <p className="mt-1 text-sm text-ink-secondary">
              Search any operational ULB, then enter its workspace without changing your pins.
            </p>
          </div>
          <button
            className="rounded-full border border-warm-border px-4 py-2 text-sm font-black text-ink-secondary transition hover:border-brand hover:text-brand"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <label className="mt-5 block text-sm font-semibold text-ink-secondary">
          Search by code, name, district
          <input
            className="mt-2 w-full rounded-3xl border border-warm-border px-4 py-3 outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
            onChange={(event) => onQueryChange(event.target.value)}
            type="search"
            value={query}
          />
        </label>
        <ul className="mt-6 grid max-h-[58vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {tenants.map((tenant) => (
            <li key={tenant.code}>
              <button
                className="grid w-full grid-cols-[0.35rem_1fr_auto] items-center gap-3 rounded-3xl border border-warm-border bg-white p-4 text-left transition hover:border-brand/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                onClick={() => onChoose(tenant)}
                type="button"
              >
                <span
                  aria-hidden
                  className="h-full min-h-14 rounded-full"
                  style={{ backgroundColor: tenant.theme_color }}
                />
                <span>
                  <span className="font-black text-ink-primary">{tenant.code}</span>
                  <span className="block text-sm text-ink-secondary">{tenant.name}</span>
                  <span className="block text-[11px] uppercase tracking-wide text-slate-400">
                    {tenant.district}
                  </span>
                </span>
                <span className="text-brand">
                  <Icon name="chevron-right" size={18} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
