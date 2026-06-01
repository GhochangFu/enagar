'use client';

import { useToast } from '@enagar/ui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type JSX,
  type ReactNode,
} from 'react';

import { resolveStateAdminSearch, type StateAdminSearchHit } from '../lib/state-admin-search';

type SearchCatalogue = {
  tenants: Array<{ code: string; name: string }>;
  library: Array<{ code: string; name?: unknown }>;
};

export function StateAdminTopBar({
  breadcrumb,
  searchCatalogue,
  onSearchHit,
}: {
  breadcrumb?: ReactNode;
  searchCatalogue: SearchCatalogue;
  onSearchHit: (hit: StateAdminSearchHit) => void;
}): JSX.Element {
  const { toast } = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const runSearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    try {
      const hit = resolveStateAdminSearch(trimmed, searchCatalogue);
      if (!hit) {
        toast(`No ULB, template, or audit actor matched “${trimmed}”.`, 'warning');
        return;
      }
      onSearchHit(hit);
      setQuery('');
    } finally {
      setSearching(false);
    }
  }, [onSearchHit, query, searchCatalogue, toast]);

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
    runSearch();
  }

  return (
    <header className="hidden items-center gap-4 border-b border-warm-border bg-surface px-6 py-3 lg:flex">
      <div className="min-w-0 flex-1">{breadcrumb}</div>
      <form className="relative hidden max-w-xs flex-1 xl:block" onSubmit={onSubmit}>
        <label htmlFor="state-admin-search" className="sr-only">
          Search ULBs, templates, and audit actors
        </label>
        <input
          ref={searchRef}
          id="state-admin-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={searching}
          placeholder="Search ULB, template, actor…"
          className="w-full rounded-xl border border-warm-border bg-canvas py-2.5 pl-10 pr-16 text-sm text-ink-primary placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-60"
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
          ⌕
        </span>
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-warm-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-muted sm:inline">
          ⌘K
        </kbd>
      </form>
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-muted text-xs font-bold text-brand"
        title="State super-admin"
      >
        WB
      </div>
    </header>
  );
}
