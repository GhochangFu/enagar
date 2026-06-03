'use client';

import { Badge, Button, Card, Icon, type IconName } from '@enagar/ui';

import { serviceCategoryIcon } from '../lib/service-icons';

import type { PaymentApiResponse, ServiceSummary, PwaLocaleCode } from '../lib/workspace-types';
import type { JSX, ReactNode } from 'react';

export type WorkspaceTenant = {
  code: string;
  name: string;
  district: string;
  ward_count: number;
  logo_url: string | null;
};

export type WorkspaceNavItem<T extends string> = {
  id: T;
  label: string;
  icon: IconName;
};

export function WorkspaceHeader({
  actions,
  language,
  metrics,
  onBackToHub,
  onRefresh,
  tenant,
}: {
  actions?: ReactNode;
  language: PwaLocaleCode;
  metrics: readonly [string, string][];
  onBackToHub: () => void;
  onRefresh: () => void;
  tenant: WorkspaceTenant;
}): JSX.Element {
  return (
    <Card
      className="overflow-hidden border-brand-muted bg-brand-surface p-0 shadow-sm"
      padding="none"
    >
      <div className="h-2 bg-brand" />
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-lg font-black text-brand shadow-sm">
              {tenant.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- tenant logos are runtime URLs.
                <img alt="" className="h-full w-full object-cover" src={tenant.logo_url} />
              ) : (
                tenant.code.slice(0, 2)
              )}
            </div>
            <div className="min-w-0">
              <Badge tone="brand">Workspace - {tenant.code}</Badge>
              <h2 className="mt-2 text-3xl font-black leading-tight text-ink-primary">
                {tenant.name}
              </h2>
              <p className="mt-1 text-sm font-semibold text-ink-secondary">
                {tenant.district} - {tenant.ward_count} wards - {language.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon="home" onClick={onBackToHub} size="sm" variant="secondary">
              Back to hub
            </Button>
            <Button icon="refresh" onClick={onRefresh} size="sm" variant="ghost">
              Refresh
            </Button>
          </div>
        </div>
        {actions ? <div className="mt-5">{actions}</div> : null}
        <WorkspaceMetricGrid items={metrics} />
      </div>
    </Card>
  );
}

