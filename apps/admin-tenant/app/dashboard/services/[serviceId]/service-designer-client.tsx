'use client';

import {
  createRenderPlan,
  validateFormSchema,
  type EnagarFormSchema,
  type FormSubmission,
} from '@enagar/forms';
import { DynamicFormFields } from '@enagar/forms/web';
import { validateWorkflowDefinition, type WorkflowDefinition } from '@enagar/workflow';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { publicEnv } from '../../../../lib/env/public-env';
import {
  ADMIN_OAUTH_STORAGE_KEY,
  type AdminOAuthBundle,
} from '../../../../lib/oauth/session-storage-keys';

type ServiceDesignerResponse = {
  service: {
    id: string;
    code: string;
    name: unknown;
  };
  form_draft: { form_schema: unknown; status: string; version: number } | null;
  form_published: {
    form_schema: unknown;
    status: string;
    version: number;
    published_at: string | null;
  } | null;
  workflow_draft: { definition: WorkflowDefinition; status: string; version: number } | null;
  workflow_published: {
    definition: WorkflowDefinition;
    status: string;
    version: number;
    published_at: string | null;
  } | null;
  starter_form_schema: EnagarFormSchema;
  starter_workflow: WorkflowDefinition;
};

type Values = FormSubmission;

function readStoredAuth(): AdminOAuthBundle | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = sessionStorage.getItem(ADMIN_OAUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AdminOAuthBundle;
    if (!parsed.access_token || typeof parsed.expires_at !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Service';
  }
  return 'Service';
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function ServiceDesignerClient({ serviceId }: { serviceId: string }): JSX.Element {
  const router = useRouter();
  const fallbackApi = useMemo(() => publicEnv().apiBaseUrl, []);

  const [token, setToken] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState(fallbackApi);
  const [designer, setDesigner] = useState<ServiceDesignerResponse | null>(null);
  const [formText, setFormText] = useState('');
  const [workflowText, setWorkflowText] = useState('');
  const [values, setValues] = useState<Values>({});
  const [status, setStatus] = useState<string | null>(null);

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
  }, [router, fallbackApi]);

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const loadDesigner = useCallback(async () => {
    if (!token) {
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/services/${serviceId}/designer`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      setStatus(`Designer load failed (${res.status}).`);
      return;
    }
    const data = (await res.json()) as ServiceDesignerResponse;
    setDesigner(data);
    setFormText(
      pretty(
        data.form_draft?.form_schema ??
          data.form_published?.form_schema ??
          data.starter_form_schema,
      ),
    );
    setWorkflowText(
      pretty(
        data.workflow_draft?.definition ??
          data.workflow_published?.definition ??
          data.starter_workflow,
      ),
    );
    setValues({});
    setStatus(null);
  }, [apiBase, authHeaders, serviceId, token]);

  useEffect(() => {
    void loadDesigner();
  }, [loadDesigner]);

  const parsedForm = useMemo(() => {
    try {
      const schema = JSON.parse(formText) as EnagarFormSchema;
      return { schema, validation: validateFormSchema(schema) };
    } catch {
      return {
        schema: null,
        validation: { ok: false, issues: [{ path: '$', message: 'Invalid JSON' }] },
      };
    }
  }, [formText]);

  const parsedWorkflow = useMemo(() => {
    try {
      const workflow = JSON.parse(workflowText) as WorkflowDefinition;
      return { workflow, validation: validateWorkflowDefinition(workflow) };
    } catch {
      return {
        workflow: null,
        validation: { ok: false, issues: [{ path: '$', message: 'Invalid JSON' }] },
      };
    }
  }, [workflowText]);

  const renderPlan = useMemo(() => {
    if (!parsedForm.schema || !parsedForm.validation.ok) {
      return null;
    }
    return createRenderPlan(parsedForm.schema, { platform: 'web', values });
  }, [parsedForm, values]);

  async function persistFormDraft(): Promise<boolean> {
    if (!token || !parsedForm.schema || !parsedForm.validation.ok) {
      setStatus('Form schema must be valid before saving.');
      return false;
    }
    const res = await fetch(`${apiBase}/admin/tenant/services/${serviceId}/form-draft`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ form_schema: parsedForm.schema, ui_schema: {} }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      setStatus(`Form save failed (${res.status}). ${body.slice(0, 180)}`);
      return false;
    }
    return true;
  }

  async function saveForm(): Promise<void> {
    const saved = await persistFormDraft();
    if (saved) {
      setStatus('Form draft saved.');
      await loadDesigner();
    }
  }

  async function publishForm(): Promise<void> {
    if (!token) {
      return;
    }
    const saved = await persistFormDraft();
    if (!saved) {
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/services/${serviceId}/form-draft/publish`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
    setStatus(res.ok ? 'Form draft published.' : `Form publish failed (${res.status}).`);
    if (res.ok) {
      await loadDesigner();
    }
  }

  async function persistWorkflowDraft(): Promise<boolean> {
    if (!token || !parsedWorkflow.workflow || !parsedWorkflow.validation.ok) {
      setStatus('Workflow definition must be valid before saving.');
      return false;
    }
    const res = await fetch(`${apiBase}/admin/tenant/services/${serviceId}/workflow-draft`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ workflow: parsedWorkflow.workflow }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      setStatus(`Workflow save failed (${res.status}). ${body.slice(0, 180)}`);
      return false;
    }
    return true;
  }

  async function saveWorkflow(): Promise<void> {
    const saved = await persistWorkflowDraft();
    if (saved) {
      setStatus('Workflow draft saved.');
      await loadDesigner();
    }
  }

  async function publishWorkflow(): Promise<void> {
    if (!token) {
      return;
    }
    const saved = await persistWorkflowDraft();
    if (!saved) {
      return;
    }
    const res = await fetch(
      `${apiBase}/admin/tenant/services/${serviceId}/workflow-draft/publish`,
      {
        method: 'PATCH',
        headers: authHeaders(),
      },
    );
    setStatus(res.ok ? 'Workflow draft published.' : `Workflow publish failed (${res.status}).`);
    if (res.ok) {
      await loadDesigner();
    }
  }

  if (!token || !designer) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-slate-600">Loading service designer…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-slate-500 underline">
            Back to dashboard
          </Link>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
            Sprint 6.2 · Form Schema Builder + Workflow Designer
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            {pickLabel(designer.service.name)}
          </h1>
          <p className="mt-2 font-mono text-xs text-slate-500">{designer.service.code}</p>
        </div>
        {status ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {status}
          </p>
        ) : null}
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <EditorPanel
            title="Form schema draft"
            meta={`Published: ${designer.form_published?.version ?? 'none'} · Draft: ${
              designer.form_draft?.version ?? 'new'
            }`}
            value={formText}
            onChange={setFormText}
            valid={parsedForm.validation.ok}
            issues={parsedForm.validation.issues}
            onSave={() => void saveForm()}
            onPublish={() => void publishForm()}
          />
          <EditorPanel
            title="Workflow definition draft"
            meta={`Published: ${designer.workflow_published?.version ?? 'none'} · Draft: ${
              designer.workflow_draft?.version ?? 'new'
            }`}
            value={workflowText}
            onChange={setWorkflowText}
            valid={parsedWorkflow.validation.ok}
            issues={parsedWorkflow.validation.issues}
            onSave={() => void saveWorkflow()}
            onPublish={() => void publishWorkflow()}
          />
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Citizen preview</h2>
          <p className="mt-1 text-xs text-slate-500">
            Rendered through <span className="font-mono">@enagar/forms/web</span>.
          </p>
          <div className="mt-5 rounded-[2rem] border-8 border-slate-900 bg-slate-50 p-4 shadow-inner">
            {renderPlan ? (
              <DynamicFormFields
                nodes={renderPlan.nodes}
                values={values}
                onChange={(fieldId, value) => setValues((prev) => ({ ...prev, [fieldId]: value }))}
              />
            ) : (
              <p className="text-sm text-slate-500">Fix schema issues to see preview.</p>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function EditorPanel({
  title,
  meta,
  value,
  onChange,
  valid,
  issues,
  onSave,
  onPublish,
}: {
  title: string;
  meta: string;
  value: string;
  onChange: (value: string) => void;
  valid: boolean;
  issues: Array<{ path: string; message: string }>;
  onSave: () => void;
  onPublish: () => void;
}): JSX.Element {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500">{meta}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={onPublish}
            className="rounded bg-[rgb(var(--brand-rgb))] px-3 py-2 text-xs font-medium text-white hover:opacity-95"
          >
            Publish
          </button>
        </div>
      </div>
      <textarea
        className="h-80 w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-50"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className={valid ? 'mt-3 text-xs text-emerald-700' : 'mt-3 text-xs text-red-700'}>
        {valid ? (
          <p>Valid.</p>
        ) : (
          <ul className="space-y-1">
            {issues.slice(0, 5).map((issue) => (
              <li key={`${issue.path}:${issue.message}`}>
                <span className="font-mono">{issue.path}</span>: {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
