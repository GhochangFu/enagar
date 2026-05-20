'use client';

import { Button, PageHeader } from '@enagar/ui';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { DeskGrievanceEvidencePanel } from '../../../components/desk-grievance-evidence-panel';
import { DeskGrievanceLocationMap } from '../../../components/desk-grievance-location-map';
import { JsonFallbackPanel } from '../../../components/json-fallback-panel';
import { useTenantAdminSession } from '../../../components/tenant-admin-session';
import {
  locationSummaryWithoutCoords,
  parseGrievanceLocationPin,
} from '../../../lib/grievance-location';

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
  category_label: string;
  subtype_code: string | null;
  subtype_label: string | null;
  status: string;
  priority: string;
  routed_role_code: string | null;
  assigned_to_user_id: string | null;
  sla_due_at: string | null;
  sla_breached_at: string | null;
  created_at: string;
};

type GrievanceAttachment = {
  id: string;
  content_type: string;
  storage_key: string;
  created_at: string;
  download_url: string;
};

type GrievanceDetail = {
  grievance: GrievanceRow & {
    description: string;
    location: unknown;
    photo_keys: unknown;
    attachments: GrievanceAttachment[];
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

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value);
  }
}

function humanizeFieldKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return prettyJson(value);
  return String(value);
}

function FormDataSummary({ data }: { data: unknown }): JSX.Element {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return (
      <p className="rounded-2xl border border-warm-border bg-mint-band/30 px-4 py-3 text-sm text-ink-secondary">
        No structured application fields to display.
      </p>
    );
  }

  const entries = Object.entries(data as Record<string, unknown>);
  if (!entries.length) {
    return (
      <p className="rounded-2xl border border-warm-border bg-mint-band/30 px-4 py-3 text-sm text-ink-secondary">
        Application form is empty.
      </p>
    );
  }

  return (
    <dl className="grid gap-3 rounded-2xl border border-warm-border bg-mint-band/30 p-4 md:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
            {humanizeFieldKey(key)}
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-ink-primary">{formatFieldValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function DeskClient(): JSX.Element {
  const { token, apiBase, me, refreshMe } = useTenantAdminSession();
  const [status, setStatus] = useState<string | null>(null);
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
      const [summaryRes, appRes, grievanceRes] = await Promise.all([
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
      if (!summaryRes.ok || !appRes.ok || !grievanceRes.ok) {
        setStatus(`Desk API error (${summaryRes.status}/${appRes.status}/${grievanceRes.status}).`);
        return;
      }
      setSummary((await summaryRes.json()) as DeskSummary);
      setApplications((await appRes.json()) as ApplicationRow[]);
      setGrievances((await grievanceRes.json()) as GrievanceRow[]);
      await refreshMe();
    } catch {
      setStatus('Network error loading Desk.');
    }
  }, [apiBase, appQueue, authHeaders, grievanceQueue, refreshMe, token]);

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

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Operator Desk"
        title="Desk"
        subtitle={
          me?.tenant_code
            ? `${me.tenant_code} · ${me.roles.join(', ')}`
            : 'Applications and grievances inbox'
        }
        actions={
          <Button type="button" variant="secondary" onClick={() => void loadDesk()}>
            Refresh inbox
          </Button>
        }
      />

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
        <Button
          type="button"
          variant={tab === 'applications' ? 'primary' : 'secondary'}
          onClick={() => setTab('applications')}
        >
          Applications
        </Button>
        <Button
          type="button"
          variant={tab === 'grievances' ? 'primary' : 'secondary'}
          onClick={() => setTab('grievances')}
        >
          Grievances
        </Button>
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
                    className="w-full rounded-xl border border-warm-border bg-surface p-3 text-left transition hover:bg-brand-muted/20"
                  >
                    <p className="font-mono text-xs font-semibold text-ink-primary">
                      {row.docket_no}
                    </p>
                    <p className="mt-1 text-sm text-ink-primary">{row.service_name}</p>
                    <p className="mt-1 text-xs text-ink-secondary">
                      {row.current_stage} · pending {row.pending_role ?? 'none'}
                    </p>
                  </button>
                </li>
              ))}
              {!applications.length ? (
                <li className="text-sm text-ink-secondary">No applications.</li>
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
                <FormDataSummary data={applicationDetail.application.form_data} />
                <JsonFallbackPanel
                  readOnly
                  title="Raw form data (JSON)"
                  description="Expand only when you need the exact submitted payload."
                  value={prettyJson(applicationDetail.application.form_data)}
                />
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="min-h-24 w-full rounded-xl border border-warm-border bg-surface px-3 py-2 text-sm text-ink-primary"
                  placeholder="Comment for workflow action"
                />
                <div className="flex flex-wrap gap-2">
                  {applicationDetail.allowed_transitions.map((transition) => (
                    <Button
                      key={transition.verb}
                      type="button"
                      onClick={() => void transitionApplication(transition.verb)}
                      variant="primary"
                      size="sm"
                    >
                      {transition.label} → {transition.to_stage}
                    </Button>
                  ))}
                  {!applicationDetail.allowed_transitions.length ? (
                    <p className="text-sm text-ink-secondary">No allowed actions for your role.</p>
                  ) : null}
                </div>
                <Timeline rows={applicationDetail.application.timeline} />
              </div>
            ) : (
              <p className="text-sm text-ink-secondary">Select a docket.</p>
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
                <Button type="button" variant="secondary" size="sm" onClick={() => void sweepSla()}>
                  Sweep SLA
                </Button>
              ) : null}
            </div>
            <ul className="mt-4 space-y-3">
              {grievances.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void openGrievance(row.id)}
                    className="w-full rounded-xl border border-warm-border bg-surface p-3 text-left transition hover:bg-brand-muted/20"
                  >
                    <p className="font-mono text-xs font-semibold text-ink-primary">
                      {row.grievance_no}
                    </p>
                    <p className="mt-1 text-sm text-ink-primary">
                      {row.category_label}
                      {row.subtype_label ? ` · ${row.subtype_label}` : ''} · {row.priority}
                    </p>
                    <p className="mt-1 text-xs text-ink-secondary">
                      {row.status} · routed {row.routed_role_code ?? 'none'}
                    </p>
                  </button>
                </li>
              ))}
              {!grievances.length ? (
                <li className="text-sm text-ink-secondary">No grievances.</li>
              ) : null}
            </ul>
          </Panel>

          <Panel title="Grievance detail">
            {grievanceDetail ? (
              <div className="space-y-4">
                <DetailHeader
                  title={grievanceDetail.grievance.grievance_no}
                  subtitle={`${grievanceDetail.grievance.category_label}${grievanceDetail.grievance.subtype_label ? ` · ${grievanceDetail.grievance.subtype_label}` : ''} · ${grievanceDetail.grievance.status}`}
                />
                <p className="rounded-2xl border border-warm-border bg-mint-band/30 p-4 text-sm text-ink-primary">
                  {grievanceDetail.grievance.description}
                </p>
                {token ? (
                  <DeskGrievanceEvidencePanel
                    apiBase={apiBase}
                    token={token}
                    grievanceId={grievanceDetail.grievance.id}
                    attachments={grievanceDetail.grievance.attachments ?? []}
                    photoKeys={grievanceDetail.grievance.photo_keys}
                  />
                ) : null}
                {(() => {
                  const pin = parseGrievanceLocationPin(grievanceDetail.grievance.location);
                  const locationNotes = locationSummaryWithoutCoords(
                    grievanceDetail.grievance.location,
                  );
                  if (!pin && !locationNotes) {
                    return null;
                  }
                  return (
                    <section className="space-y-3">
                      <h4 className="text-sm font-semibold text-ink-primary">Location</h4>
                      {pin ? (
                        <DeskGrievanceLocationMap latitude={pin.lat} longitude={pin.lng} />
                      ) : null}
                      {locationNotes ? <FormDataSummary data={locationNotes} /> : null}
                      {pin ? (
                        <dl className="grid gap-3 rounded-2xl border border-warm-border bg-mint-band/30 p-4 md:grid-cols-2">
                          <div>
                            <dt className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
                              Latitude
                            </dt>
                            <dd className="mt-0.5 font-mono text-sm text-ink-primary">{pin.lat}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
                              Longitude
                            </dt>
                            <dd className="mt-0.5 font-mono text-sm text-ink-primary">{pin.lng}</dd>
                          </div>
                        </dl>
                      ) : null}
                      <JsonFallbackPanel
                        readOnly
                        title="Raw location (JSON)"
                        description="Power-user escape hatch."
                        value={prettyJson(grievanceDetail.grievance.location)}
                      />
                    </section>
                  );
                })()}
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="min-h-24 w-full rounded-xl border border-warm-border bg-surface px-3 py-2 text-sm text-ink-primary"
                  placeholder="Comment / status note"
                />
                <div className="flex flex-wrap gap-2">
                  {grievanceDetail.allowed_statuses.map((next) => (
                    <Button
                      key={next}
                      type="button"
                      size="sm"
                      onClick={() => void updateGrievanceStatus(next)}
                    >
                      Mark {next}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void commentGrievance()}
                  >
                    Add comment
                  </Button>
                </div>
                {me?.is_admin ? (
                  <div className="flex gap-2">
                    <input
                      value={assignUserId}
                      onChange={(event) => setAssignUserId(event.target.value)}
                      className="flex-1 rounded-xl border border-warm-border bg-surface px-3 py-2 text-sm text-ink-primary"
                      placeholder="User UUID to assign"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void assignGrievance()}
                    >
                      Assign
                    </Button>
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
              <p className="text-sm text-ink-secondary">Select a grievance.</p>
            )}
          </Panel>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <article className="rounded-2xl border border-warm-border bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-ink-primary">{value}</p>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
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
        <Button
          key={item}
          type="button"
          size="sm"
          variant={value === item ? 'primary' : 'secondary'}
          onClick={() => onChange(item)}
        >
          {item}
        </Button>
      ))}
    </div>
  );
}

function DetailHeader({ title, subtitle }: { title: string; subtitle: string }): JSX.Element {
  return (
    <div>
      <p className="font-mono text-xs font-semibold text-ink-secondary">{title}</p>
      <h3 className="text-xl font-semibold text-ink-primary">{subtitle}</h3>
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
    <ol className="space-y-2 border-t border-warm-border pt-4">
      {rows.map((row) => (
        <li
          key={row.id}
          className="rounded-xl border border-warm-border bg-mint-band/20 p-3 text-sm"
        >
          <p className="font-medium text-ink-primary">
            {row.verb}: {row.from_stage ?? 'start'} → {row.to_stage}
          </p>
          <p className="text-xs text-ink-secondary">
            {row.actor_role} · {new Date(row.created_at).toLocaleString()}
          </p>
          {row.comment ? <p className="mt-1 text-ink-primary">{row.comment}</p> : null}
        </li>
      ))}
      {!rows.length ? <li className="text-sm text-ink-secondary">No timeline events.</li> : null}
    </ol>
  );
}
