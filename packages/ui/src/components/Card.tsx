'use client';

import { cn } from '../cn';

import type { HTMLAttributes, JSX, ReactNode } from 'react';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  tone?: 'default' | 'muted' | 'surface';
};

const paddingClass = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const;

const toneClass = {
  default: 'bg-surface border-warm-border',
  muted: 'bg-brand-muted/50 border-brand-muted',
  surface: 'bg-brand-surface border-brand-surface',
} as const;

export function Card({
  children,
  padding = 'md',
  tone = 'default',
  className,
  ...rest
}: CardProps): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-2xl border shadow-sm',
        toneClass[tone],
        paddingClass[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
