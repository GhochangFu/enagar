'use client';

import type { FormValidationIssue } from '../index';

export function FormSchemaJsonFallback({
  title = 'Form schema JSON fallback',
  description = 'Advanced edits sync with the visual builder when JSON is valid. Preview-only sample values never save here.',
  value,
  onChange,
  valid,
  issues,
  onSave,
  saveLabel = 'Save',
}: {
  title?: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  valid: boolean;
  issues: FormValidationIssue[];
  onSave?: () => void;
  saveLabel?: string;
}): JSX.Element {
  return (
    <details className="rounded-2xl border border-dashed border-slate-300 bg-slate-50">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
        {title}
        <span className="mt-0.5 block text-xs font-normal text-slate-500">{description}</span>
      </summary>
      <div className="space-y-3 border-t border-slate-200 px-4 pb-4 pt-3">
        <textarea
          className="h-56 w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-50"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className={valid ? 'text-xs text-emerald-700' : 'text-xs text-red-700'}>
          {valid ? (
            <p>Valid — visual builder and preview will update.</p>
          ) : (
            <ul className="space-y-1">
              {issues.slice(0, 5).map((issue) => (
                <li key={`${issue.path}:${issue.message}`}>
                  <span className="font-mono">{issue.path}</span>: {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
        {onSave ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSave}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100"
            >
              {saveLabel}
            </button>
          </div>
        ) : null}
      </div>
    </details>
  );
}
