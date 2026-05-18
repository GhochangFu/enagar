'use client';

import { cn } from '../cn';

import type { HTMLAttributes, JSX } from 'react';

export type SpinnerProps = HTMLAttributes<HTMLSpanElement> & {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
};

const sizeClass = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
} as const;

export function Spinner({
  size = 'md',
  label = 'Loading',
  className,
  ...rest
}: SpinnerProps): JSX.Element {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-brand border-t-transparent',
        sizeClass[size],
        className,
      )}
      {...rest}
    />
  );
}
