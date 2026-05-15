import Link from 'next/link';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}): JSX.Element {
  const errorRaw = searchParams?.error;
  const error = typeof errorRaw === 'string' ? errorRaw : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tenant Admin Portal</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with your municipality operator account (Keycloak{' '}
          <span className="font-mono text-xs">admin-tenant</span> client). JWT must include{' '}
          <span className="font-mono text-xs">tenant_admin</span>,{' '}
          <span className="font-mono text-xs">municipality_admin</span>, or{' '}
          <span className="font-mono text-xs">state_admin</span>.
        </p>
      </div>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Sign-in error: <span className="font-mono">{error}</span>
        </p>
      ) : null}
      <Link
        href="/api/admin-auth/start"
        className="inline-flex items-center justify-center rounded-lg bg-[rgb(var(--brand-rgb))] px-4 py-3 text-sm font-medium text-white shadow hover:opacity-95"
      >
        Continue to Keycloak
      </Link>
      <p className="text-xs text-slate-500">
        Dev tip: use a dummy ULB operator from{' '}
        <span className="font-mono">pnpm infra:seed-keycloak-users</span>.{' '}
        <span className="font-mono">tenant_admin</span> tokens require MFA per API verifier unless
        you use <span className="font-mono">municipality_admin</span> for smoke tests.
      </p>
    </main>
  );
}
