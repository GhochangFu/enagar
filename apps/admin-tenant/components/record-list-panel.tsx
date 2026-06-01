'use client';

import { Button } from '@enagar/ui';
import { Children, type ReactNode } from 'react';

export function RecordListPanel({
  title,
  emptyLabel = 'No records yet.',
  selectedKey: _selectedKey,
  onNew,
  newLabel = 'New',
  children,
}: {
  title: string;
  emptyLabel?: string;
  selectedKey?: string | null;
  onNew?: () => void;
  newLabel?: string;
  children: ReactNode;
}): JSX.Element {
  const hasChildren = Children.count(children) > 0;

  return (
    <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
        {onNew ? (
          <Button icon="file-plus" type="button" size="sm" variant="secondary" onClick={onNew}>
            {newLabel}
          </Button>
        ) : null}
      </div>
      <ul className="max-h-[32rem] space-y-2 overflow-y-auto text-sm">
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
          'w-full rounded-xl border px-3 py-3 text-left transition',
          selected
            ? 'border-brand bg-mint-band/50 shadow-sm'
            : 'border-warm-border bg-canvas hover:bg-brand-muted/20',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-ink-secondary">{itemKey}</p>
            <p className="font-medium text-ink-primary">{title}</p>
            {subtitle ? <p className="mt-0.5 text-xs text-ink-secondary">{subtitle}</p> : null}
            {meta ? <p className="mt-1 text-[11px] text-ink-secondary">{meta}</p> : null}
          </div>
          <span className="shrink-0 text-xs font-semibold text-brand">
            {selected ? 'Editing' : 'Edit'}
          </span>
        </div>
      </button>
    </li>
  );
}
