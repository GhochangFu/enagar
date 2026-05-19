'use client';

import { Button } from '@enagar/ui';

import type { ReactNode } from 'react';

export function RecordListPanel({
  title,
  emptyLabel = 'No records yet.',
  onNew,
  newLabel = 'New',
  children,
}: {
  title: string;
  emptyLabel?: string;
  onNew?: () => void;
  newLabel?: string;
  children: ReactNode;
}): JSX.Element {
  const hasChildren = Boolean(children);

  return (
    <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
        {onNew ? (
          <Button type="button" size="sm" variant="secondary" onClick={onNew}>
            {newLabel}
          </Button>
        ) : null}
      </div>
      <ul className="max-h-[28rem] space-y-2 overflow-y-auto text-sm">
        {hasChildren ? (
          children
        ) : (
          <li className="rounded-xl border border-dashed border-warm-border px-3 py-6 text-center text-ink-secondary">
            {emptyLabel}
          </li>
        )}
      </ul>
    </article>
  );
}

export function RecordListItem({
  itemKey,
  selected,
  title,
  subtitle,
  meta,
  onSelect,
}: {
  itemKey: string;
  selected: boolean;
  title: string;
  subtitle?: string;
  meta?: string;
  onSelect: () => void;
}): JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={[
          'w-full rounded-xl border px-3 py-2.5 text-left transition',
          selected
            ? 'border-platform-accent bg-cyan-50/80 shadow-sm ring-1 ring-platform-accent/20'
            : 'border-warm-border bg-canvas hover:bg-brand-muted/30',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] font-semibold text-platform-accent">{itemKey}</p>
            <p className="font-medium text-ink-primary">{title}</p>
            {subtitle ? <p className="mt-0.5 text-xs text-ink-secondary">{subtitle}</p> : null}
            {meta ? <p className="mt-1 text-[11px] text-ink-secondary">{meta}</p> : null}
          </div>
          <span className="shrink-0 text-xs font-semibold text-platform-accent">
            {selected ? 'Editing' : 'Edit'}
          </span>
        </div>
      </button>
    </li>
  );
}
