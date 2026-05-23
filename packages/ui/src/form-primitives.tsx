'use client';

import type { ComponentPropsWithoutRef, JSX, ReactNode } from 'react';

/** Shared Tailwind control chrome (scanned by apps that include `packages/ui` in `content`). */
export const fieldControlClass =
  'mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25';

type RowProps = {
  children: ReactNode;
  className?: string;
};

export function FieldRow({ children, className = '' }: RowProps): JSX.Element {
  return <div className={`block min-w-0 ${className}`.trim()}>{children}</div>;
}

type LabelProps = {
  children: ReactNode;
  required?: boolean;
  htmlFor?: string;
};

export function FieldLabel({ children, required, htmlFor }: LabelProps): JSX.Element {
  const className = 'text-sm font-medium text-slate-700';
  if (htmlFor) {
    return (
      <label className={className} htmlFor={htmlFor}>
        {children}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
    );
  }
  return (
    <span className={className}>
      {children}
      {required ? <span className="text-red-600"> *</span> : null}
    </span>
  );
}

export function HelpText({ children }: { children: ReactNode }): JSX.Element | null {
  if (!children) return null;
  return <p className="mt-1 text-xs text-slate-500">{children}</p>;
}

export function SectionHeading({ title }: { title: string }): JSX.Element {
  return (
    <div className="rounded-2xl bg-brand/10 p-4 text-brand">
      <h4 className="font-bold">{title}</h4>
    </div>
  );
}

export function TextField(
  props: Omit<ComponentPropsWithoutRef<'input'>, 'className'> & { className?: string },
) {
  const { className = '', ...rest } = props;
  return <input {...rest} className={`${fieldControlClass} ${className}`.trim()} />;
}

export function NumberField(
  props: Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'className'> & { className?: string },
) {
  const { className = '', ...rest } = props;
  return <input {...rest} type="number" className={`${fieldControlClass} ${className}`.trim()} />;
}

export function DateField(
  props: Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'className'> & { className?: string },
) {
  const { className = '', ...rest } = props;
  return <input {...rest} type="date" className={`${fieldControlClass} ${className}`.trim()} />;
}

export function SelectField(
  props: Omit<ComponentPropsWithoutRef<'select'>, 'className'> & { className?: string },
) {
  const { children, className = '', ...rest } = props;
  return (
    <select {...rest} className={`${fieldControlClass} ${className}`.trim()}>
      {children}
    </select>
  );
}

export function TextAreaField(
  props: Omit<ComponentPropsWithoutRef<'textarea'>, 'className'> & { className?: string },
) {
  const { className = '', rows = 4, ...rest } = props;
  return (
    <textarea
      {...rest}
      rows={rows}
      className={`${fieldControlClass} min-h-[6rem] ${className}`.trim()}
    />
  );
}

export function ChoicePill({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        selected
          ? 'rounded-xl border-2 border-brand bg-brand/[0.08] px-3 py-2 text-left text-sm font-bold text-brand'
          : 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm hover:border-slate-300'
      }
    >
      {label}
    </button>
  );
}

export function ChoiceGrid({ children }: { children: ReactNode }): JSX.Element {
  return <div className="mt-2 grid w-full gap-2 sm:grid-cols-2">{children}</div>;
}
