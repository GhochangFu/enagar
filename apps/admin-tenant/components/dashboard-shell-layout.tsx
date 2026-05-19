'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect } from 'react';

import { ConfigureRouteGuard } from './configure-route-guard';
import { TenantAdminSessionProvider, useTenantAdminSession } from './tenant-admin-session';
import { TenantAdminShell } from './tenant-admin-shell';

export default function DashboardShellLayout({ children }: { children: ReactNode }): JSX.Element {
  const router = useRouter();
  const onUnauthorized = useCallback(() => {
    router.replace('/login');
  }, [router]);

  return (
    <TenantAdminSessionProvider onUnauthorized={onUnauthorized}>
      <ClerkDashboardGuard />
      <TenantAdminShell>
        <ConfigureRouteGuard>{children}</ConfigureRouteGuard>
      </TenantAdminShell>
    </TenantAdminSessionProvider>
  );
}

function ClerkDashboardGuard(): null {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loadingMe } = useTenantAdminSession();

  useEffect(() => {
    if (loadingMe || !me) {
      return;
    }
    if (!me.is_admin && pathname === '/dashboard') {
      router.replace('/dashboard/desk');
    }
  }, [loadingMe, me, pathname, router]);

  return null;
}
