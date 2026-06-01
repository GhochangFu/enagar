'use client';

import { KpiCard, type KpiCardAccent } from '@enagar/ui';

import type { JSX } from 'react';

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

const KPI_CARDS: Array<{
  key: keyof Analytics;
  label: string;
  accent?: KpiCardAccent;
}> = [
  { key: 'tenants_total', label: 'Municipalities' },
  { key: 'tenants_active', label: 'Active ULBs', accent: 'success' },
  { key: 'services_total', label: 'Services' },
  { key: 'citizens_total', label: 'Citizens' },
  { key: 'applications_open', label: 'Open applications' },
  { key: 'grievances_open', label: 'Open grievances', accent: 'danger' },
  { key: 'payments_settled_last_30_days', label: 'Payments (30d)' },
];

export function StateKpiStrip({ analytics }: { analytics: Analytics }): JSX.Element {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {KPI_CARDS.map((card) => (
        <KpiCard
          key={card.key}
          label={card.label}
          value={analytics[card.key].toLocaleString()}
          accent={card.accent}
          className="bg-platform-band/60"
        />
      ))}
    </section>
  );
}
