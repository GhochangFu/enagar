'use client';

import { cn } from '../cn';

import type { JSX } from 'react';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label': string;
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  className,
}: SegmentedControlProps<T>): JSX.Element {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex flex-wrap rounded-xl border border-warm-border bg-surface p-1',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={option.disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition',
            value === option.value
              ? 'bg-brand text-brand-fg shadow-sm'
              : 'text-ink-secondary hover:bg-brand-muted/40 hover:text-ink-primary',
            option.disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
