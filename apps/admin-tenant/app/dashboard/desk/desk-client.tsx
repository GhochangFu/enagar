'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { publicEnv } from '../../../lib/env/public-env';
import {
  ADMIN_OAUTH_STORAGE_KEY,
  type AdminOAuthBundle,
} from '../../../lib/oauth/session-storage-keys';

type DeskMe = {
  tenant_code?: string;
  roles: string[];
  normalized_roles: string[];
  is_admin: boolean;
};

type DeskSummary = {
  applications_my_queue: number;
  applications_all_open: number;
  grievances_my_queue: number;
  grievances_all_open: number;
  grievances_sla_breached: number;
};

type ApplicationRow = {
  id: string;
  docket_no: string;
  service_code: string;
  service_name: string;
  status: string;
  status_label: string;
  current_stage: string;
  pending_role: string | null;
  payment_status: string;
  submitted_at: string;
};

type AllowedTransition = {
  verb: string;
  to_stage: string;
  label: string;
  requires_comment: boolean;
};

type ApplicationDetail = {
  application: ApplicationRow & {
    form_data: unknown;
    timeline: Array<{
      id: string;
      from_stage: string | null;
      to_stage: string;
      verb: string;
      actor_role: string;
      comment: string | null;
      created_at: string;
    }>;
    documents: unknown;
  };
  allowed_transitions: AllowedTransition[];
};

type GrievanceRow = {
  id: string;
  grievance_no: string;
  category: string;
  status: string;
  priority: string;
  routed_role_code: string | null;
  assigned_to_user_id: string | null;
  sla_due_at: string | null;
  sla_breached_at: string | null;
  created_at: string;
};

type GrievanceDetail = {
  grievance: GrievanceRow & {
    description: string;
    location: unknown;
  };
  timeline: Array<{
    id: string;
    event_type: string;
    actor_subject: string;
    body: string | null;
    occurred_at: string;
  }>;
  allowed_statuses: string[];
};

function readStoredAuth(): AdminOAuthBundle | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(ADMIN_OAUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AdminOAuthBundle;
    return parsed.access_token && parsed.expires_at ? parsed : null;
  } catch {
    return null;
  }
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value);
  }
}

