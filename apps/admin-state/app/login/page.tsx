import Link from 'next/link';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}): JSX.Element {
  const error = typeof searchParams?.error === 'string' ? searchParams.error : undefined;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-700">
          Master Sprint 6.5
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">State Super-Admin Portal</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with a Keycloak token that includes{' '}
          <span className="font-mono text-xs">state_admin</span>. This portal manages municipality
          onboarding, tenant support, impersonation, and cross-tenant analytics.
        </p>
      </div>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Sign-in error: <span className="font-mono">{error}</span>
        </p>
      ) : null}
      <Link
        href="/api/admin-auth/start"
        className="inline-flex items-center justify-center rounded-lg bg-indigo-700 px-4 py-3 text-sm font-medium text-white shadow hover:bg-indigo-800"
      >
        Continue to Keycloak
      </Link>
      <Link
        href="/api/admin-auth/logout"
        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
      >
        Sign out of Keycloak and try again
      </Link>
      <p className="text-xs text-slate-500">
        Use <span className="font-mono">sddm-state-admin-dummy</span> (all lowercase) and password{' '}
        <span className="font-mono">DummyDev_2026!ChangeMe</span>. After OTP setup, sign-in always
        asks for password + Google Authenticator. If the dashboard still shows 401, restart the API
        dev server so it picks up{' '}
        <span className="font-mono">KEYCLOAK_API_AUDIENCE=enagar-api,account</span>.
      </p>
    </main>
  );
}
