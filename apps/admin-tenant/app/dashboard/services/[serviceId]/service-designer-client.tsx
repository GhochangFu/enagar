'use client';

import {
  validateFormSchema,
  type EnagarFormField,
  type EnagarFormSchema,
  type FormFieldType,
  type FormSubmission,
} from '@enagar/forms';
import {
  FIELD_DRAG_MIME,
  CrossFieldRulesPanel,
  FormCitizenPreview,
  FormSchemaBuilder,
  FormSchemaJsonFallback,
  cloneFormSchema,
  fieldPaletteItem,
  localeMap,
  nextSequence,
  pretty,
  slugify,
} from '@enagar/forms/builder';
import { Button, PageHeader } from '@enagar/ui';
import {
  validateWorkflowDefinition,
  type WorkflowDefinition,
  type WorkflowEffectType,
  type WorkflowStage,
  type WorkflowTransition,
} from '@enagar/workflow';
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from '../../../../components/tenant-admin-session';
import { clearStoredAuth } from '../../../../lib/admin-auth';

import { ServiceConfigPanel } from './service-config-panel';

import type { Route } from 'next';

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
  global_form_template: {
    global_code: string;
    has_usable_form_schema: boolean;
    field_count: number;
  } | null;
};

type ServiceConfigResponse = {
  fee_rule: unknown;
  fee_preview_paise: number | null;
  required_documents: unknown;
  revenue_head: { code: string; accounting_code: string } | null;
};

type RevenueHeadRow = {
  code: string;
  name: unknown;
  accounting_code: string;
  is_active: boolean;
};

type Values = FormSubmission;

function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Service';
  }
  return 'Service';
}

const DEFAULT_STAGE_ROLES = ['tenant_clerk', 'tenant_admin', 'citizen'];
const DEFAULT_EFFECT_TYPES = ['audit', 'notify', 'sla_timer', 'certificate', 'escalate'];

function cloneWorkflow(workflow: WorkflowDefinition): WorkflowDefinition {
  return JSON.parse(JSON.stringify(workflow)) as WorkflowDefinition;
}

function buildWorkflowNodes(workflow: WorkflowDefinition): Node[] {
  return workflow.stages.map((stage, index) => ({
    id: stage.code,
    type: 'default',
    position: { x: 40 + index * 220, y: stage.terminal ? 210 : stage.initial ? 20 : 115 },
    data: {
      label: `${stage.label.en}${stage.initial ? ' (initial)' : ''}${stage.terminal ? ' (terminal)' : ''}`,
    },
    style: {
      border: stage.initial
        ? '2px solid #059669'
        : stage.terminal
          ? '2px solid #dc2626'
          : '1px solid #94a3b8',
      borderRadius: 14,
      padding: 12,
      width: 180,
      background: '#ffffff',
      color: '#0f172a',
      fontSize: 12,
      fontWeight: 600,
    },
  }));
}

function buildWorkflowEdges(workflow: WorkflowDefinition): Edge[] {
  return workflow.transitions.map((transition, index) => ({
    id: `${transition.from}-${transition.to}-${transition.verb}-${index}`,
    source: transition.from,
    target: transition.to,
    label: transition.verb,
    markerEnd: { type: MarkerType.ArrowClosed },
    type: 'smoothstep',
    animated: transition.effects?.some((effect) => effect.type === 'notify') ?? false,
    style: { stroke: '#0f4c75', strokeWidth: 2 },
    labelStyle: { fill: '#0f172a', fontSize: 11, fontWeight: 600 },
  }));
}

