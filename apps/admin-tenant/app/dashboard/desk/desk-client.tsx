'use client';

import { AlertBanner, Button, KpiCard, PageHeader, SegmentedControl } from '@enagar/ui';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { DeskApplicationDocumentsPanel } from '../../../components/desk-application-documents-panel';
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
  pending_designation: string | null;
  pending_at_label: string | null;
  payment_status: string;
  payment_schedule?: 'upfront_only' | 'deferred_only' | 'upfront_and_deferred';
  fee_settlement?: Partial<
    Record<
      'application' | 'approval',
      {
        status: 'not_required' | 'pending' | 'paid' | 'failed';
        amount_paise?: number | null;
      }
    >
  >;
  payment_redirect_url?: string | null;
  active_payment_id?: string | null;
  booking_charges?: {
    application_fee_paise: number;
    hall_rent_paise: number;
    security_deposit_paise: number;
    upfront_total_paise: number;
    upfront_paid_paise: number;
    application_fee_status: 'not_required' | 'pending' | 'paid' | 'failed';
    hall_rent_status: 'not_required' | 'pending' | 'paid' | 'failed';
    security_deposit_status: 'not_required' | 'pending' | 'paid' | 'failed';
    slot_summary: string | null;
  };
  submitted_at: string;
};

type AllowedTransition = {
  verb: string;
  to_stage: string;
  label: string;
  requires_comment: boolean;
  requires_boc_resolution_fields?: boolean;
  officer_may_set_require_boc?: boolean;
  boc_policy?: string;
};

type ApplicationDocumentRow = {
  id: string;
  document_code: string;
  original_name: string;
  mime_type: string;
  size_mb: number;
  upload_status: string;
  scan_status: string;
  created_at: string;
  workflow_stage_code?: string;
  uploaded_by_role?: string;
  note?: string;
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
    documents: ApplicationDocumentRow[];
  };
  work_order: {
    id: string;
    work_order_no: string;
    status: string;
    vendor_id: string | null;
    assigned_user_id: string | null;
  } | null;
  vendors: Array<{ id: string; code: string; name: { en: string }; is_active: boolean }>;
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

function formatInrFromPaise(paise: number | null | undefined): string {
  if (paise == null || !Number.isFinite(paise)) {
    return '—';
  }
  return `₹${(paise / 100).toFixed(2)}`;
}

function DeskBookingChargesPanel({
  charges,
}: {
  charges: NonNullable<ApplicationRow['booking_charges']>;
}): JSX.Element {
  const line = (label: string, amount: number, status: string): JSX.Element | null => {
    if (amount <= 0 && status === 'not_required') {
      return null;
    }
    return (
      <li>
        {label}: {status}
        {amount > 0 ? ` · ${formatInrFromPaise(amount)}` : ''}
      </li>
    );
  };

  return (
    <div className="rounded-2xl border border-warm-border bg-surface px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
        Hall booking charges
      </p>
      {charges.slot_summary ? (
        <p className="mt-1 text-sm text-ink-primary">
          Slot: <strong>{charges.slot_summary}</strong>
        </p>
      ) : null}
      <ul className="mt-2 space-y-1 text-sm text-ink-primary">
        {line('Application fee', charges.application_fee_paise, charges.application_fee_status)}
        {line('Hall rent (slot hours)', charges.hall_rent_paise, charges.hall_rent_status)}
        {line('Security deposit', charges.security_deposit_paise, charges.security_deposit_status)}
      </ul>
      <p className="mt-2 text-sm font-semibold text-ink-primary">
        Upfront total: {formatInrFromPaise(charges.upfront_total_paise)} · Paid:{' '}
        {formatInrFromPaise(charges.upfront_paid_paise)}
      </p>
    </div>
  );
}

