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

import { StateAnalyticsChart } from './state-analytics-chart';

import type { JSX } from 'react';

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
  accent?: 'default' | 'danger' | 'warning';
}> = [
  { key: 'applications', label: 'Applications' },
  { key: 'grievances', label: 'Grievances' },
  { key: 'payments_settled', label: 'Payments' },
  { key: 'payment_amount_paise', label: 'Amount (paise)' },
  { key: 'sla_breached_grievances', label: 'SLA breached', accent: 'danger' },
];

function isoToDateInput(iso: string): string {
  if (!iso) return '';
  const parsed = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : '';
}

function dateInputToIso(value: string): string {
  if (!value) return '';
  return `${value}T00:00:00.000Z`;
}

function slaBadge(count: number): JSX.Element {
  if (count >= 20) return <Badge tone="danger">{count}</Badge>;
  if (count >= 5) return <Badge tone="warning">{count}</Badge>;
  return <Badge tone="success">{count}</Badge>;
}

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
  const slices = analyticsV2.tenant_slices.slice(0, 12);

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-platform-accent">
              Analytics window
            </p>
            <h2 className="text-lg font-semibold text-ink-primary">
              Trends, deltas &amp; top municipalities
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              {new Date(analyticsV2.window.from).toLocaleDateString()} –{' '}
              {new Date(analyticsV2.window.to).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold uppercase text-ink-secondary">
              From
              <input
                type="date"
                className="mt-1 block rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm"
                value={isoToDateInput(analyticsRange.from)}
                onChange={(event) =>
                  onRangeChange({ ...analyticsRange, from: dateInputToIso(event.target.value) })
                }
              />
            </label>
            <label className="text-xs font-semibold uppercase text-ink-secondary">
              To
              <input
                type="date"
                className="mt-1 block rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm"
                value={isoToDateInput(analyticsRange.to)}
                onChange={(event) =>
                  onRangeChange({ ...analyticsRange, to: dateInputToIso(event.target.value) })
                }
              />
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <StateAnalyticsChart
            applications={analyticsV2.totals.applications}
            grievances={analyticsV2.totals.grievances}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {V2_METRICS.map((metric) => (
              <div
                key={metric.key}
                className="rounded-xl border border-warm-border bg-platform-band/50 p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                  {metric.label}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-ink-primary">
                  {analyticsV2.totals[metric.key].toLocaleString()}
                </p>
                <p className="text-xs text-ink-secondary">
                  Δ {analyticsV2.deltas[metric.key].toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </article>

      <DataTable
        toolbar={
          <>
            <p className="text-sm font-semibold text-ink-primary">Top municipalities</p>
          </>
        }
      >
        <DataTableElement>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>ULB</DataTableHeaderCell>
              <DataTableHeaderCell>Applications</DataTableHeaderCell>
              <DataTableHeaderCell>Grievances</DataTableHeaderCell>
              <DataTableHeaderCell>Payments</DataTableHeaderCell>
              <DataTableHeaderCell>SLA breached</DataTableHeaderCell>
              <DataTableHeaderCell />
            </tr>
          </DataTableHead>
          <DataTableBody>
            {slices.map((row) => (
              <DataTableRow key={row.tenant_code}>
                <DataTableCell>
                  <span className="font-mono text-xs font-semibold text-platform-accent">
                    {row.tenant_code}
                  </span>
                  <span className="ml-2 text-ink-secondary">{row.tenant_name}</span>
                </DataTableCell>
                <DataTableCell>{row.applications.toLocaleString()}</DataTableCell>
                <DataTableCell>{row.grievances.toLocaleString()}</DataTableCell>
                <DataTableCell>{row.payments_settled.toLocaleString()}</DataTableCell>
                <DataTableCell>{slaBadge(row.sla_breached_grievances)}</DataTableCell>
                <DataTableCell>
                  {onTenantSelect ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onTenantSelect(row.tenant_code)}
                    >
                      Open
                    </Button>
                  ) : null}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTableElement>
      </DataTable>
    </section>
  );
}
