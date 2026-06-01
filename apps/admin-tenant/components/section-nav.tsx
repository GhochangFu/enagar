'use client';

import { cn } from '@enagar/ui';

import type { JSX } from 'react';

export type SectionNavItem<T extends string> = {
  id: T;
  label: string;
};

export function SectionNav<T extends string>({
  items,
  active,
  onSelect,
  'aria-label': ariaLabel,
  className,
}: {
  items: SectionNavItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  'aria-label': string;
  className?: string;
}): JSX.Element {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'h-fit rounded-2xl border border-warm-border bg-surface p-2 shadow-sm lg:sticky lg:top-4',
        className,
      )}
    >
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition',
                  isActive
                    ? 'bg-mint-band text-forest before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-brand'
                    : 'text-ink-secondary hover:bg-brand-muted/30 hover:text-ink-primary',
                )}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
