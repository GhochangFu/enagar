'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { JSX } from 'react';

export function StateAnalyticsChart({
  applications,
  grievances,
}: {
  applications: number;
  grievances: number;
}): JSX.Element {
  const total = applications + grievances;
  if (total <= 0) {
    return <p className="text-sm text-ink-secondary">No activity in this window.</p>;
  }

  const data = [
    { label: 'Apps', value: applications },
    { label: 'Grv', value: grievances },
  ];

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            stroke="rgb(var(--border-warm-rgb))"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: 'rgb(var(--text-muted-rgb))', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'rgb(var(--text-muted-rgb))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid rgb(var(--border-warm-rgb))',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="rgb(var(--brand-rgb))"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
