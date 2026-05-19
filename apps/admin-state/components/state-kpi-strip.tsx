'use client';

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
  hint: string;
  border: string;
  bg: string;
  valueClass: string;
}> = [
  {
    key: 'tenants_total',
    label: 'Municipalities',
    hint: 'Onboarded ULBs',
    border: 'border-l-[#0E7490]',
    bg: 'bg-cyan-50/90',
    valueClass: 'text-[#0E7490]',
  },
  {
    key: 'tenants_active',
    label: 'Active ULBs',
    hint: 'Currently serving citizens',
    border: 'border-l-emerald-600',
    bg: 'bg-emerald-50/90',
    valueClass: 'text-emerald-800',
  },
  {
    key: 'services_total',
    label: 'Services',
    hint: 'Across all tenants',
    border: 'border-l-violet-600',
    bg: 'bg-violet-50/90',
    valueClass: 'text-violet-800',
  },
  {
    key: 'citizens_total',
    label: 'Citizens',
    hint: 'Registered profiles',
    border: 'border-l-sky-600',
    bg: 'bg-sky-50/90',
    valueClass: 'text-sky-900',
  },
  {
    key: 'applications_open',
    label: 'Open applications',
    hint: 'In-flight permits & certs',
    border: 'border-l-amber-600',
    bg: 'bg-amber-50/90',
    valueClass: 'text-amber-900',
  },
  {
    key: 'grievances_open',
    label: 'Open grievances',
    hint: 'Needs resolution',
    border: 'border-l-rose-600',
    bg: 'bg-rose-50/90',
    valueClass: 'text-rose-900',
  },
  {
    key: 'payments_settled_last_30_days',
    label: 'Payments (30d)',
    hint: 'Settled transactions',
    border: 'border-l-teal-700',
    bg: 'bg-teal-50/90',
    valueClass: 'text-teal-900',
  },
];

export function StateKpiStrip({ analytics }: { analytics: Analytics }): JSX.Element {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {KPI_CARDS.map((card) => (
        <article
          key={card.key}
          className={[
            'rounded-2xl border border-warm-border border-l-4 p-4 shadow-sm transition hover:shadow-md',
            card.border,
            card.bg,
          ].join(' ')}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
            {card.label}
          </p>
          <p className={['mt-1 text-3xl font-bold tabular-nums', card.valueClass].join(' ')}>
            {analytics[card.key].toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-ink-secondary">{card.hint}</p>
        </article>
      ))}
    </section>
  );
}
