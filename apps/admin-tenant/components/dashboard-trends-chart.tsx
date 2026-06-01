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

export function DashboardTrendsChart({
  rows,
}: {
  rows: Array<{ date: string; submitted: number }>;
}): JSX.Element {
  const data = rows.map((row) => ({
    date: row.date.slice(5),
    submitted: row.submitted,
  }));

  if (!data.length) {
    return <p className="text-sm text-ink-secondary">No trend data yet.</p>;
  }

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
            dataKey="date"
            tick={{ fill: 'rgb(var(--text-muted-rgb))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'rgb(var(--text-muted-rgb))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
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
            dataKey="submitted"
            stroke="rgb(var(--brand-rgb))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
