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
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-warm-border bg-surface shadow-md md:grid-cols-2">
        <div className="flex flex-col justify-center bg-sidebar px-10 py-12 text-ink-onDark">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-onDarkMuted">
            eNagar platform
          </p>
          <h2 className="mt-4 text-2xl font-bold leading-tight">Statewide municipal operations</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-onDarkMuted">
            Cross-tenant oversight, global service templates, and audited access for West Bengal
            platform administrators.
          </p>
          <p className="mt-6 text-xs font-semibold text-brand">
            Platform teal · WB State Super-Admin
          </p>
        </div>
        <div className="px-10 py-12">
          <p className="inline-flex rounded-full bg-platform-band px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            State operations
          </p>
          <h1 className="mt-4 text-2xl font-bold text-ink-primary">Sign in</h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Use a Keycloak account with the <span className="font-mono text-xs">state_admin</span>{' '}
            role.
          </p>
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger"
            >
              Sign-in could not be completed. <span className="font-mono text-xs">{error}</span>
            </p>
          ) : null}
          <StateLoginActions />
          <p className="mt-6 text-center text-xs text-ink-muted">
            Dummy: <span className="font-mono">sddm-state-admin-dummy</span>
          </p>
        </div>
      </div>
    </main>
  );
}