export default function ServiceDesignerClient({ serviceId }: { serviceId: string }): JSX.Element {
  const router = useRouter();
  const { token, apiBase } = useTenantAdminSession();
  const [designer, setDesigner] = useState<ServiceDesignerResponse | null>(null);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfigResponse | null>(null);
  const [revenueHeads, setRevenueHeads] = useState<RevenueHeadRow[]>([]);
  const [formText, setFormText] = useState('');
  const [workflowText, setWorkflowText] = useState('');
  const [feeText, setFeeText] = useState('');
  const [documentsText, setDocumentsText] = useState('');
  const [revenueHeadCode, setRevenueHeadCode] = useState('');
  const [values, setValues] = useState<Values>({});
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedStageCode, setSelectedStageCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  function redirectIfUnauthorized(res: Response): boolean {
    if (res.status !== 401) {
      return false;
    }
    clearStoredAuth();
    router.replace('/login?error=session_expired');
    return true;
  }

  const loadDesigner = useCallback(async () => {
    if (!token || !serviceId) {
      return;
    }
    setStatus(null);
    try {
      const [designerRes, configRes, revenueRes] = await Promise.all([
        fetch(`${apiBase}/admin/tenant/services/${serviceId}/designer`, {
          cache: 'no-store',
          headers: authHeaders(),
        }),
        fetch(`${apiBase}/admin/tenant/services/${serviceId}/config`, {
          cache: 'no-store',
          headers: authHeaders(),
        }),
        fetch(`${apiBase}/admin/tenant/revenue-heads`, {
          cache: 'no-store',
          headers: authHeaders(),
        }),
      ]);
      if (designerRes.status === 401 || configRes.status === 401 || revenueRes.status === 401) {
        clearStoredAuth();
        router.replace('/login?error=session_expired');
        return;
      }
      if (!designerRes.ok || !configRes.ok || !revenueRes.ok) {
        const detail = await designerRes.text().catch(() => '');
        setStatus(
          `Designer load failed (${designerRes.status}/${configRes.status}/${revenueRes.status}). ${detail.slice(0, 180)}`,
        );
        return;
      }
      const data = (await designerRes.json()) as ServiceDesignerResponse;
      const config = (await configRes.json()) as ServiceConfigResponse;
      const heads = (await revenueRes.json()) as RevenueHeadRow[];
      setDesigner(data);
      setServiceConfig(config);
      setRevenueHeads(heads.filter((head) => head.is_active));
      setFeeText(pretty(config.fee_rule));
      setDocumentsText(pretty(config.required_documents));
      setRevenueHeadCode(config.revenue_head?.code ?? '');
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
      setSelectedFieldId(null);
      setSelectedStageCode(null);
      setStatus(null);
    } catch {
      setStatus(
        `Could not reach the API at ${apiBase}. Start the API on port 3001 (pnpm --filter @enagar/api dev) and confirm NEXT_PUBLIC_API_BASE_URL.`,
      );
    }
  }, [apiBase, authHeaders, router, serviceId, token]);

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

  const parsedFee = useMemo(() => {
    try {
      return { value: JSON.parse(feeText) as unknown, valid: true };
    } catch {
      return { value: null, valid: false };
    }
  }, [feeText]);

  const parsedDocuments = useMemo(() => {
    try {
      return { value: JSON.parse(documentsText) as unknown, valid: true };
    } catch {
      return { value: null, valid: false };
    }
  }, [documentsText]);

  const workflowNodes = useMemo(
    () => (parsedWorkflow.workflow ? buildWorkflowNodes(parsedWorkflow.workflow) : []),
    [parsedWorkflow.workflow],
  );
  const workflowEdges = useMemo(
    () => (parsedWorkflow.workflow ? buildWorkflowEdges(parsedWorkflow.workflow) : []),
    [parsedWorkflow.workflow],
  );

  const updateFormSchema = useCallback(
    (updater: (schema: EnagarFormSchema) => EnagarFormSchema): void => {
      if (!parsedForm.schema) {
        setStatus('Fix form JSON before using the visual builder.');
        return;
      }
      const next = updater(cloneFormSchema(parsedForm.schema));
      setFormText(pretty(next));
      const validation = validateFormSchema(next);
      setStatus(validation.ok ? 'Form visual draft updated.' : 'Form visual draft has issues.');
    },
    [parsedForm.schema],
  );

  const updateWorkflow = useCallback(
    (updater: (workflow: WorkflowDefinition) => WorkflowDefinition): void => {
      if (!parsedWorkflow.workflow) {
        setStatus('Fix workflow JSON before using the visual canvas.');
        return;
      }
      const next = updater(cloneWorkflow(parsedWorkflow.workflow));
      setWorkflowText(pretty(next));
      const validation = validateWorkflowDefinition(next);
      setStatus(
        validation.ok ? 'Workflow canvas draft updated.' : 'Workflow canvas draft has issues.',
      );
    },
    [parsedWorkflow.workflow],
  );

  function addField(type: FormFieldType): void {
    const item = fieldPaletteItem(type);
    if (!item) {
      return;
    }
    updateFormSchema((schema) => {
      const field = item.build(nextSequence(schema.fields, type));
      setSelectedFieldId(field.id);
      return { ...schema, fields: [...schema.fields, field] };
    });
  }

  function onPaletteDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const type = event.dataTransfer.getData(FIELD_DRAG_MIME) as FormFieldType;
    if (type) {
      addField(type);
    }
  }

  function updateField(fieldId: string, patch: Partial<EnagarFormField>): void {
    if (typeof patch.id === 'string' && patch.id !== fieldId) {
      setSelectedFieldId(patch.id);
    }
    updateFormSchema((schema) => ({
      ...schema,
      fields: schema.fields.map((field) =>
        field.id === fieldId ? ({ ...field, ...patch } as EnagarFormField) : field,
      ),
    }));
  }

  function reorderField(fieldId: string, direction: -1 | 1): void {
    updateFormSchema((schema) => {
      const index = schema.fields.findIndex((field) => field.id === fieldId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= schema.fields.length) {
        return schema;
      }
      const fields = [...schema.fields];
      const [field] = fields.splice(index, 1);
      if (!field) {
        return schema;
      }
      fields.splice(target, 0, field);
      return { ...schema, fields };
    });
  }

  function removeField(fieldId: string): void {
    updateFormSchema((schema) => ({
      ...schema,
      fields: schema.fields.filter((field) => field.id !== fieldId),
    }));
    setSelectedFieldId(null);
  }

  function addWorkflowStage(): void {
    updateWorkflow((workflow) => {
      const sequence = workflow.stages.length + 1;
      const code = slugify(`review-${sequence}`, `stage-${sequence}`);
      const stage: WorkflowStage = {
        code,
        label: localeMap(`Review ${sequence}`),
        owner_role: 'tenant_clerk',
        sla_hours: 24,
      };
      setSelectedStageCode(code);
      return { ...workflow, stages: [...workflow.stages, stage] };
    });
  }

  function updateStage(stageCode: string, patch: Partial<WorkflowStage>): void {
    if (typeof patch.code === 'string' && patch.code !== stageCode) {
      setSelectedStageCode(patch.code);
    }
    updateWorkflow((workflow) => ({
      ...workflow,
      stages: workflow.stages.map((stage) =>
        stage.code === stageCode ? { ...stage, ...patch } : stage,
      ),
      transitions:
        typeof patch.code === 'string' && patch.code !== stageCode
          ? workflow.transitions.map((transition) => ({
              ...transition,
              from:
                transition.from === stageCode ? (patch.code ?? transition.from) : transition.from,
              to: transition.to === stageCode ? (patch.code ?? transition.to) : transition.to,
            }))
          : workflow.transitions,
    }));
  }

  function removeStage(stageCode: string): void {
    updateWorkflow((workflow) => ({
      ...workflow,
      stages: workflow.stages.filter((stage) => stage.code !== stageCode),
      transitions: workflow.transitions.filter(
        (transition) => transition.from !== stageCode && transition.to !== stageCode,
      ),
    }));
    setSelectedStageCode(null);
  }

  function addWorkflowTransition(): void {
    updateWorkflow((workflow) => {
      const from = workflow.stages.find((stage) => !stage.terminal)?.code;
      const to = workflow.stages.find((stage) => stage.code !== from)?.code;
      if (!from || !to) {
        return workflow;
      }
      const transition: WorkflowTransition = {
        from,
        to,
        verb: 'advance',
        actor_role: 'tenant_clerk',
        effects: [{ type: 'audit' }],
      };
      return { ...workflow, transitions: [...workflow.transitions, transition] };
    });
  }

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
      if (redirectIfUnauthorized(res)) {
        return false;
      }
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
    if (redirectIfUnauthorized(res)) {
      return;
    }
    setStatus(res.ok ? 'Form draft published.' : `Form publish failed (${res.status}).`);
    if (res.ok) {
      await loadDesigner();
    }
  }

  async function resyncFormFromGlobal(): Promise<void> {
    if (!token) {
      return;
    }
    const template = designer?.global_form_template;
    if (!template?.has_usable_form_schema) {
      return;
    }
    const confirmed = window.confirm(
      `Load the State global template (${template.global_code}, ${template.field_count} fields) into your form draft? Your published form stays live until you publish this draft.`,
    );
    if (!confirmed) {
      return;
    }
    const res = await fetch(
      `${apiBase}/admin/tenant/services/${serviceId}/form-draft/resync-from-global`,
      { method: 'POST', headers: authHeaders() },
    );
    if (redirectIfUnauthorized(res)) {
      return;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      setStatus(`State template load failed (${res.status}). ${body.slice(0, 180)}`);
      return;
    }
    const payload = (await res.json()) as {
      form_draft: { form_schema: unknown };
      global_code: string;
      field_count: number;
    };
    setFormText(pretty(payload.form_draft.form_schema));
    setStatus(
      `State template ${payload.global_code} loaded into draft (${payload.field_count} fields). Review and publish when ready.`,
    );
    await loadDesigner();
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
      if (redirectIfUnauthorized(res)) {
        return false;
      }
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
    if (redirectIfUnauthorized(res)) {
      return;
    }
    setStatus(res.ok ? 'Workflow draft published.' : `Workflow publish failed (${res.status}).`);
    if (res.ok) {
      await loadDesigner();
    }
  }

  async function saveServiceConfig(): Promise<void> {
    if (!token || !parsedFee.valid || !parsedDocuments.valid) {
      setStatus('Fee rule and document checklist must be valid JSON before saving.');
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/services/${serviceId}/config`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({
        fee_rule: parsedFee.value,
        required_documents: parsedDocuments.value,
        revenue_head_code: revenueHeadCode,
      }),
    });
    if (!res.ok) {
      if (redirectIfUnauthorized(res)) {
        return;
      }
      const body = await res.text().catch(() => '');
      setStatus(`Service config save failed (${res.status}). ${body.slice(0, 180)}`);
      return;
    }
    setStatus('Service configuration saved.');
    await loadDesigner();
  }

  if (!token || !designer || !serviceConfig) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-slate-600">Loading service designer…</p>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Service configuration"
        title={pickLabel(designer.service.name)}
        subtitle={`Service code ${designer.service.code}`}
        actions={
          <Link
            href={'/dashboard' as Route}
            className="text-sm font-medium text-brand hover:underline"
          >
            Back to catalogue
          </Link>
        }
      />

      {status ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {status}
        </p>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <FormSchemaBuilder
            schema={parsedForm.schema}
            valid={parsedForm.validation.ok}
            selectedFieldId={selectedFieldId}
            onSelectField={setSelectedFieldId}
            onAddField={addField}
            onDropField={onPaletteDrop}
            onUpdateField={updateField}
            onReorderField={reorderField}
            onRemoveField={removeField}
          />
          <CrossFieldRulesPanel
            fields={parsedForm.schema?.fields ?? []}
            rules={parsedForm.schema?.cross_field_rules ?? []}
            onChange={(rules) =>
              updateFormSchema((schema) => ({
                ...schema,
                cross_field_rules: rules.length > 0 ? rules : undefined,
              }))
            }
          />
          <EditorPanel
            title="Form schema draft"
            meta={`Published: ${designer.form_published?.version ?? 'none'} · Draft: ${
              designer.form_draft?.version ?? 'new'
            }${
              designer.global_form_template
                ? ` · State template: ${designer.global_form_template.global_code}${
                    designer.global_form_template.has_usable_form_schema
                      ? ` (${designer.global_form_template.field_count} fields)`
                      : ' (no usable form yet)'
                  }`
                : ''
            }`}
            value={formText}
            onChange={setFormText}
            valid={parsedForm.validation.ok}
            issues={parsedForm.validation.issues}
            onSave={() => void saveForm()}
            onPublish={() => void publishForm()}
            jsonMode="collapsed"
            secondaryAction={
              designer.global_form_template?.has_usable_form_schema
                ? {
                    label: 'Load State template',
                    onClick: () => void resyncFormFromGlobal(),
                  }
                : undefined
            }
          />
          <WorkflowCanvasPanel
            workflow={parsedWorkflow.workflow}
            valid={parsedWorkflow.validation.ok}
            nodes={workflowNodes}
            edges={workflowEdges}
            selectedStageCode={selectedStageCode}
            onSelectStage={setSelectedStageCode}
            onAddStage={addWorkflowStage}
            onUpdateStage={updateStage}
            onRemoveStage={removeStage}
            onAddTransition={addWorkflowTransition}
            onUpdateWorkflow={updateWorkflow}
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
          {/* Fee, documents, and revenue mapping stays on the Sprint 6.3 config contract. */}
          <ServiceConfigPanel
            serviceConfig={serviceConfig}
            revenueHeads={revenueHeads}
            feeText={feeText}
            documentsText={documentsText}
            revenueHeadCode={revenueHeadCode}
            parsedFee={parsedFee}
            parsedDocuments={parsedDocuments}
            onFeeTextChange={setFeeText}
            onDocumentsTextChange={setDocumentsText}
            onRevenueHeadCodeChange={setRevenueHeadCode}
            onSave={() => void saveServiceConfig()}
          />
        </div>

        <FormCitizenPreview
          schema={parsedForm.schema}
          valid={parsedForm.validation.ok}
          values={values}
          onChange={(fieldId, value) => setValues((prev) => ({ ...prev, [fieldId]: value }))}
          onValuesChange={setValues}
        />
      </section>
    </div>
  );
}

function WorkflowCanvasPanel({
  workflow,
  valid,
  nodes,
  edges,
  selectedStageCode,
  onSelectStage,
  onAddStage,
  onUpdateStage,
  onRemoveStage,
  onAddTransition,
  onUpdateWorkflow,
}: {
  workflow: WorkflowDefinition | null;
  valid: boolean;
  nodes: Node[];
  edges: Edge[];
  selectedStageCode: string | null;
  onSelectStage: (stageCode: string | null) => void;
  onAddStage: () => void;
  onUpdateStage: (stageCode: string, patch: Partial<WorkflowStage>) => void;
  onRemoveStage: (stageCode: string) => void;
  onAddTransition: () => void;
  onUpdateWorkflow: (updater: (workflow: WorkflowDefinition) => WorkflowDefinition) => void;
}): JSX.Element {
  const selectedStage = workflow?.stages.find((stage) => stage.code === selectedStageCode) ?? null;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sprint 6.7B · React Flow workflow canvas
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Visual workflow designer</h2>
          <p className="text-xs text-slate-500">
            Canvas edits the same workflow definition saved by the existing draft/publish API.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAddStage}
            className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white"
          >
            Add stage
          </button>
          <button
            type="button"
            onClick={onAddTransition}
            className="rounded bg-[rgb(var(--brand-rgb))] px-3 py-2 text-xs font-medium text-white"
          >
            Add transition
          </button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[420px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {workflow ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              onNodeClick={(_, node) => onSelectStage(node.id)}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
            >
              <Background />
              <Controls />
            </ReactFlow>
          ) : (
            <p className="p-4 text-sm text-slate-500">Fix workflow JSON before using the canvas.</p>
          )}
        </div>
        <div className="space-y-4">
          <StageInspector
            stage={selectedStage}
            onUpdateStage={onUpdateStage}
            onRemoveStage={onRemoveStage}
          />
          {workflow ? (
            <TransitionEditor workflow={workflow} onUpdateWorkflow={onUpdateWorkflow} />
          ) : null}
          <p className={valid ? 'text-xs text-emerald-700' : 'text-xs text-red-700'}>
            {valid ? 'Workflow valid.' : 'Workflow has validation issues.'}
          </p>
        </div>
      </div>
    </article>
  );
}

function StageInspector({
  stage,
  onUpdateStage,
  onRemoveStage,
}: {
  stage: WorkflowStage | null;
  onUpdateStage: (stageCode: string, patch: Partial<WorkflowStage>) => void;
  onRemoveStage: (stageCode: string) => void;
}): JSX.Element {
  if (!stage) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
        Select a canvas node to edit stage labels, ownership, SLA, and terminal state.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Stage inspector
      </p>
      <label className="block text-xs font-medium text-slate-600">
        Stage code
        <input
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
          value={stage.code}
          onChange={(event) =>
            onUpdateStage(stage.code, { code: slugify(event.target.value, stage.code) })
          }
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-slate-600">
        Label EN
        <input
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
          value={stage.label.en}
          onChange={(event) =>
            onUpdateStage(stage.code, { label: { ...stage.label, en: event.target.value } })
          }
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-slate-600">
        Owner role
        <select
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
          value={stage.owner_role}
          onChange={(event) => onUpdateStage(stage.code, { owner_role: event.target.value })}
        >
          {DEFAULT_STAGE_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs font-medium text-slate-600">
        SLA hours
        <input
          type="number"
          min={0}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
          value={stage.sla_hours ?? 0}
          onChange={(event) => onUpdateStage(stage.code, { sla_hours: Number(event.target.value) })}
        />
      </label>
      <div className="mt-3 grid gap-2 text-xs font-medium text-slate-600">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={stage.initial === true}
            onChange={(event) => onUpdateStage(stage.code, { initial: event.target.checked })}
          />
          Initial stage
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={stage.terminal === true}
            onChange={(event) => onUpdateStage(stage.code, { terminal: event.target.checked })}
          />
          Terminal stage
        </label>
      </div>
      <button
        type="button"
        onClick={() => onRemoveStage(stage.code)}
        className="mt-4 rounded border border-red-200 px-3 py-2 text-xs font-medium text-red-700"
      >
        Remove stage
      </button>
    </div>
  );
}

function TransitionEditor({
  workflow,
  onUpdateWorkflow,
}: {
  workflow: WorkflowDefinition;
  onUpdateWorkflow: (updater: (workflow: WorkflowDefinition) => WorkflowDefinition) => void;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Transitions
      </p>
      <div className="space-y-3">
        {workflow.transitions.map((transition, index) => (
          <div
            key={`${transition.from}-${transition.to}-${index}`}
            className="rounded bg-white p-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <TransitionSelect
                label="From"
                value={transition.from}
                stages={workflow.stages}
                onChange={(value) =>
                  onUpdateWorkflow((draft) => updateTransition(draft, index, { from: value }))
                }
              />
              <TransitionSelect
                label="To"
                value={transition.to}
                stages={workflow.stages}
                onChange={(value) =>
                  onUpdateWorkflow((draft) => updateTransition(draft, index, { to: value }))
                }
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block text-xs font-medium text-slate-600">
                Verb
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  value={transition.verb}
                  onChange={(event) =>
                    onUpdateWorkflow((draft) =>
                      updateTransition(draft, index, {
                        verb: slugify(event.target.value, 'advance'),
                      }),
                    )
                  }
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Actor
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  value={transition.actor_role}
                  onChange={(event) =>
                    onUpdateWorkflow((draft) =>
                      updateTransition(draft, index, { actor_role: event.target.value }),
                    )
                  }
                >
                  {DEFAULT_STAGE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-2 block text-xs font-medium text-slate-600">
              Effect
              <select
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                value={transition.effects?.[0]?.type ?? 'audit'}
                onChange={(event) =>
                  onUpdateWorkflow((draft) =>
                    updateTransition(draft, index, {
                      effects: [
                        {
                          type: event.target.value as WorkflowEffectType,
                          ...(event.target.value === 'escalate'
                            ? {
                                payload: {
                                  timeout_hours: 24,
                                  target_role: 'tenant_admin',
                                  trigger_stage: transition.from,
                                },
                              }
                            : {}),
                        },
                      ],
                    }),
                  )
                }
              >
                {DEFAULT_EFFECT_TYPES.map((effect) => (
                  <option key={effect} value={effect}>
                    {effect}
                  </option>
                ))}
              </select>
            </label>
            {transition.effects?.[0]?.type === 'escalate' ? (
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                  Escalation policy
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block text-xs font-medium text-amber-950">
                    Timeout hours
                    <input
                      type="number"
                      min={1}
                      className="mt-1 w-full rounded border border-amber-200 px-2 py-1 text-xs"
                      value={String(escalationPayload(transition).timeout_hours ?? 24)}
                      onChange={(event) =>
                        onUpdateWorkflow((draft) =>
                          updateTransition(draft, index, {
                            effects: [
                              {
                                type: 'escalate',
                                payload: {
                                  ...escalationPayload(transition),
                                  timeout_hours: Number.parseInt(event.target.value, 10) || 1,
                                },
                              },
                            ],
                          }),
                        )
                      }
                    />
                  </label>
                  <label className="block text-xs font-medium text-amber-950">
                    Target role
                    <select
                      className="mt-1 w-full rounded border border-amber-200 px-2 py-1 text-xs"
                      value={String(escalationPayload(transition).target_role ?? 'tenant_admin')}
                      onChange={(event) =>
                        onUpdateWorkflow((draft) =>
                          updateTransition(draft, index, {
                            effects: [
                              {
                                type: 'escalate',
                                payload: {
                                  ...escalationPayload(transition),
                                  target_role: event.target.value,
                                },
                              },
                            ],
                          }),
                        )
                      }
                    >
                      {DEFAULT_STAGE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TransitionSelect
                    label="Trigger stage"
                    value={String(escalationPayload(transition).trigger_stage ?? transition.from)}
                    stages={workflow.stages}
                    onChange={(value) =>
                      onUpdateWorkflow((draft) =>
                        updateTransition(draft, index, {
                          effects: [
                            {
                              type: 'escalate',
                              payload: { ...escalationPayload(transition), trigger_stage: value },
                            },
                          ],
                        }),
                      )
                    }
                  />
                  <label className="block text-xs font-medium text-amber-950">
                    Template code
                    <input
                      className="mt-1 w-full rounded border border-amber-200 px-2 py-1 text-xs"
                      value={String(escalationPayload(transition).notification_template_code ?? '')}
                      onChange={(event) =>
                        onUpdateWorkflow((draft) =>
                          updateTransition(draft, index, {
                            effects: [
                              {
                                type: 'escalate',
                                payload: {
                                  ...escalationPayload(transition),
                                  notification_template_code: event.target.value || undefined,
                                },
                              },
                            ],
                          }),
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() =>
                onUpdateWorkflow((draft) => ({
                  ...draft,
                  transitions: draft.transitions.filter((_, itemIndex) => itemIndex !== index),
                }))
              }
              className="mt-2 text-xs font-medium text-red-700"
            >
              Remove transition
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransitionSelect({
  label,
  value,
  stages,
  onChange,
}: {
  label: string;
  value: string;
  stages: WorkflowStage[];
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <select
        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {stages.map((stage) => (
          <option key={stage.code} value={stage.code}>
            {stage.code}
          </option>
        ))}
      </select>
    </label>
  );
}

function updateTransition(
  workflow: WorkflowDefinition,
  index: number,
  patch: Partial<WorkflowTransition>,
): WorkflowDefinition {
  return {
    ...workflow,
    transitions: workflow.transitions.map((transition, itemIndex) =>
      itemIndex === index ? { ...transition, ...patch } : transition,
    ),
  };
}

function escalationPayload(transition: WorkflowTransition): Record<string, unknown> {
  const payload = transition.effects?.[0]?.payload;
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
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
  secondaryAction,
  jsonMode = 'inline',
}: {
  title: string;
  meta: string;
  value: string;
  onChange: (value: string) => void;
  valid: boolean;
  issues: Array<{ path: string; message: string }>;
  onSave: () => void;
  onPublish: () => void;
  secondaryAction?: { label: string; onClick: () => void };
  jsonMode?: 'inline' | 'collapsed';
}): JSX.Element {
  return (
    <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warm-border bg-mint-band/40 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
          <p className="text-xs text-ink-secondary">{meta}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {secondaryAction ? (
            <Button type="button" size="sm" variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="secondary" onClick={onSave}>
            Save draft
          </Button>
          <Button type="button" size="sm" onClick={onPublish}>
            Publish
          </Button>
        </div>
      </div>
      {jsonMode === 'collapsed' ? (
        <FormSchemaJsonFallback
          value={value}
          onChange={onChange}
          valid={valid}
          issues={issues}
          onSave={onSave}
          saveLabel="Save draft"
        />
      ) : (
        <>
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
        </>
      )}
    </article>
  );
}