export default function DeskClient(): JSX.Element {
  const router = useRouter();
  const fallbackApi = useMemo(() => publicEnv().apiBaseUrl, []);

  const [token, setToken] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState(fallbackApi);
  const [status, setStatus] = useState<string | null>(null);
  const [me, setMe] = useState<DeskMe | null>(null);
  const [summary, setSummary] = useState<DeskSummary | null>(null);
  const [tab, setTab] = useState<'applications' | 'grievances'>('applications');
  const [appQueue, setAppQueue] = useState<'my' | 'all'>('my');
  const [grievanceQueue, setGrievanceQueue] = useState<'my' | 'all' | 'breached'>('my');
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [grievances, setGrievances] = useState<GrievanceRow[]>([]);
  const [applicationDetail, setApplicationDetail] = useState<ApplicationDetail | null>(null);
  const [grievanceDetail, setGrievanceDetail] = useState<GrievanceDetail | null>(null);
  const [comment, setComment] = useState('');
  const [assignUserId, setAssignUserId] = useState('');

  useEffect(() => {
    const auth = readStoredAuth();
    if (!auth) {
      router.replace('/login');
      return;
    }
    if (auth.expires_at < Math.floor(Date.now() / 1000)) {
      sessionStorage.removeItem(ADMIN_OAUTH_STORAGE_KEY);
      router.replace('/login?error=session_expired');
      return;
    }
    setToken(auth.access_token);
    setApiBase(auth.api_base_url ?? fallbackApi);
  }, [fallbackApi, router]);

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const loadDesk = useCallback(async () => {
    if (!token) return;
    setStatus(null);
    try {
      const [meRes, summaryRes, appRes, grievanceRes] = await Promise.all([
        fetch(`${apiBase}/admin/tenant/desk/me`, { cache: 'no-store', headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/desk/inbox/summary`, {
          cache: 'no-store',
          headers: authHeaders(),
        }),
        fetch(`${apiBase}/admin/tenant/desk/inbox/applications?queue=${appQueue}`, {
          cache: 'no-store',
          headers: authHeaders(),
        }),
        fetch(`${apiBase}/admin/tenant/desk/inbox/grievances?queue=${grievanceQueue}`, {
          cache: 'no-store',
          headers: authHeaders(),
        }),
      ]);
      if (!meRes.ok || !summaryRes.ok || !appRes.ok || !grievanceRes.ok) {
        setStatus(
          `Desk API error (${meRes.status}/${summaryRes.status}/${appRes.status}/${grievanceRes.status}).`,
        );
        return;
      }
      setMe((await meRes.json()) as DeskMe);
      setSummary((await summaryRes.json()) as DeskSummary);
      setApplications((await appRes.json()) as ApplicationRow[]);
      setGrievances((await grievanceRes.json()) as GrievanceRow[]);
    } catch {
      setStatus('Network error loading Desk.');
    }
  }, [apiBase, appQueue, authHeaders, grievanceQueue, token]);

  useEffect(() => {
    void loadDesk();
  }, [loadDesk]);

  useEffect(() => {
    if (typeof window === 'undefined' || !token) return;
    const search = new URLSearchParams(window.location.search);
    const docket = search.get('docket');
    const grievance = search.get('grievance');
    if (docket) {
      setTab('applications');
      void openApplication(docket);
    }
    if (grievance) {
      setTab('grievances');
      void openGrievance(grievance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function openApplication(docketNo: string): Promise<void> {
    if (!token) return;
    const res = await fetch(
      `${apiBase}/admin/tenant/desk/applications/${encodeURIComponent(docketNo)}`,
      { cache: 'no-store', headers: authHeaders() },
    );
    if (!res.ok) {
      setStatus(`Application load failed (${res.status}).`);
      return;
    }
    setApplicationDetail((await res.json()) as ApplicationDetail);
    setComment('');
  }

  async function transitionApplication(verb: string): Promise<void> {
    if (!token || !applicationDetail) return;
    const selected = applicationDetail.allowed_transitions.find((item) => item.verb === verb);
    const body = { verb, comment: comment.trim() || undefined };
    if (selected?.requires_comment && !body.comment) {
      setStatus('Comment is required for this workflow action.');
      return;
    }
    const res = await fetch(
      `${apiBase}/admin/tenant/desk/applications/${applicationDetail.application.id}/transitions`,
      { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) },
    );
    if (!res.ok) {
      setStatus(`Application action failed (${res.status}): ${(await res.text()).slice(0, 180)}`);
      return;
    }
    setApplicationDetail((await res.json()) as ApplicationDetail);
    setComment('');
    await loadDesk();
  }

  async function openGrievance(id: string): Promise<void> {
    if (!token) return;
    const res = await fetch(`${apiBase}/admin/tenant/desk/grievances/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    if (!res.ok) {
      setStatus(`Grievance load failed (${res.status}).`);
      return;
    }
    setGrievanceDetail((await res.json()) as GrievanceDetail);
    setComment('');
  }

  async function updateGrievanceStatus(statusValue: string): Promise<void> {
    if (!token || !grievanceDetail) return;
    const res = await fetch(
      `${apiBase}/admin/tenant/desk/grievances/${grievanceDetail.grievance.id}/status`,
      {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: statusValue, note: comment.trim() || undefined }),
      },
    );
    if (!res.ok) {
      setStatus(`Grievance status failed (${res.status}): ${(await res.text()).slice(0, 180)}`);
      return;
    }
    setGrievanceDetail((await res.json()) as GrievanceDetail);
    setComment('');
    await loadDesk();
  }

  async function commentGrievance(): Promise<void> {
    if (!token || !grievanceDetail || !comment.trim()) return;
    const res = await fetch(
      `${apiBase}/admin/tenant/desk/grievances/${grievanceDetail.grievance.id}/comment`,
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ body: comment.trim() }) },
    );
    if (!res.ok) {
      setStatus(`Comment failed (${res.status}).`);
      return;
    }
    setGrievanceDetail((await res.json()) as GrievanceDetail);
    setComment('');
  }

  async function assignGrievance(): Promise<void> {
    if (!token || !grievanceDetail || !assignUserId.trim()) return;
    const res = await fetch(
      `${apiBase}/admin/tenant/desk/grievances/${grievanceDetail.grievance.id}/assign`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ user_id: assignUserId.trim() }),
      },
    );
    if (!res.ok) {
      setStatus(`Assign failed (${res.status}): ${(await res.text()).slice(0, 180)}`);
      return;
    }
    setGrievanceDetail((await res.json()) as GrievanceDetail);
    setAssignUserId('');
    await loadDesk();
  }

  async function sweepSla(): Promise<void> {
    if (!token) return;
    const res = await fetch(`${apiBase}/admin/tenant/desk/grievances/staff/sweep-sla`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) {
      setStatus(`SLA sweep failed (${res.status}).`);
      return;
    }
    const body = (await res.json()) as { breached: number };
    setStatus(`SLA sweep complete. Breached: ${body.breached}.`);
    await loadDesk();
  }

  function logout(): void {
    sessionStorage.removeItem(ADMIN_OAUTH_STORAGE_KEY);
    router.replace('/login');
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-slate-600">Checking session…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sprint 6.13 · Operator Desk
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">Desk</h1>
          <p className="mt-2 text-sm text-slate-600">
            {me?.tenant_code ? <span className="font-mono">{me.tenant_code}</span> : 'Loading'} ·{' '}
            {me?.roles.join(', ') ?? 'roles'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {me?.is_admin ? (
            <>
              <a className="btn-secondary" href="/dashboard">
                Dashboard
              </a>
              <a className="btn-secondary" href="/dashboard/operations">
                Operations
              </a>
            </>
          ) : null}
          <button type="button" onClick={() => void loadDesk()} className="btn-secondary">
            Refresh
          </button>
          <button type="button" onClick={logout} className="btn-secondary">
            Sign out
          </button>
        </div>
      </header>

      {status ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {status}
        </p>
      ) : null}

      {summary ? (
        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <Metric label="My applications" value={summary.applications_my_queue} />
          <Metric label="All applications" value={summary.applications_all_open} />
          <Metric label="My grievances" value={summary.grievances_my_queue} />
          <Metric label="All grievances" value={summary.grievances_all_open} />
          <Metric label="SLA breached" value={summary.grievances_sla_breached} />
        </section>
      ) : null}

      <section className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setTab('applications')}
          className={tab === 'applications' ? 'btn-primary' : 'btn-secondary'}
        >
          Applications
        </button>
        <button
          type="button"
          onClick={() => setTab('grievances')}
          className={tab === 'grievances' ? 'btn-primary' : 'btn-secondary'}
        >
          Grievances
        </button>
      </section>

      {tab === 'applications' ? (
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Application inbox">
            <QueueSwitch
              value={appQueue}
              options={me?.is_admin ? ['my', 'all'] : ['my']}
              onChange={(next) => setAppQueue(next as 'my' | 'all')}
            />
            <ul className="mt-4 space-y-3">
              {applications.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void openApplication(row.docket_no)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                  >
                    <p className="font-mono text-xs font-semibold text-slate-900">
                      {row.docket_no}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">{row.service_name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.current_stage} · pending {row.pending_role ?? 'none'}
                    </p>
                  </button>
                </li>
              ))}
              {!applications.length ? (
                <li className="text-sm text-slate-500">No applications.</li>
              ) : null}
            </ul>
          </Panel>

          <Panel title="Application detail">
            {applicationDetail ? (
              <div className="space-y-4">
                <DetailHeader
                  title={applicationDetail.application.docket_no}
                  subtitle={`${applicationDetail.application.service_name} · ${applicationDetail.application.status_label}`}
                />
                <pre className="max-h-56 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
                  {prettyJson(applicationDetail.application.form_data)}
                </pre>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="min-h-24 w-full rounded border border-slate-300 p-2 text-sm"
                  placeholder="Comment for workflow action"
                />
                <div className="flex flex-wrap gap-2">
                  {applicationDetail.allowed_transitions.map((transition) => (
                    <button
                      key={transition.verb}
                      type="button"
                      onClick={() => void transitionApplication(transition.verb)}
                      className="btn-primary"
                    >
                      {transition.label} → {transition.to_stage}
                    </button>
                  ))}
                  {!applicationDetail.allowed_transitions.length ? (
                    <p className="text-sm text-slate-500">No allowed actions for your role.</p>
                  ) : null}
                </div>
                <Timeline rows={applicationDetail.application.timeline} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a docket.</p>
            )}
          </Panel>
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Grievance inbox">
            <div className="flex flex-wrap items-center gap-2">
              <QueueSwitch
                value={grievanceQueue}
                options={me?.is_admin ? ['my', 'all', 'breached'] : ['my']}
                onChange={(next) => setGrievanceQueue(next as 'my' | 'all' | 'breached')}
              />
              {me?.is_admin ? (
                <button type="button" onClick={() => void sweepSla()} className="btn-secondary">
                  Sweep SLA
                </button>
              ) : null}
            </div>
            <ul className="mt-4 space-y-3">
              {grievances.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void openGrievance(row.id)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                  >
                    <p className="font-mono text-xs font-semibold text-slate-900">
                      {row.grievance_no}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {row.category} · {row.priority}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.status} · routed {row.routed_role_code ?? 'none'}
                    </p>
                  </button>
                </li>
              ))}
              {!grievances.length ? (
                <li className="text-sm text-slate-500">No grievances.</li>
              ) : null}
            </ul>
          </Panel>

          <Panel title="Grievance detail">
            {grievanceDetail ? (
              <div className="space-y-4">
                <DetailHeader
                  title={grievanceDetail.grievance.grievance_no}
                  subtitle={`${grievanceDetail.grievance.category} · ${grievanceDetail.grievance.status}`}
                />
                <p className="rounded bg-slate-50 p-3 text-sm text-slate-700">
                  {grievanceDetail.grievance.description}
                </p>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="min-h-24 w-full rounded border border-slate-300 p-2 text-sm"
                  placeholder="Comment / status note"
                />
                <div className="flex flex-wrap gap-2">
                  {grievanceDetail.allowed_statuses.map((next) => (
                    <button
                      key={next}
                      type="button"
                      onClick={() => void updateGrievanceStatus(next)}
                      className="btn-primary"
                    >
                      Mark {next}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void commentGrievance()}
                    className="btn-secondary"
                  >
                    Add comment
                  </button>
                </div>
                {me?.is_admin ? (
                  <div className="flex gap-2">
                    <input
                      value={assignUserId}
                      onChange={(event) => setAssignUserId(event.target.value)}
                      className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="User UUID to assign"
                    />
                    <button
                      type="button"
                      onClick={() => void assignGrievance()}
                      className="btn-secondary"
                    >
                      Assign
                    </button>
                  </div>
                ) : null}
                <Timeline
                  rows={grievanceDetail.timeline.map((row) => ({
                    id: row.id,
                    from_stage: null,
                    to_stage: row.event_type,
                    verb: row.event_type,
                    actor_role: row.actor_subject,
                    comment: row.body,
                    created_at: row.occurred_at,
                  }))}
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a grievance.</p>
            )}
          </Panel>
        </section>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function QueueSwitch({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={value === item ? 'btn-primary' : 'btn-secondary'}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function DetailHeader({ title, subtitle }: { title: string; subtitle: string }): JSX.Element {
  return (
    <div>
      <p className="font-mono text-xs font-semibold text-slate-500">{title}</p>
      <h3 className="text-xl font-semibold text-slate-900">{subtitle}</h3>
    </div>
  );
}

function Timeline({
  rows,
}: {
  rows: Array<{
    id: string;
    from_stage: string | null;
    to_stage: string;
    verb: string;
    actor_role: string;
    comment: string | null;
    created_at: string;
  }>;
}): JSX.Element {
  return (
    <ol className="space-y-2 border-t border-slate-200 pt-4">
      {rows.map((row) => (
        <li key={row.id} className="rounded border border-slate-100 bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-900">
            {row.verb}: {row.from_stage ?? 'start'} → {row.to_stage}
          </p>
          <p className="text-xs text-slate-500">
            {row.actor_role} · {new Date(row.created_at).toLocaleString()}
          </p>
          {row.comment ? <p className="mt-1 text-slate-700">{row.comment}</p> : null}
        </li>
      ))}
      {!rows.length ? <li className="text-sm text-slate-500">No timeline events.</li> : null}
    </ol>
  );
}
