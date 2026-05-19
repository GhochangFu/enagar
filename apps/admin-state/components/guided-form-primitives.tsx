'use client';

import { Button } from '@enagar/ui';

import type { ReactNode } from 'react';

export function GuidedFormCard({
  eyebrow,
  title,
  saveLabel,
  onSave,
  children,
}: {
  eyebrow: string;
  title: string;
  saveLabel: string;
  onSave: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-platform-accent">
            {eyebrow}
          </p>
          <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
        </div>
        <Button type="button" size="sm" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
      {children}
    </article>
  );
}

export function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  hint?: string;
}): JSX.Element {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary">
      {label}
      <input
        type={type}
        className="mt-1 w-full rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink-primary focus:border-platform-accent focus:outline-none focus:ring-2 focus:ring-platform-accent/20"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <span className="mt-1 block text-[11px] font-normal normal-case text-ink-secondary">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}): JSX.Element {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary">
      {label}
      <select
        className="mt-1 w-full rounded-xl border border-warm-border bg-canvas px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink-primary focus:border-platform-accent focus:outline-none focus:ring-2 focus:ring-platform-accent/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
