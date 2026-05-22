'use client';

import { cn } from '../cn';

import type { JSX, ReactNode } from 'react';

export type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  tenantBar?: boolean;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  tenantBar = false,
  className,
}: PageHeaderProps): JSX.Element {
  return (
    <header
      className={cn(
        tenantBar
          ? 'rounded-3xl border border-brand-muted bg-brand-surface px-6 py-5 shadow-sm'
          : 'border-b border-warm-border pb-6',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-wide text-platform-accent">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-1 text-2xl font-bold text-ink-primary">{title}</h1>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm text-ink-secondary">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
