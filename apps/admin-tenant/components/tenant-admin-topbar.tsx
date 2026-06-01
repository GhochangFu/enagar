'use client';

import { useToast } from '@enagar/ui';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type JSX,
  type ReactNode,
} from 'react';

import { resolveTenantAdminSearch, tenantAdminSearchHref } from '../lib/tenant-admin-search';

import { useTenantAdminSession } from './tenant-admin-session';

import type { Route } from 'next';

export function TenantAdminTopBar({
  breadcrumb,
  actions,
}: {
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const { me, token, apiBase } = useTenantAdminSession();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const tenantCode = me?.tenant_code ?? 'Tenant';
  const initials = tenantCode.slice(0, 2).toUpperCase();

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || !token) {
      return;
    }
    setSearching(true);
    try {
      const hit = await resolveTenantAdminSearch(trimmed, {
        apiBase,
        token,
        isAdmin: me?.is_admin ?? false,
      });
      if (!hit) {
        toast(`No docket, grievance, or service matched “${trimmed}”.`, 'warning');
        return;
      }
      router.push(tenantAdminSearchHref(hit) as Route);
      setQuery('');
    } catch {
      toast('Search failed. Check your connection and try again.', 'danger');
    } finally {
      setSearching(false);
    }
  }, [apiBase, me?.is_admin, query, router, toast, token]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void runSearch();
  }

  return (
    <header className="hidden items-center gap-4 border-b border-warm-border bg-surface px-6 py-3 lg:flex">
      <div className="min-w-0 flex-1">
        {breadcrumb ?? (
          <p className="truncate text-sm text-ink-secondary">
            <span className="font-semibold text-ink-primary">{tenantCode}</span>
            <span className="mx-2 text-ink-muted">·</span>
            <span>Tenant Admin</span>
          </p>
        )}
      </div>
      <form className="relative hidden max-w-xs flex-1 xl:block" onSubmit={onSubmit}>
        <label htmlFor="tenant-admin-search" className="sr-only">
          Search dockets, grievances, and services
        </label>
        <input
          ref={searchRef}
          id="tenant-admin-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={searching || !token}
          placeholder="Search dockets, services…"
          className="w-full rounded-xl border border-warm-border bg-canvas py-2.5 pl-10 pr-16 text-sm text-ink-primary placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-60"
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
          ⌕
        </span>
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-warm-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-muted sm:inline">
          ⌘K
        </kbd>
      </form>
      <div className="flex items-center gap-3">
        {actions}
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-muted text-xs font-bold text-brand"
          title={me?.roles?.join(', ') ?? 'Operator'}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
