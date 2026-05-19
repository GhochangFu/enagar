'use client';

import { Button } from '@enagar/ui';

export function JsonFallbackPanel({
  title = 'Advanced JSON fallback',
  description = 'Power-user escape hatch. Prefer the guided form above; invalid JSON is rejected on save.',
  value,
  onChange,
  onSave,
  saveLabel = 'Save JSON',
  readOnly = false,
}: {
  title?: string;
  description?: string;
  value: string;
  onChange?: (value: string) => void;
  onSave?: () => void;
  saveLabel?: string;
  readOnly?: boolean;
}): JSX.Element {
  const helpText =
    description ??
    (readOnly
      ? 'Raw payload for support and audit. Prefer the summary above for day-to-day review.'
      : 'Power-user escape hatch. Prefer the guided form above; invalid JSON is rejected on save.');

  return (
    <details className="rounded-2xl border border-dashed border-warm-border bg-surface/80">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink-primary marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-platform-accent">{title}</span>
        <span className="mt-0.5 block text-xs font-normal text-ink-secondary">{helpText}</span>
      </summary>
      <div className="space-y-3 border-t border-warm-border px-4 pb-4 pt-3">
        {readOnly ? (
          <pre className="max-h-56 overflow-auto rounded-xl border border-warm-border bg-slate-950 p-3 font-mono text-xs text-slate-50">
            {value}
          </pre>
        ) : (
          <textarea
            className="h-56 w-full rounded-xl border border-warm-border bg-slate-950 p-3 font-mono text-xs text-slate-50"
            spellCheck={false}
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
          />
        )}
        {!readOnly && onSave ? (
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="secondary" onClick={onSave}>
              {saveLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </details>
  );
}
