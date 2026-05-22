'use client';

import { Button, Icon, OperatorAppFooter, OperatorSidebarBrand } from '@enagar/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';

import { TENANT_ADMIN_NAV } from '../lib/tenant-admin-nav';

import { useTenantAdminSession } from './tenant-admin-session';

import type { Route } from 'next';

export function TenantAdminShell({ children }: { children: ReactNode }): JSX.Element {
  const pathname = usePathname();
  const { me, loadingMe, logout, refreshMe } = useTenantAdminSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = me?.is_admin ?? false;
  const tenantCode = me?.tenant_code;

  const navItems = TENANT_ADMIN_NAV.map((item) => ({
    ...item,
    disabled: item.adminOnly && !isAdmin,
  }));

  return (
    <div className="flex min-h-screen bg-canvas">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-ink-primary/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-warm-border bg-surface shadow-sm transition-transform lg:static lg:translate-x-0',
          collapsed ? 'w-[4.5rem]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="border-b border-warm-border px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <OperatorSidebarBrand
              collapsed={collapsed}
              portalLabel="Tenant Admin"
              subtitle="ULB operator console"
            />
            <button
              type="button"
              className="hidden shrink-0 rounded-lg border border-warm-border p-2 text-ink-secondary hover:bg-mint-band lg:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((value) => !value)}
            >
              <Icon name="chevron-right" size={16} className={collapsed ? '' : 'rotate-180'} />
            </button>
          </div>
          {!collapsed ? (
            <p className="mt-2 truncate rounded-xl bg-mint-band px-2.5 py-1.5 font-mono text-xs font-medium text-forest">
              {tenantCode ?? (loadingMe ? '…' : 'Tenant')}
            </p>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Tenant admin">
          {navItems.map((item) => {
            const active = item.match(pathname);
            const baseClass =
              'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition';
            if (item.disabled) {
              return (
                <p
                  key={item.id}
                  className={`${baseClass} cursor-not-allowed text-ink-secondary/60`}
                  title="Admin only"
                >
                  <Icon name={item.icon} size={18} />
                  {!collapsed ? (
                    <span>
                      {item.label}
                      <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wide">
                        Admin only
                      </span>
                    </span>
                  ) : null}
                </p>
              );
            }
            return (
              <Link
                key={item.id}
                href={item.href as Route}
                onClick={() => setMobileOpen(false)}
                className={[
                  baseClass,
                  active
                    ? 'bg-mint-band text-forest'
                    : 'text-ink-secondary hover:bg-brand-muted/30 hover:text-ink-primary',
                ].join(' ')}
              >
                <Icon name={item.icon} size={18} />
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-warm-border p-3">
          <Button
            icon="refresh"
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            onClick={() => void refreshMe()}
          >
            {!collapsed ? 'Refresh session' : null}
          </Button>
          <Button
            icon="log-out"
            variant="ghost"
            size="sm"
            className="w-full justify-center text-ink-secondary"
            onClick={logout}
          >
            {!collapsed ? 'Sign out' : null}
          </Button>
        </div>
        {!collapsed ? <OperatorAppFooter compact /> : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-warm-border bg-surface px-4 py-3 lg:hidden">
          <Button icon="grid" variant="secondary" size="sm" onClick={() => setMobileOpen(true)}>
            Menu
          </Button>
          <p className="truncate font-mono text-sm font-medium text-ink-primary">
            {tenantCode ?? 'Desk'}
          </p>
        </div>
        <main className="flex flex-1 flex-col overflow-x-auto">
          <div className="flex-1 px-4 py-6 md:px-8 md:py-6">{children}</div>
          <OperatorAppFooter />
        </main>
      </div>
    </div>
  );
}
