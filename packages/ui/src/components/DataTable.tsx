'use client';

import { cn } from '../cn';

import type { HTMLAttributes, JSX, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

export type DataTableProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  toolbar?: ReactNode;
};

export function DataTable({ children, toolbar, className, ...rest }: DataTableProps): JSX.Element {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-warm-border bg-surface shadow-sm',
        className,
      )}
      {...rest}
    >
      {toolbar ? <div className="border-b border-warm-border p-4">{toolbar}</div> : null}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataTableElement({
  className,
  ...rest
}: HTMLAttributes<HTMLTableElement>): JSX.Element {
  return (
    <table
      className={cn('min-w-full divide-y divide-warm-border text-left text-sm', className)}
      {...rest}
    />
  );
}

export function DataTableHead({
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  return (
    <thead
      className={cn(
        'bg-surface-raised text-xs uppercase tracking-wide text-ink-secondary',
        className,
      )}
      {...rest}
    />
  );
}

export function DataTableHeaderCell({
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  return <th className={cn('px-4 py-3 font-semibold', className)} {...rest} />;
}

export function DataTableBody({
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  return <tbody className={cn('divide-y divide-warm-border', className)} {...rest} />;
}

export function DataTableRow({
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>): JSX.Element {
  return <tr className={cn('transition hover:bg-brand-muted/20', className)} {...rest} />;
}

export function DataTableCell({
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  return <td className={cn('px-4 py-3 text-ink-primary', className)} {...rest} />;
}
