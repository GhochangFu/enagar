'use client';

import { Icon } from '@enagar/ui';
import { useCallback, useEffect, useId, useState } from 'react';

import { SahayakWorkspace } from './sahayak-workspace';

import type { TokenResponse, PwaLocaleCode } from '../lib/workspace-types';
import type { JSX } from 'react';

export function SahayakFloatingAssistant({
  apiBaseUrl,
  token,
  language,
  tenantCode,
  tenantName,
}: {
  apiBaseUrl: string;
  token: TokenResponse;
  language: PwaLocaleCode;
  tenantCode: string | null;
  tenantName: string | null;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const drawerTitleId = useId();
  const hasTenant = Boolean(tenantCode && tenantName);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        close();
      }
    }
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close, open]);

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Open Sahayak AI assistant"
        className="sahayak-fab group fixed bottom-6 right-6 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand via-brand to-forest text-white shadow-lg shadow-brand/30 transition-transform duration-200 hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:bottom-8 sm:right-8 sm:h-16 sm:w-16"
        onClick={() => setOpen(true)}
        type="button"
      >
        <span
          aria-hidden
          className="sahayak-fab-ring pointer-events-none absolute inset-0 rounded-full"
        />
        <Icon className="relative z-[1] drop-shadow-sm" name="bot" size={28} />
        <span className="pointer-events-none absolute -top-10 right-0 hidden whitespace-nowrap rounded-xl bg-ink-primary px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100 sm:block">
          Sahayak AI
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[50] flex justify-end" role="presentation">
          <button
            aria-label="Close Sahayak"
            className="absolute inset-0 bg-ink-primary/35 backdrop-blur-[2px] transition-opacity"
            onClick={close}
            type="button"
          />
          <aside
            aria-labelledby={drawerTitleId}
            aria-modal="true"
            className="sahayak-drawer-panel relative flex h-full w-full max-w-md flex-col border-l border-warm-border/80 bg-surface shadow-2xl"
            role="dialog"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-warm-border bg-gradient-to-r from-peach-accent/25 via-brand-muted/40 to-mint-band/30 px-4 py-3 backdrop-blur-sm">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-forest text-white shadow">
                  <Icon name="bot" size={22} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black text-ink-primary" id={drawerTitleId}>
                    Sahayak
                  </h2>
                  <p className="truncate text-xs font-medium text-ink-secondary">
                    {hasTenant ? `${tenantName} (${tenantCode})` : 'Municipal AI assistant'}
                  </p>
                </div>
              </div>
              <button
                aria-label="Close drawer"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-warm-border bg-white/80 text-ink-secondary transition-colors hover:bg-white hover:text-ink-primary"
                onClick={close}
                type="button"
              >
                <span aria-hidden className="text-xl leading-none">
                  ×
                </span>
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
              {hasTenant ? (
                <SahayakWorkspace
                  apiBaseUrl={apiBaseUrl}
                  language={language}
                  layout="drawer"
                  tenantCode={tenantCode!}
                  tenantName={tenantName!}
                  token={token}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-warm-border bg-mint-band/40 px-6 py-10 text-center">
                  <p className="text-sm font-medium leading-relaxed text-ink-secondary">
                    Pin a municipality on Home, or open a ULB workspace, to chat with Sahayak about
                    services, documents, and grievances.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
