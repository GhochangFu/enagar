'use client';

import { Button, Icon } from '@enagar/ui';
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
        <div className="flex items-center gap-3 border-b border-warm-border px-4 py-4">
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-forest">Operator</p>
              <p className="truncate font-mono text-sm font-semibold text-ink-primary">
                {tenantCode ?? (loadingMe ? '…' : 'Tenant')}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            className="hidden rounded-lg border border-warm-border p-2 text-ink-secondary hover:bg-mint-band lg:inline-flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((value) => !value)}
          >
            <Icon name="chevron-right" size={16} className={collapsed ? '' : 'rotate-180'} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Tenant admin">
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
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            onClick={() => void refreshMe()}
          >
            {!collapsed ? 'Refresh session' : '↻'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-ink-secondary"
            onClick={logout}
          >
            {!collapsed ? 'Sign out' : 'Out'}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-warm-border bg-surface px-4 py-3 lg:hidden">
          <Button variant="secondary" size="sm" onClick={() => setMobileOpen(true)}>
            Menu
          </Button>
          <p className="truncate font-mono text-sm text-ink-primary">{tenantCode ?? 'Desk'}</p>
        </div>
        <main className="flex-1 overflow-x-auto px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
