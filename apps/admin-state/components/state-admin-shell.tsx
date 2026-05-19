'use client';

import { Button } from '@enagar/ui';
import Link from 'next/link';

import type { ReactNode } from 'react';

export function StateAdminShell({
  children,
  onRefresh,
}: {
  children: ReactNode;
  onRefresh?: () => void;
}): JSX.Element {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-cyan-200/70 bg-cyan-50/40 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-platform-accent">
              West Bengal · State operations
            </p>
            <p className="text-sm font-semibold text-ink-primary">eNagarSeba State Super-Admin</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onRefresh ? (
              <Button type="button" variant="secondary" size="sm" onClick={onRefresh}>
                Refresh
              </Button>
            ) : null}
            <Link href="/api/admin-auth/logout">
              <Button type="button" variant="secondary" size="sm">
                Sign out
              </Button>
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
