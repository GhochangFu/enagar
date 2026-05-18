'use client';

import { cn } from '../cn';

import type { HTMLAttributes, JSX } from 'react';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...rest }: SkeletonProps): JSX.Element {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-2xl bg-brand-muted/60', className)}
      {...rest}
    />
  );
}
