'use client';

import { cn } from '../cn';

import type { HTMLAttributes, JSX, ReactNode } from 'react';

export type AlertBannerTone = 'info' | 'success' | 'warning' | 'danger';

const toneClass: Record<AlertBannerTone, string> = {
  info: 'border-info/30 bg-info-bg text-info',
  success: 'border-success/30 bg-success-bg text-success',
  warning: 'border-warning/40 bg-warning-bg text-warning',
  danger: 'border-danger/30 bg-danger-bg text-danger',
};

export type AlertBannerProps = HTMLAttributes<HTMLDivElement> & {
  tone?: AlertBannerTone;
  title?: string;
  action?: ReactNode;
};

export function AlertBanner({
  tone = 'warning',
  title,
  action,
  className,
  children,
  ...rest
}: AlertBannerProps): JSX.Element {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm',
        toneClass[tone],
        className,
      )}
      {...rest}
    >
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <p className={title ? 'mt-0.5' : undefined}>{children}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
