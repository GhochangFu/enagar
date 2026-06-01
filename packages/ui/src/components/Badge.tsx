'use client';

import { cn } from '../cn';

import type { HTMLAttributes, JSX } from 'react';

const toneClass = {
  neutral: 'bg-canvas text-ink-secondary',
  brand: 'bg-brand-muted text-brand',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
} as const;

export type BadgeTone = keyof typeof toneClass;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = 'neutral', className, children, ...rest }: BadgeProps): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        toneClass[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
