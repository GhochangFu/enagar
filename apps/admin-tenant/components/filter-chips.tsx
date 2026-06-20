'use client';

import type { JSX } from 'react';

export function FilterChips<T extends string>({
  chips,
  selected,
  onSelect,
  ariaLabel,
}: {
  chips: Array<{ value: T; label: string }>;
  selected: T;
  onSelect: (value: T) => void;
  ariaLabel: string;
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {chips.map((chip) => {
        const isActive = selected === chip.value;
        return (
          <button
            key={chip.value || 'all'}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
              isActive
                ? 'border-ink-primary bg-ink-primary text-white'
                : 'border-ink-muted/40 text-ink-secondary hover:border-brand/40 hover:text-ink-primary'
            }`}
            aria-pressed={isActive}
            onClick={() => onSelect(chip.value)}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
