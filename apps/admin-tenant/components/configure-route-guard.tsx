'use client';

import { usePathname } from 'next/navigation';

import { AdminOnlyPanel } from './admin-only-panel';
import { useTenantAdminSession } from './tenant-admin-session';

import type { ReactNode } from 'react';

function isConfigurePath(pathname: string): boolean {
  return (
    pathname === '/dashboard/masters' ||
    pathname.startsWith('/dashboard/masters/') ||
    pathname === '/dashboard/operations' ||
    pathname.startsWith('/dashboard/operations/') ||
    pathname.startsWith('/dashboard/services/')
  );
}

export function ConfigureRouteGuard({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();
  const { me, loadingMe, meError } = useTenantAdminSession();

  if (!isConfigurePath(pathname)) {
    return <>{children}</>;
  }

  if (loadingMe || !me) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium text-ink-primary">
          {loadingMe ? 'Loading operator profile…' : 'Operator profile unavailable'}
        </p>
        {meError ? <p className="max-w-md text-xs text-ink-muted">{meError}</p> : null}
      </div>
    );
  }

  if (!me.is_admin) {
    return <AdminOnlyPanel />;
  }

  return <>{children}</>;
}
