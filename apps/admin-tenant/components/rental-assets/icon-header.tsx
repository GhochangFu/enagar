import { Icon, type IconName } from '@enagar/ui';

import type { JSX } from 'react';

/**
 * Small icon + title block used at the top of detail modals and section
 * headers. Keeps visual rhythm consistent across the rental-assets + invoices
 * pages and saves us re-painting the same 4 lines of Tailwind everywhere.
 */
export function IconHeader({
  icon,
  eyebrow,
  title,
  trailing,
}: {
  icon: IconName;
  eyebrow?: string;
  title: string;
  trailing?: JSX.Element;
}): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"
        aria-hidden
      >
        <Icon name={icon} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-secondary">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-0.5 truncate text-lg font-bold text-ink-primary">{title}</h2>
      </div>
      {trailing}
    </div>
  );
}
