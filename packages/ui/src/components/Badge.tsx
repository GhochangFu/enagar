'use client';

import { cn } from '../cn';

import type { HTMLAttributes, JSX } from 'react';

const toneClass = {
  neutral: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-muted text-brand',
  success: 'bg-emerald-100 text-emerald-900',
  warning: 'bg-amber-100 text-amber-950',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-900',
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