function DeskFeeSettlementPanel({
  application,
}: {
  application: ApplicationRow;
}): JSX.Element | null {
  const lines = application.fee_settlement;
  if (!lines || (!lines.application && !lines.approval)) {
    return (
      <div className="rounded-2xl border border-warm-border bg-mint-band/20 px-4 py-3 text-sm text-ink-secondary">
        Payment rollup: <strong className="text-ink-primary">{application.payment_status}</strong>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-warm-border bg-mint-band/20 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
        Fees &amp; payment
      </p>
      <p className="mt-1 text-sm text-ink-primary">
        Rollup: <strong>{application.payment_status}</strong>
        {application.payment_schedule ? (
          <span className="text-ink-secondary"> · schedule {application.payment_schedule}</span>
        ) : null}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-ink-primary">
        {(['application', 'approval'] as const).map((code) => {
          const line = lines[code];
          if (!line) {
            return null;
          }
          return (
            <li key={code}>
              <span className="capitalize">{code.replace('_', ' ')}</span>: {line.status}
              {line.amount_paise != null ? ` · ${formatInrFromPaise(line.amount_paise)}` : ''}
            </li>
          );
        })}
      </ul>
      {application.active_payment_id ? (
        <p className="mt-2 text-xs text-ink-secondary">
          Active citizen payment: <span className="font-mono">{application.active_payment_id}</span>
        </p>
      ) : null}
    </div>
  );
}

function DeskWorkOrderPanel({
  applicationDetail,
  onAssignVendor,
}: {
  applicationDetail: ApplicationDetail;
  onAssignVendor: (vendorId: string) => Promise<void>;
}): JSX.Element | null {
  const workOrder = applicationDetail.work_order;
  if (!workOrder) {
    return null;
  }
  const vendors = applicationDetail.vendors ?? [];
  return (
    <div className="rounded-2xl border border-warm-border bg-surface px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Work order</p>
      <p className="mt-1 text-sm text-ink-primary">
        <strong>{workOrder.work_order_no}</strong> · {workOrder.status}
      </p>
      {vendors.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block text-xs text-ink-secondary">
            Assign vendor
            <select
              className="mt-1 block rounded-lg border border-warm-border bg-white px-3 py-2 text-sm"
              defaultValue={workOrder.vendor_id ?? ''}
              onChange={(event) => {
                const vendorId = event.target.value;
                if (vendorId) {
                  void onAssignVendor(vendorId);
                }
              }}
            >
              <option value="">Select vendor…</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name.en} ({vendor.code})
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
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
  const [appDetailTab, setAppDetailTab] = useState<'summary' | 'form' | 'documents' | 'timeline'>(
    'summary',
  );
  const [appQueue, setAppQueue] = useState<'my' | 'all'>('my');
  const [grievanceQueue, setGrievanceQueue] = useState<'my' | 'all' | 'breached'>('my');
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [grievances, setGrievances] = useState<GrievanceRow[]>([]);
  const [applicationDetail, setApplicationDetail] = useState<ApplicationDetail | null>(null);
  const [grievanceDetail, setGrievanceDetail] = useState<GrievanceDetail | null>(null);
  const [comment, setComment] = useState('');
  const [requireBoc, setRequireBoc] = useState(false);
  const [bocResolutionNumber, setBocResolutionNumber] = useState('');
  const [bocResolutionDate, setBocResolutionDate] = useState('');
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
    setRequireBoc(false);
    setBocResolutionNumber('');
    setBocResolutionDate('');
  }

  async function transitionApplication(verb: string): Promise<void> {
    if (!token || !applicationDetail) return;
    const officerBocChoice = applicationDetail.allowed_transitions.some(
      (item) => item.officer_may_set_require_boc,
    );
    let actionVerb = verb;
    if (officerBocChoice && requireBoc) {
      if (verb === 'approve-to-executive') {
        actionVerb = 'route-to-boc';
      }
    }
    const selected = applicationDetail.allowed_transitions.find(
      (item) => item.verb === actionVerb || item.verb === verb,
    );
    const body: {
      verb: string;
      comment?: string;
      require_boc?: boolean;
      boc_resolution?: { resolution_number: string; resolution_date: string };
    } = { verb: actionVerb, comment: comment.trim() || undefined };
    if ((selected?.requires_comment || actionVerb === 'reject') && !body.comment) {
      setStatus('Comment is required for this workflow action.');
      return;
    }
    if (selected?.requires_boc_resolution_fields) {
      const resolution_number = bocResolutionNumber.trim();
      const resolution_date = bocResolutionDate.trim();
      if (!resolution_number || !resolution_date) {
        setStatus('BOC resolution number and date are required for this action.');
        return;
      }
      body.boc_resolution = { resolution_number, resolution_date };
    }
    if (officerBocChoice && requireBoc && actionVerb === 'route-to-boc') {
      body.require_boc = true;
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
    setRequireBoc(false);
    setBocResolutionNumber('');
    setBocResolutionDate('');
    await loadDesk();
  }

  async function assignWorkOrderVendor(vendorId: string): Promise<void> {
    if (!token || !applicationDetail) return;
    const res = await fetch(
      `${apiBase}/admin/tenant/desk/applications/${applicationDetail.application.id}/work-order`,
      {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ vendor_id: vendorId }),
      },
    );
    if (!res.ok) {
      setStatus(`Work order assign failed (${res.status}).`);
      return;
    }
    setApplicationDetail((await res.json()) as ApplicationDetail);
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
        <AlertBanner tone="warning" className="mb-2">
          {status}
        </AlertBanner>
      ) : null}

      {summary ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="My applications" value={summary.applications_my_queue} />
          <KpiCard label="All applications" value={summary.applications_all_open} />
          <KpiCard label="My grievances" value={summary.grievances_my_queue} />
          <KpiCard label="All grievances" value={summary.grievances_all_open} />
          <KpiCard label="SLA breached" value={summary.grievances_sla_breached} accent="danger" />
        </section>
      ) : null}

      <SegmentedControl
        aria-label="Desk inbox type"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'applications', label: 'Applications' },
          { value: 'grievances', label: 'Grievances' },
        ]}
      />

      {tab === 'applications' ? (
        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(240px,28%)_minmax(0,1fr)_minmax(240px,27%)]">
          <Panel title="Application inbox">
            <QueueSwitch
              value={appQueue}
              options={me?.is_admin ? ['my', 'all'] : ['my']}
              onChange={(next) => setAppQueue(next as 'my' | 'all')}
            />
            <ul className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto">
              {applications.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void openApplication(row.docket_no)}
                    className={[
                      'w-full rounded-xl border p-3 text-left transition',
                      applicationDetail?.application.docket_no === row.docket_no
                        ? 'border-brand bg-brand-muted/40 shadow-sm'
                        : 'border-warm-border bg-surface hover:bg-brand-muted/20',
                    ].join(' ')}
                  >
                    <p className="font-mono text-xs font-semibold text-ink-primary">
                      {row.docket_no}
                    </p>
                    <p className="mt-1 text-sm text-ink-primary">{row.service_name}</p>
                    <p className="mt-1 text-xs text-ink-secondary">
                      {row.current_stage} · Pending at{' '}
                      {row.pending_at_label ?? row.pending_role ?? 'none'}
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
                <DetailTabs
                  value={appDetailTab}
                  onChange={setAppDetailTab}
                  tabs={[
                    { id: 'summary', label: 'Summary' },
                    { id: 'form', label: 'Form data' },
                    { id: 'documents', label: 'Documents' },
                    { id: 'timeline', label: 'Timeline' },
                  ]}
                />
                {appDetailTab === 'summary' ? (
                  <>
                    {applicationDetail.application.booking_charges ? (
                      <DeskBookingChargesPanel
                        charges={applicationDetail.application.booking_charges}
                      />
                    ) : null}
                    <DeskFeeSettlementPanel application={applicationDetail.application} />
                    <DeskWorkOrderPanel
                      applicationDetail={applicationDetail}
                      onAssignVendor={assignWorkOrderVendor}
                    />
                    <FormDataSummary data={applicationDetail.application.form_data} />
                  </>
                ) : null}
                {appDetailTab === 'form' ? (
                  <JsonFallbackPanel
                    readOnly
                    title="Raw form data (JSON)"
                    description="Expand only when you need the exact submitted payload."
                    value={prettyJson(applicationDetail.application.form_data)}
                  />
                ) : null}
                {appDetailTab === 'documents' && token ? (
                  <DeskApplicationDocumentsPanel
                    apiBase={apiBase}
                    token={token}
                    applicationId={applicationDetail.application.id}
                    currentStage={applicationDetail.application.current_stage}
                    documents={applicationDetail.application.documents}
                    onUploaded={() => {
                      void openApplication(applicationDetail.application.docket_no);
                    }}
                  />
                ) : null}
                {appDetailTab === 'timeline' ? (
                  <Timeline rows={applicationDetail.application.timeline} />
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-ink-secondary">Select a docket.</p>
            )}
          </Panel>

          <Panel title="Workflow actions">
            {applicationDetail ? (
              <ApplicationWorkflowPanel
                applicationDetail={applicationDetail}
                comment={comment}
                onCommentChange={setComment}
                requireBoc={requireBoc}
                onRequireBocChange={setRequireBoc}
                bocResolutionNumber={bocResolutionNumber}
                onBocResolutionNumberChange={setBocResolutionNumber}
                bocResolutionDate={bocResolutionDate}
                onBocResolutionDateChange={setBocResolutionDate}
                onTransition={(verb) => void transitionApplication(verb)}
              />
            ) : (
              <p className="text-sm text-ink-secondary">Select a docket to see workflow actions.</p>
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

function DetailTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1 border-b border-warm-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={[
            'min-h-[44px] border-b-2 px-3 py-2 text-sm font-semibold transition',
            value === tab.id
              ? 'border-brand text-brand'
              : 'border-transparent text-ink-secondary hover:text-ink-primary',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ApplicationWorkflowPanel({
  applicationDetail,
  comment,
  onCommentChange,
  requireBoc,
  onRequireBocChange,
  bocResolutionNumber,
  onBocResolutionNumberChange,
  bocResolutionDate,
  onBocResolutionDateChange,
  onTransition,
}: {
  applicationDetail: ApplicationDetail;
  comment: string;
  onCommentChange: (value: string) => void;
  requireBoc: boolean;
  onRequireBocChange: (value: boolean) => void;
  bocResolutionNumber: string;
  onBocResolutionNumberChange: (value: string) => void;
  bocResolutionDate: string;
  onBocResolutionDateChange: (value: string) => void;
  onTransition: (verb: string) => void;
}): JSX.Element {
  const officerBocAtScrutiny = applicationDetail.allowed_transitions.some(
    (item) => item.officer_may_set_require_boc,
  );
  const actionTransitions = applicationDetail.allowed_transitions.filter((transition) => {
    if (!officerBocAtScrutiny) {
      return true;
    }
    if (transition.verb === 'route-to-boc') {
      return requireBoc;
    }
    if (transition.verb === 'approve-to-executive') {
      return !requireBoc;
    }
    return true;
  });
  const needsRouteFallback =
    officerBocAtScrutiny &&
    requireBoc &&
    !actionTransitions.some((item) => item.verb === 'route-to-boc');

  return (
    <div className="space-y-4">
      <textarea
        value={comment}
        onChange={(event) => onCommentChange(event.target.value)}
        className="min-h-24 w-full rounded-xl border border-warm-border bg-surface px-3 py-2 text-sm text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        placeholder="Comment for workflow action"
      />
      {officerBocAtScrutiny ? (
        <div className="space-y-2 rounded-2xl border border-warm-border bg-mint-band/30 p-3">
          <label className="flex items-center gap-2 text-sm text-ink-primary">
            <input
              type="checkbox"
              checked={requireBoc}
              onChange={(event) => onRequireBocChange(event.target.checked)}
            />
            Require Board of Councillors (BOC) resolution before executive approval
          </label>
          <p className="text-xs text-ink-secondary">
            {requireBoc
              ? 'Use Route to BOC — do not use Approve to executive (that path skips BOC).'
              : 'Leave unchecked to approve directly to executive without BOC.'}
          </p>
        </div>
      ) : null}
      {applicationDetail.allowed_transitions.some((item) => item.requires_boc_resolution_fields) ? (
        <div className="grid gap-3">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-secondary">
            BOC resolution number
            <input
              className="mt-1 w-full rounded-lg border border-warm-border px-3 py-2 text-sm normal-case tracking-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              value={bocResolutionNumber}
              onChange={(event) => onBocResolutionNumberChange(event.target.value)}
            />
          </label>
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-secondary">
            BOC resolution date
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-warm-border px-3 py-2 text-sm normal-case tracking-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              value={bocResolutionDate}
              onChange={(event) => onBocResolutionDateChange(event.target.value)}
            />
          </label>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        {actionTransitions.map((transition) => (
          <Button
            key={transition.verb}
            type="button"
            onClick={() => onTransition(transition.verb)}
            variant="primary"
            size="sm"
            className="w-full justify-center"
          >
            {transition.label} → {transition.to_stage}
          </Button>
        ))}
        {needsRouteFallback ? (
          <Button
            type="button"
            onClick={() => onTransition('route-to-boc')}
            variant="primary"
            size="sm"
            className="w-full justify-center"
          >
            Route to BOC → boc-resolution
          </Button>
        ) : null}
        {!applicationDetail.allowed_transitions.length ? (
          <p className="text-sm text-ink-secondary">No allowed actions for your role.</p>
        ) : null}
      </div>
    </div>
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
