'use client';

import { Button } from '@enagar/ui';

export type AnalyticsV2 = {
  window: { from: string; to: string };
  totals: {
    applications: number;
    grievances: number;
    payments_settled: number;
    payment_amount_paise: number;
    sla_breached_grievances: number;
  };
  deltas: Record<keyof AnalyticsV2['totals'], number>;
  tenant_slices: Array<{
    tenant_code: string;
    tenant_name: string;
    applications: number;
    grievances: number;
    payments_settled: number;
    sla_breached_grievances: number;
  }>;
  anomaly_hints: string[];
};

const V2_METRICS: Array<{
  key: keyof AnalyticsV2['totals'];
  label: string;
  accent: string;
}> = [
  { key: 'applications', label: 'Applications', accent: 'text-sky-800 bg-sky-50' },
  { key: 'grievances', label: 'Grievances', accent: 'text-rose-800 bg-rose-50' },
  { key: 'payments_settled', label: 'Payments', accent: 'text-teal-800 bg-teal-50' },
  { key: 'payment_amount_paise', label: 'Amount (paise)', accent: 'text-violet-800 bg-violet-50' },
  { key: 'sla_breached_grievances', label: 'SLA breached', accent: 'text-amber-900 bg-amber-50' },
];

export function StateAnalyticsPanel({
  analyticsV2,
  analyticsRange,
  onRangeChange,
  onTenantSelect,
}: {
  analyticsV2: AnalyticsV2;
  analyticsRange: { from: string; to: string };
  onRangeChange: (range: { from: string; to: string }) => void;
  onTenantSelect?: (code: string) => void;
}): JSX.Element {
  const slices = analyticsV2.tenant_slices.slice(0, 8);

  return (
    <section className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-platform-accent">
            Analytics window
          </p>
          <h2 className="text-lg font-semibold text-ink-primary">
            Trends, deltas & top municipalities
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            {new Date(analyticsV2.window.from).toLocaleDateString()} –{' '}
            {new Date(analyticsV2.window.to).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="rounded-xl border border-warm-border bg-canvas px-3 py-2 text-xs"
            placeholder="From (ISO)"
            value={analyticsRange.from}
            onChange={(event) => onRangeChange({ ...analyticsRange, from: event.target.value })}
          />
          <input
            className="rounded-xl border border-warm-border bg-canvas px-3 py-2 text-xs"
            placeholder="To (ISO)"
            value={analyticsRange.to}
            onChange={(event) => onRangeChange({ ...analyticsRange, to: event.target.value })}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {V2_METRICS.map((metric) => (
          <div
            key={metric.key}
            className={['rounded-xl border border-warm-border px-3 py-2.5', metric.accent].join(
              ' ',
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
              {metric.label}
            </p>
            <p className="mt-0.5 text-xl font-bold tabular-nums">
              {analyticsV2.totals[metric.key].toLocaleString()}
            </p>
            <p className="text-[11px] opacity-75">
              Δ {analyticsV2.deltas[metric.key].toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Top municipalities (compact)</p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-warm-border">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-cyan-50/60 text-[10px] uppercase tracking-wide text-ink-secondary">
                <tr>
                  <th className="px-2 py-2">ULB</th>
                  <th className="px-2 py-2">Apps</th>
                  <th className="px-2 py-2">Grv</th>
                  <th className="px-2 py-2">Pay</th>
                  <th className="px-2 py-2">SLA</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {slices.map((row) => (
                  <tr
                    key={row.tenant_code}
                    className="border-t border-warm-border hover:bg-mint-band/30"
                  >
                    <td className="px-2 py-1.5">
                      <span className="font-mono font-semibold text-platform-accent">
                        {row.tenant_code}
                      </span>
                      <span className="ml-1 text-ink-secondary">{row.tenant_name}</span>
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{row.applications}</td>
                    <td className="px-2 py-1.5 tabular-nums">{row.grievances}</td>
                    <td className="px-2 py-1.5 tabular-nums">{row.payments_settled}</td>
                    <td className="px-2 py-1.5 tabular-nums text-rose-700">
                      {row.sla_breached_grievances}
                    </td>
                    <td className="px-2 py-1.5">
                      {onTenantSelect ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onTenantSelect(row.tenant_code)}
                        >
                          View
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink-primary">Anomaly hints</p>
          <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-xs">
            {analyticsV2.anomaly_hints.length ? (
              analyticsV2.anomaly_hints.map((hint) => (
                <li
                  key={hint}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-950"
                >
                  {hint}
                </li>
              ))
            ) : (
              <li className="rounded-lg border border-warm-border px-2 py-1.5 text-ink-secondary">
                No threshold hints for this window.
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
