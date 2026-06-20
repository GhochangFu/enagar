'use client';

import { Card, KpiCard } from '@enagar/ui';
import Link from 'next/link';

import { DashboardTrendsChart } from './dashboard-trends-chart';

export type PaymentSummaryResponse = {
  period_days: number;
  totals: {
    settled_count: number;
    settled_amount_paise: number;
    pending_count: number;
    failed_count: number;
  };
  by_source: Array<{
    source: 'application' | 'booking' | 'rental' | 'ev' | 'water';
    count: number;
    amount_paise: number;
  }>;
  trends_30d: Array<{ date: string; settled: number; amount_paise: number }>;
};

const SOURCE_LABELS: Record<PaymentSummaryResponse['by_source'][number]['source'], string> = {
  application: 'Application',
  booking: 'Booking',
  rental: 'Rental',
  ev: 'EV',
  water: 'Water',
};

function formatInrFromPaise(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 100_000) {
    return `₹${(rupees / 100_000).toFixed(1)}L`;
  }
  return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function PaymentSummaryPanel({
  summary,
}: {
  summary: PaymentSummaryResponse | null;
}): JSX.Element {
  if (!summary) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-ink-primary">Payment Summary</h2>
        <p className="mt-2 text-sm text-ink-secondary">Loading payment summary…</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary">Payment Summary</h2>
          <p className="text-sm text-ink-secondary">
            Unified ledger — last {summary.period_days} days
          </p>
        </div>
        <Link
          className="text-sm font-semibold text-brand hover:underline"
          href="/dashboard/payments"
        >
          View payment ledger →
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={`Settled (${summary.period_days}d)`} value={summary.totals.settled_count} />
        <KpiCard
          label="Settled amount"
          value={formatInrFromPaise(summary.totals.settled_amount_paise)}
        />
        <KpiCard label="Pending" value={summary.totals.pending_count} />
        <KpiCard label="Failed" value={summary.totals.failed_count} accent="danger" />
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        {summary.by_source.map((row) => (
          <span
            key={row.source}
            className="rounded-full border border-warm-border bg-mint-band/40 px-3 py-1 text-xs font-semibold text-ink-secondary"
          >
            {SOURCE_LABELS[row.source]} · {row.count} · {formatInrFromPaise(row.amount_paise)}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <DashboardTrendsChart rows={summary.trends_30d} dataKey="settled" label="Settled" />
      </div>
    </Card>
  );
}
