import { StateLoginActions } from '../../components/state-login-actions';
import { StateLoginTheme } from '../../components/state-login-theme';

/** Client mount applies `applyStateAdminTheme` (teal platform accent). */

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}): JSX.Element {
  const error = typeof searchParams?.error === 'string' ? searchParams.error : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
      <StateLoginTheme />
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-3xl border border-warm-border bg-surface p-8 shadow-sm ring-1 ring-cyan-100">
          <p className="inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-platform-accent">
            State operations
          </p>
          <h1 className="mt-4 text-2xl font-bold text-ink-primary">State Super-Admin</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Sign in with a Keycloak account that includes the{' '}
            <span className="font-mono text-xs">state_admin</span> role.
          </p>
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            >
              Sign-in could not be completed. <span className="font-mono text-xs">{error}</span>
            </p>
          ) : null}
          <StateLoginActions />
        </div>
        <p className="text-center text-xs text-ink-secondary">
          Dummy: <span className="font-mono">sddm-state-admin-dummy</span> ·{' '}
          <span className="font-mono">DummyDev_2026!ChangeMe</span>
        </p>
      </div>
    </main>
  );
}
