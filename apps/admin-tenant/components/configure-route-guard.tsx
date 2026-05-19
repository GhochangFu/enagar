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
  const { me, loadingMe } = useTenantAdminSession();

  if (!isConfigurePath(pathname)) {
    return <>{children}</>;
  }

  if (loadingMe || !me) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="text-sm text-ink-secondary">Checking access…</p>
      </div>
    );
  }

  if (!me.is_admin) {
    return <AdminOnlyPanel />;
  }

  return <>{children}</>;
}
