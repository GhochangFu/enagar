'use client';

import { Button, Icon, OperatorAppFooter, OperatorSidebarBrand } from '@enagar/ui';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import { STATE_ADMIN_NAV, type StateAdminTabId } from '../lib/state-admin-nav';

export function StateAdminShell({
  activeTab,
  children,
  onRefresh,
  onSelectTab,
}: {
  activeTab: StateAdminTabId;
  children: ReactNode;
  onRefresh?: () => void;
  onSelectTab: (tab: StateAdminTabId) => void;
}): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
              portalLabel="State Super-Admin"
              subtitle="West Bengal · statewide"
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
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="State admin">
          {STATE_ADMIN_NAV.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileOpen(false);
                }}
                className={[
                  'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition',
                  active
                    ? 'bg-mint-band text-forest'
                    : 'text-ink-secondary hover:bg-brand-muted/30 hover:text-ink-primary',
                ].join(' ')}
              >
                <Icon name={item.icon} size={18} />
                {!collapsed ? <span>{item.label}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-warm-border p-3">
          {onRefresh ? (
            <Button
              icon="refresh"
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              onClick={onRefresh}
            >
              {!collapsed ? 'Refresh data' : null}
            </Button>
          ) : null}
          <Link href="/api/admin-auth/logout" className="block">
            <Button
              icon="log-out"
              variant="ghost"
              size="sm"
              className="w-full justify-center text-ink-secondary"
              type="button"
            >
              {!collapsed ? 'Sign out' : null}
            </Button>
          </Link>
        </div>
        {!collapsed ? <OperatorAppFooter compact /> : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-warm-border bg-surface px-4 py-3 lg:hidden">
          <Button icon="grid" variant="secondary" size="sm" onClick={() => setMobileOpen(true)}>
            Menu
          </Button>
          <p className="truncate text-sm font-medium text-ink-primary">State Super-Admin</p>
        </div>
        <div className="flex flex-1 flex-col overflow-x-auto">{children}</div>
      </div>
    </div>
  );
}
