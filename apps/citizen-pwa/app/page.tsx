export default function HomePage(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-6 px-6 py-16">
      <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
        Phase 0 · Foundations
      </span>
      <h1 className="text-4xl font-bold leading-tight md:text-5xl">eNagarSeba — Citizen PWA</h1>
      <p className="max-w-prose text-lg text-slate-600">
        This is the Phase-0 scaffold. Real shell, navigation, theming, language switcher, and
        service catalogue land in Phase 2 once the API and tenant configuration land in Phase 1.
      </p>
      <ul className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-semibold">API:</span> <code>http://localhost:3001/health</code>
        </li>
        <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-semibold">Swagger:</span> <code>http://localhost:3001/docs</code>
        </li>
        <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-semibold">Tenant theme:</span> <code>--brand-rgb</code> CSS var
        </li>
        <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="font-semibold">Sahayak AI:</span> Phase 7 (per ADR-0008)
        </li>
      </ul>
    </main>
  );
}
