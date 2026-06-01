'use client';

import { Button, Icon, OperatorSidebarBrand } from '@enagar/ui';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import { STATE_ADMIN_NAV, type StateAdminTabId } from '../lib/state-admin-nav';

import { StateAdminTopBar } from './state-admin-topbar';

import type { StateAdminSearchHit } from '../lib/state-admin-search';

function tabLabel(tab: StateAdminTabId): string {
  return STATE_ADMIN_NAV.find((item) => item.id === tab)?.label ?? 'State Admin';
}

export function StateAdminShell({
  activeTab,
  children,
  onRefresh,
  onSelectTab,
  searchCatalogue,
  onSearchHit,
}: {
  activeTab: StateAdminTabId;
  children: ReactNode;
  onRefresh?: () => void;
  onSelectTab: (tab: StateAdminTabId) => void;
  searchCatalogue: {
    tenants: Array<{ code: string; name: string }>;
    library: Array<{ code: string; name?: unknown }>;
  };
  onSearchHit: (hit: StateAdminSearchHit) => void;
}): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-canvas">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-sidebar/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-ink-onDark shadow-lg transition-transform lg:static lg:translate-x-0',
          collapsed ? 'w-[4.5rem]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="border-b border-sidebar-border px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <OperatorSidebarBrand
              collapsed={collapsed}
              portalLabel="State Super-Admin"
              subtitle="West Bengal · statewide"
              variant="dark"
            />
            <button
              type="button"
              className="hidden shrink-0 rounded-lg border border-sidebar-border p-2 text-ink-onDarkMuted hover:bg-sidebar-muted hover:text-ink-onDark lg:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((value) => !value)}
            >
              <Icon name="chevron-right" size={16} className={collapsed ? '' : 'rotate-180'} />
            </button>
          </div>
          {!collapsed ? (
            <p className="mt-2 truncate rounded-xl bg-sidebar-muted px-2.5 py-1.5 font-mono text-xs font-medium text-brand">
              WB-STATE
            </p>
          ) : null}
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
                  'relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition',
                  active
                    ? 'bg-sidebar-muted text-ink-onDark before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-brand'
                    : 'text-ink-onDarkMuted hover:bg-sidebar-muted hover:text-ink-onDark',
                ].join(' ')}
              >
                <Icon name={item.icon} size={18} />
                {!collapsed ? <span>{item.label}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-sidebar-border p-3">
          {onRefresh ? (
            <Button
              icon="refresh"
              variant="secondary"
              size="sm"
              className="w-full justify-center border-sidebar-border bg-transparent text-ink-onDarkMuted hover:bg-sidebar-muted hover:text-ink-onDark"
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
              className="w-full justify-center text-ink-onDarkMuted hover:bg-sidebar-muted hover:text-ink-onDark"
              type="button"
            >
              {!collapsed ? 'Sign out' : null}
            </Button>
          </Link>
        </div>
        {!collapsed ? (
          <div className="border-t border-sidebar-border px-3 py-3 text-center text-xs text-ink-onDarkMuted">
            eNagar · State platform
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-warm-border bg-surface px-4 py-3 lg:hidden">
          <Button icon="grid" variant="secondary" size="sm" onClick={() => setMobileOpen(true)}>
            Menu
          </Button>
          <p className="truncate text-sm font-medium text-ink-primary">{tabLabel(activeTab)}</p>
        </div>

        <StateAdminTopBar
          searchCatalogue={searchCatalogue}
          onSearchHit={onSearchHit}
          breadcrumb={
            <p className="truncate text-sm text-ink-secondary">
              <span className="font-semibold text-ink-primary">West Bengal</span>
              <span className="mx-2 text-ink-muted">/</span>
              <span>{tabLabel(activeTab)}</span>
            </p>
          }
        />

        <main className="flex flex-1 flex-col overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}
