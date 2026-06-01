import { headers } from 'next/headers';
import Link from 'next/link';

import { StateLoginTheme } from '../../components/state-login-theme';
import { resolvePortalHubHomeUrl } from '../../lib/portal-hub-url';

export default function LogoutPage(): JSX.Element {
  const host = headers().get('host')?.split(':')[0];
  const hubUrl = resolvePortalHubHomeUrl(host ?? undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
      <StateLoginTheme />
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-3xl border border-warm-border bg-surface p-8 shadow-sm">
          <p className="inline-flex rounded-full bg-platform-band px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            Signed out
          </p>
          <h1 className="mt-4 text-2xl font-bold text-ink-primary">You have left State Admin</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Return to the main eNagar portal to open Citizen, Tenant, or State apps.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <a
              href={hubUrl}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-platform-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-accent/30"
            >
              Home — eNagar portal
            </a>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-warm-border bg-surface px-5 py-3 text-sm font-semibold text-ink-primary transition hover:bg-canvas"
            >
              Sign in again
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
