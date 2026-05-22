'use client';

import type { PwaLocaleCode } from '../lib/workspace-types';
import type { JSX, ReactNode } from 'react';

export function CitizenPwaHeader({
  language,
  status,
}: {
  language: PwaLocaleCode;
  status?: string;
}): JSX.Element {
  return (
    <header className="border-b border-warm-border bg-surface shadow-sm">
      <div aria-hidden className="h-1 bg-gradient-to-r from-peach-accent via-brand to-forest" />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <div
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand/15 bg-brand-muted text-lg font-bold tracking-tight text-brand"
          >
            eN
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight tracking-tight text-ink-primary">
              eNagarSeba
            </p>
            <p className="mt-0.5 text-sm font-medium text-forest">
              West Bengal municipal services — citizen portal
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-mint-band px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-forest">
            Citizen PWA
          </span>
          <span className="rounded-full bg-brand-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand">
            {language.toUpperCase()}
          </span>
          {status ? (
            <span
              className="max-w-[14rem] truncate text-xs font-medium text-ink-muted"
              title={status}
            >
              {status}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function CitizenPwaFooter(): JSX.Element {
  return (
    <footer className="mt-auto border-t border-warm-border bg-surface">
      <div aria-hidden className="h-0.5 bg-forest" />
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-7 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-forest">Platform</p>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            <strong className="font-semibold text-ink-primary">eNagarSeba</strong> connects citizens
            with Urban Local Bodies across West Bengal — services, applications, payments, and
            grievances in one progressive web app.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-forest">Help</p>
          <ul className="mt-2 space-y-1 text-sm font-medium">
            <li>
              <a className="text-brand hover:underline" href="#help">
                Citizen help centre
              </a>
            </li>
            <li>
              <a className="text-brand hover:underline" href="#privacy">
                Privacy &amp; data use
              </a>
            </li>
            <li>
              <a className="text-brand hover:underline" href="#accessibility">
                Accessibility statement
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-forest">
            Developed by
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            Created by{' '}
            <strong className="font-semibold text-ink-primary">
              Euphoria Infotech India Limited
            </strong>{' '}
            for the Government of West Bengal municipal digital programme.
          </p>
        </div>
      </div>
      <div className="border-t border-warm-border px-6 py-4 text-center">
        <p className="text-xs text-ink-muted">
          © 2026 Government of West Bengal · eNagarSeba Citizen PWA
        </p>
        <p className="mt-1 text-xs font-medium text-ink-secondary">
          Engineering &amp; experience design — Euphoria Infotech India Limited
        </p>
      </div>
    </footer>
  );
}

export function CitizenPwaChrome({
  children,
  language,
  status,
}: {
  children: ReactNode;
  language: PwaLocaleCode;
  status?: string;
}): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <CitizenPwaHeader language={language} status={status} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 pt-2 pb-6">{children}</div>
      <CitizenPwaFooter />
    </div>
  );
}