export function WorkspaceMetricGrid({
  items,
}: {
  items: readonly [string, string][];
}): JSX.Element {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6">
      {items.map(([label, value]) => (
        <div className="rounded-2xl bg-white/82 p-4 shadow-sm" key={label}>
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            {label}
          </span>
          <strong className="mt-1 block text-2xl font-black text-ink-primary">{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceNavigation<T extends string>({
  activeTab,
  onSelect,
  tabs,
}: {
  activeTab: T;
  onSelect: (tab: T) => void;
  tabs: readonly WorkspaceNavItem<T>[];
}): JSX.Element {
  return (
    <nav
      aria-label="Municipality workspace navigation"
      className="sticky top-3 z-20 rounded-[1.6rem] border border-brand-muted bg-white/90 p-2 shadow-sm backdrop-blur"
    >
      <div className="grid grid-cols-3 gap-1 md:grid-cols-6">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
                active
                  ? 'bg-brand text-brand-fg shadow-sm'
                  : 'text-ink-secondary hover:bg-brand-muted hover:text-brand'
              }`}
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              type="button"
            >
              <Icon name={tab.icon} size={18} />
              <span className="max-w-full truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function WorkspaceEmptyState({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}): JSX.Element {
  return (
    <Card className="border-dashed border-brand-muted bg-white/85 text-center" padding="lg">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-muted text-brand">
        <Icon name="inbox" />
      </div>
      <h3 className="mt-4 text-xl font-black text-ink-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-secondary">{children}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

export function ShortcutFilterBanner({
  codes,
  onClear,
}: {
  codes: readonly string[];
  onClear: () => void;
}): JSX.Element {
  return (
    <Card className="col-span-full border-brand-muted bg-brand-muted/45" padding="sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-secondary">
          Showing pinned service shortcut{codes.length > 1 ? 's' : ''}: {codes.join(', ')}.
        </p>
        <Button onClick={onClear} size="sm" variant="secondary">
          Show all services
        </Button>
      </div>
    </Card>
  );
}

export function WorkspaceServiceCard({
  language,
  onApply,
  service,
}: {
  language: PwaLocaleCode;
  onApply: (service: ServiceSummary) => void;
  service: ServiceSummary;
}): JSX.Element {
  const categoryIcon = serviceCategoryIcon(service.category_code);

  return (
    <Card className="flex h-full flex-col bg-white/95 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand"
          >
            <Icon name={categoryIcon} size={20} />
          </div>
          <div className="min-w-0">
            <Badge tone="brand">{service.category_code}</Badge>
            <h3 className="mt-2 text-xl font-bold leading-tight text-ink-primary">
              {service.name[language] ?? service.name.en}
            </h3>
          </div>
        </div>
        {service.popular ? <Badge tone="warning">Popular</Badge> : null}
      </div>
      <p className="mt-3 min-h-12 text-sm leading-6 text-ink-secondary">
        {service.description[language] ?? service.description.en}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <WorkspaceInfo label="Fee" value={service.fee_type} />
        <WorkspaceInfo
          label="SLA"
          value={service.sla_days ? `${service.sla_days} days` : 'Instant'}
        />
        <WorkspaceInfo label="Docs" value={String(service.required_documents.length)} />
        <WorkspaceInfo label="DigiLocker" value={service.pushes_to_digilocker ? 'Yes' : 'No'} />
      </dl>
      <Button
        className="mt-5 w-full"
        data-testid={`apply-service-${service.code}`}
        icon="file-plus"
        onClick={() => onApply(service)}
      >
        Apply
      </Button>
    </Card>
  );
}

function formatPaymentReferenceLabel(payment: PaymentApiResponse): string {
  if (payment.application_id) {
    return `Application ${payment.application_id.slice(0, 13)}…`;
  }
  if (payment.booking_reservation_id) {
    return `Hall booking ${payment.booking_reservation_id.slice(0, 13)}…`;
  }
  return 'Reference unavailable';
}

export function PaymentAttemptCard({
  amount,
  children,
  onStubComplete,
  payment,
  scopeCode,
}: {
  amount: string;
  children?: ReactNode;
  onStubComplete?: (payment: PaymentApiResponse) => void;
  payment: PaymentApiResponse;
  scopeCode: string;
}): JSX.Element {
  const statusTone =
    payment.status === 'settled' ? 'success' : payment.status === 'failed' ? 'danger' : 'warning';
  return (
    <Card className="bg-white/95 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={statusTone}>{payment.status.replace('_', ' ')}</Badge>
          <p className="mt-2 font-mono text-xs text-ink-secondary">{payment.id}</p>
        </div>
        <strong className="text-2xl font-black text-ink-primary">{amount}</strong>
      </div>
      <dl className="mt-4 grid gap-2 text-xs text-ink-secondary md:grid-cols-2">
        <span>{formatPaymentReferenceLabel(payment)}</span>
        <span>Gateway order: {payment.gateway_order_id}</span>
        <span>ULB: {scopeCode}</span>
        <span>Method: {payment.method}</span>
      </dl>
      {payment.status === 'requires_action' && onStubComplete ? (
        <Button className="mt-4 w-full" onClick={() => onStubComplete(payment)}>
          Simulate PSP capture
        </Button>
      ) : null}
      {payment.status === 'failed' ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Payment failed upstream. Retry initiation from My Applications after reading the status
          banner.
        </div>
      ) : null}
      {children}
    </Card>
  );
}

function WorkspaceInfo({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl bg-brand-surface/65 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">{label}</dt>
      <dd className="mt-1 font-black text-ink-primary">{value}</dd>
    </div>
  );
}
