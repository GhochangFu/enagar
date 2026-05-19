'use client';

import Link from 'next/link';

import type { Route } from 'next';

export function AdminOnlyPanel({
  title = 'Administrator access required',
  description = 'Masters, Operations, and service configuration are limited to municipality administrators. Use the Desk for day-to-day application and grievance work.',
}: {
  title?: string;
  description?: string;
}): JSX.Element {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-6 py-16 text-center">
      <div className="rounded-3xl border border-warm-border bg-surface p-8 shadow-sm">
        <p className="inline-flex rounded-full bg-mint-band px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest">
          Admin only
        </p>
        <h1 className="mt-4 text-xl font-bold text-ink-primary">{title}</h1>
        <p className="mt-3 text-sm text-ink-secondary">{description}</p>
        <Link
          href={'/dashboard/desk' as Route}
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-brand-fg shadow-sm hover:opacity-95"
        >
          Open Desk
        </Link>
      </div>
    </div>
  );
}
