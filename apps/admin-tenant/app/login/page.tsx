import Link from 'next/link';

import { LoginTheme } from '../../components/login-theme';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}): JSX.Element {
  const errorRaw = searchParams?.error;
  const error = typeof errorRaw === 'string' ? errorRaw : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
      <LoginTheme />
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-3xl border border-warm-border bg-surface p-8 shadow-sm">
          <p className="inline-flex rounded-full bg-mint-band px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest">
            Tenant operator
          </p>
          <h1 className="mt-4 text-2xl font-bold text-ink-primary">Sign in to your municipality</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Use your operator account to open the Desk, configure services, and monitor KPIs for
            your ULB.
          </p>
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            >
              Sign-in could not be completed. <span className="font-mono text-xs">{error}</span>
            </p>
          ) : null}
          <Link
            href="/api/admin-auth/start"
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-brand-fg shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          >
            Continue to sign in
          </Link>
        </div>
        <p className="text-center text-xs text-ink-secondary">
          Local development: seed operators with{' '}
          <span className="font-mono">pnpm infra:seed-keycloak-users</span> (see{' '}
          <span className="font-mono">docs/runbooks/keycloak.md</span>).
        </p>
      </div>
    </main>
  );
}
