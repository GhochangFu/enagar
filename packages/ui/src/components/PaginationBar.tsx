'use client';

import { cn } from '../cn';

import { Button } from './Button';

import type { JSX } from 'react';

export type PaginationBarProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  /** When true, hide page-size selector (e.g. server-side cursor paging). */
  hidePageSize?: boolean;
  /** Optional label override for cursor-style paging without total pages. */
  label?: string;
};

export function PaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  className,
  hidePageSize = false,
  label,
}: PaginationBarProps): JSX.Element {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const summaryLabel =
    label ??
    (totalItems === 0
      ? 'No items'
      : `Showing ${start}–${end} of ${totalItems} · Page ${page} of ${totalPages}`);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-warm-border px-4 py-3 text-sm text-ink-secondary',
        className,
      )}
    >
      <p className="text-xs font-medium">{summaryLabel}</p>
      <div className="flex flex-wrap items-center gap-2">
        {!hidePageSize && onPageSizeChange ? (
          <label className="flex items-center gap-2 text-xs">
            <span>Rows</span>
            <select
              className="rounded-lg border border-warm-border bg-surface px-2 py-1 text-xs text-ink-primary"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number.parseInt(event.target.value, 10))}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
