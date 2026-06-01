'use client';

import { cn } from '../cn';

import type { HTMLAttributes, JSX } from 'react';

export type KpiCardAccent = 'default' | 'success' | 'warning' | 'danger';

const accentClass: Record<KpiCardAccent, string> = {
  default: 'before:bg-sage',
  success: 'before:bg-success',
  warning: 'before:bg-warning',
  danger: 'before:bg-danger',
};

export type KpiCardProps = HTMLAttributes<HTMLElement> & {
  label: string;
  value: string | number;
  accent?: KpiCardAccent;
};

export function KpiCard({
  label,
  value,
  accent = 'default',
  className,
  ...rest
}: KpiCardProps): JSX.Element {
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border border-warm-border bg-surface p-5 shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-1',
        accentClass[accent],
        className,
      )}
      {...rest}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-ink-primary">{value}</p>
    </article>
  );
}
