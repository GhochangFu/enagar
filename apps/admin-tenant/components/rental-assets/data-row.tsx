import { Icon, type IconName } from '@enagar/ui';

import type { JSX } from 'react';

/**
 * Single label/value row used inside the polished modals. Accepts an optional
 * icon so we can group related fields visually (e.g. a date + a method
 * inside the payment-detail drawer) without reaching for full dlists.
 */
export function DataRow({
  label,
  value,
  icon,
  mono,
  tone,
}: {
  label: string;
  value: JSX.Element | string | null | undefined;
  icon?: IconName;
  mono?: boolean;
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'brand';
}): JSX.Element {
  const toneClass: Record<NonNullable<typeof tone>, string> = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    neutral: 'text-ink-secondary',
    brand: 'text-brand',
  };
  return (
    <div className="flex items-start gap-3 py-2">
      {icon ? (
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-secondary"
          aria-hidden
        >
          <Icon name={icon} size={14} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        <p
          className={[
            'mt-0.5 text-sm',
            mono ? 'font-mono' : 'font-medium',
            tone ? toneClass[tone] : 'text-ink-primary',
          ].join(' ')}
        >
          {value ?? <span className="text-ink-muted">—</span>}
        </p>
      </div>
    </div>
  );
}
