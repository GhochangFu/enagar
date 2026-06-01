'use client';

import { cn } from '../cn';

import type { JSX, ReactNode } from 'react';

export function OperatorBrandMark({ className }: { className?: string }): JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/15 bg-brand-muted text-base font-bold tracking-tight text-brand',
        className,
      )}
    >
      eN
    </div>
  );
}

export function OperatorSidebarBrand({
  collapsed,
  portalLabel,
  subtitle,
  variant = 'light',
}: {
  collapsed?: boolean;
  portalLabel: string;
  subtitle: string;
  variant?: 'light' | 'dark';
}): JSX.Element {
  const isDark = variant === 'dark';
  if (collapsed) {
    return (
      <div className="flex justify-center py-1">
        <OperatorBrandMark
          className={cn(
            'h-9 w-9 text-sm',
            isDark && 'border-sidebar-border bg-sidebar-muted text-sage',
          )}
        />
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-3">
      <OperatorBrandMark
        className={cn(isDark && 'border-sidebar-border bg-sidebar-muted text-accent-sage')}
      />
      <div className="min-w-0">
        <p
          className={cn(
            'truncate text-base font-bold tracking-tight',
            isDark ? 'text-ink-onDark' : 'text-ink-primary',
          )}
        >
          eNagarSeba
        </p>
        <p className={cn('truncate text-xs font-medium', isDark ? 'text-sage' : 'text-forest')}>
          {portalLabel}
        </p>
        <p
          className={cn(
            'mt-0.5 truncate text-[11px]',
            isDark ? 'text-ink-onDarkMuted' : 'text-ink-muted',
          )}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export function OperatorTopHeader({
  portalLabel,
  subtitle,
  badge,
  actions,
}: {
  portalLabel: string;
  subtitle: string;
  badge?: string;
  actions?: ReactNode;
}): JSX.Element {
  return (
    <header className="border-b border-warm-border bg-surface shadow-sm">
      <div aria-hidden className="h-1 bg-gradient-to-r from-peach-accent via-brand to-forest" />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <OperatorBrandMark />
          <div className="min-w-0">
            <p className="text-lg font-bold tracking-tight text-ink-primary">eNagarSeba</p>
            <p className="text-sm font-medium text-forest">{portalLabel}</p>
            <p className="text-xs text-ink-muted">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {badge ? (
            <span className="rounded-full bg-mint-band px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-forest">
              {badge}
            </span>
          ) : null}
          {actions}
        </div>
      </div>
    </header>
  );
}

export function OperatorAppFooter({
  compact = false,
  operatorHelpHref = '/help/operator-help.html',
}: {
  compact?: boolean;
  /** Static operator guide served from the app `public/help/` folder. */
  operatorHelpHref?: string;
}): JSX.Element {
  if (compact) {
    return (
      <footer className="border-t border-warm-border px-3 py-3 text-center">
        <p className="text-[10px] leading-snug text-ink-muted">
          © WB Govt ·{' '}
          <span className="font-medium text-ink-secondary">Euphoria Infotech India Limited</span>
        </p>
      </footer>
    );
  }

  return (
    <footer className="mt-auto border-t border-warm-border bg-surface">
      <div aria-hidden className="h-0.5 bg-forest" />
      <div className="mx-auto grid max-w-7xl gap-5 px-6 py-6 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-forest">Platform</p>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            <strong className="font-semibold text-ink-primary">eNagarSeba</strong> operator tools
            for Urban Local Bodies and West Bengal state oversight.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-forest">Support</p>
          <ul className="mt-2 space-y-1 text-sm font-medium">
            <li>
              <a
                className="text-brand hover:underline"
                href={operatorHelpHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                Operator help
              </a>
            </li>
            <li>
              <a className="text-brand hover:underline" href="#privacy">
                Privacy &amp; data use
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-forest">
            Developed by
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            Created by{' '}
            <strong className="font-semibold text-ink-primary">
              Euphoria Infotech India Limited
            </strong>{' '}
            for the Government of West Bengal municipal digital programme.
          </p>
        </div>
      </div>
      <div className="border-t border-warm-border px-6 py-3 text-center">
        <p className="text-xs text-ink-muted">© 2026 Government of West Bengal · eNagarSeba</p>
      </div>
    </footer>
  );
}
