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
import { FormImportPanel } from '@enagar/forms/form-import-ui';
import { Button, PageHeader } from '@enagar/ui';
import {
  validateWorkflowDefinition,
  type WorkflowDefinition,
  type WorkflowEffectType,
  type WorkflowStage,
  type WorkflowTransition,
  WorkflowStageKind,
} from '@enagar/workflow';
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from '../../../../components/tenant-admin-session';
import { clearStoredAuth } from '../../../../lib/admin-auth';
import {
  bookableAssetCodesMissingFromDb,
  resolveBookableAssetCodesForMapping,
} from '../../../../lib/bookable-assets-mapping.util';
import {
  addDesignationStage,
  addForwardReturnPair,
  applyBookingHallTemplate,
  applyHoardingScrutinyTemplate,
  applyMunicipalLadderTemplate,
  applyPwdWorksTemplate,
  defaultAllowedVerbsForDesignation,
  DESIGNATION_WORKFLOW_VERBS,
  WORKFLOW_GUARD_PRESETS,
} from '../../../../lib/workflow-designer-templates';

import {
  BookableAssetsMappingPanel,
  serviceShowsBookableAssetMapping,
} from './bookable-assets-mapping-panel';
import { ServiceConfigPanel, coerceDocuments, type FeeLinesDraft } from './service-config-panel';

import type { Route } from 'next';

type ServiceDesignerResponse = {
  service: {
    id: string;
    code: string;
    name: unknown;
  };
  workflow_pattern: string | null;
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

type BocPolicy = 'never' | 'always' | 'officer_may_require';

type MunicipalSignoffPolicy = 'never' | 'high_value_only' | 'always';

type PaymentSchedule = 'upfront_only' | 'deferred_only' | 'upfront_and_deferred';

type ServiceConfigResponse = {
  fee_rule: unknown;
  fee_preview_paise: number | null;
  payment_schedule: PaymentSchedule;
  fee_lines: unknown;
  fee_line_previews: Partial<Record<'application' | 'approval', number | null>>;
  payment_schedule_inferred?: boolean;
  required_documents: unknown;
  boc_policy: BocPolicy;
  municipal_signoff_policy: MunicipalSignoffPolicy;
  municipal_signoff_threshold_paise: number;
  revenue_head: { code: string; accounting_code: string } | null;
  bookable_asset_codes: string[];
};

type BookableAssetRow = {
  code: string;
  name: unknown;
  asset_type?: string;
  is_active: boolean;
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
const DEFAULT_EFFECT_TYPES = [
  'audit',
  'notify',
  'sla_timer',
  'certificate',
  'escalate',
  'generate_payment_link',
  'create_work_order',
];
const STAGE_KIND_OPTIONS: WorkflowStageKind[] = [
  'maker',
  'checker',
  'approver',
  'dept_head',
  'municipality',
  'post_approval',
  'citizen',
  'system',
];

type DesignationOption = {
  code: string;
  label: string;
  is_department_head: boolean;
  can_reject_municipal: boolean;
};

function cloneWorkflow(workflow: WorkflowDefinition): WorkflowDefinition {
  return JSON.parse(JSON.stringify(workflow)) as WorkflowDefinition;
}

function buildWorkflowNodes(workflow: WorkflowDefinition): Node[] {
  return workflow.stages.map((stage, index) => ({
    id: stage.code,
    type: 'default',
    position: { x: 40 + index * 220, y: stage.terminal ? 210 : stage.initial ? 20 : 115 },
    data: {
      label: `${stage.label.en}${stage.owner_designation ? `\n@${stage.owner_designation}` : `\nrole:${stage.owner_role}`}${stage.initial ? '\n(initial)' : ''}${stage.terminal ? '\n(terminal)' : ''}`,
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
  return workflow.transitions.map((transition, index) => {
    const isReturn = transition.verb === 'return';
    return {
      id: `${transition.from}-${transition.to}-${transition.verb}-${index}`,
      source: transition.from,
      target: transition.to,
      label: transition.verb,
      markerEnd: { type: MarkerType.ArrowClosed },
      type: 'smoothstep',
      animated: transition.effects?.some((effect) => effect.type === 'notify') ?? false,
      style: {
        stroke: isReturn ? '#b45309' : '#0f4c75',
        strokeWidth: 2,
        strokeDasharray: isReturn ? '6 4' : undefined,
      },
      labelStyle: {
        fill: isReturn ? '#92400e' : '#0f172a',
        fontSize: 11,
        fontWeight: 600,
      },
    };
  });
}

function pickDesignationLabel(json: unknown, fallback: string): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    if (typeof record.en === 'string' && record.en.trim()) {
      return record.en.trim();
    }
  }
  return fallback;
}

function buildFeeLinesDraft(schedule: PaymentSchedule, value: unknown): FeeLinesDraft {
  const draft: FeeLinesDraft = {};
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const record = source as Record<string, unknown>;
  const defaultLabel = (code: 'application' | 'approval') =>
    code === 'application'
      ? { en: 'Application fee', bn: 'আবেদন ফি', hi: 'आवेदन शुल्क' }
      : { en: 'Licence fee', bn: 'লাইসেন্স ফি', hi: 'लाइसेंस शुल्क' };

  if (schedule === 'upfront_only' || schedule === 'upfront_and_deferred') {
    const line = record.application;
    draft.application =
      line && typeof line === 'object' && !Array.isArray(line)
        ? (line as FeeLinesDraft['application'])
        : {
            label: defaultLabel('application'),
            rule: { type: 'fixed', amount_paise: 1000, currency: 'INR' },
          };
  }
  if (schedule === 'deferred_only' || schedule === 'upfront_and_deferred') {
    const line = record.approval;
    draft.approval =
      line && typeof line === 'object' && !Array.isArray(line)
        ? (line as FeeLinesDraft['approval'])
        : {
            label: defaultLabel('approval'),
            rule: { type: 'fixed', amount_paise: 1000, currency: 'INR' },
          };
  }
  return draft;
}

function serializeFeeLines(
  schedule: PaymentSchedule,
  lines: FeeLinesDraft,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if ((schedule === 'upfront_only' || schedule === 'upfront_and_deferred') && lines.application) {
    payload.application = lines.application;
  }
  if ((schedule === 'deferred_only' || schedule === 'upfront_and_deferred') && lines.approval) {
    payload.approval = lines.approval;
  }
  return payload;
}

/** Tenant Admin API requires workflow.code to start with `{serviceCode}-`. */
function ensureWorkflowCodeForService(
  workflow: WorkflowDefinition,
  serviceCode: string,
): WorkflowDefinition {
  const prefix = `${serviceCode.trim()}-`;
  if (workflow.code.startsWith(prefix)) {
    return workflow;
  }
  return { ...workflow, code: `${serviceCode.trim()}-workflow-v1` };
}

export default function ServiceDesignerClient({ serviceId }: { serviceId: string }): JSX.Element {
  const router = useRouter();
  const { token, apiBase } = useTenantAdminSession();
  const [designer, setDesigner] = useState<ServiceDesignerResponse | null>(null);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfigResponse | null>(null);
  const [bookableAssets, setBookableAssets] = useState<BookableAssetRow[]>([]);
  const [bookableAssetCodes, setBookableAssetCodes] = useState<string[]>([]);
  const [revenueHeads, setRevenueHeads] = useState<RevenueHeadRow[]>([]);
  const [formText, setFormText] = useState('');
  const [workflowText, setWorkflowText] = useState('');
  const [feeText, setFeeText] = useState('');
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentSchedule>('upfront_only');
  const [feeLines, setFeeLines] = useState<FeeLinesDraft>({});
  const [documentsText, setDocumentsText] = useState('');
  const [revenueHeadCode, setRevenueHeadCode] = useState('');
  const [bocPolicy, setBocPolicy] = useState<BocPolicy>('never');
  const [municipalSignoffPolicy, setMunicipalSignoffPolicy] =
    useState<MunicipalSignoffPolicy>('high_value_only');
  const [municipalSignoffThresholdRupees, setMunicipalSignoffThresholdRupees] = useState('500000');
  const [values, setValues] = useState<Values>({});
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedStageCode, setSelectedStageCode] = useState<string | null>(null);
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const uploadAuthHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
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
      const [designerRes, configRes, revenueRes, desigRes, bookingsRes] = await Promise.all([
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
        fetch(`${apiBase}/admin/tenant/org/designations`, {
          cache: 'no-store',
          headers: authHeaders(),
        }),
        fetch(`${apiBase}/admin/tenant/bookings`, {
          cache: 'no-store',
          headers: authHeaders(),
        }),
      ]);
      if (
        designerRes.status === 401 ||
        configRes.status === 401 ||
        revenueRes.status === 401 ||
        desigRes.status === 401
      ) {
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
      if (desigRes.ok) {
        const desigRows = (await desigRes.json()) as Array<{
          code: string;
          name: unknown;
          is_department_head: boolean;
          can_reject_municipal: boolean;
          is_active: boolean;
        }>;
        setDesignations(
          desigRows
            .filter((row) => row.is_active)
            .map((row) => ({
              code: row.code,
              label: pickDesignationLabel(row.name, row.code),
              is_department_head: row.is_department_head,
              can_reject_municipal: row.can_reject_municipal,
            }))
            .sort((left, right) => left.label.localeCompare(right.label)),
        );
      } else {
        setDesignations([]);
      }
      setDesigner(data);
      setServiceConfig(config);
      let assets: BookableAssetRow[] = [];
      if (bookingsRes.ok) {
        const bookings = (await bookingsRes.json()) as { assets: BookableAssetRow[] };
        assets = bookings.assets ?? [];
      }
      setBookableAssets(assets);
      setBookableAssetCodes(
        resolveBookableAssetCodesForMapping(config.bookable_asset_codes ?? [], assets),
      );
      setRevenueHeads(heads.filter((head) => head.is_active));
      setFeeText(pretty(config.fee_rule));
      setPaymentSchedule(config.payment_schedule ?? 'upfront_only');
      setFeeLines(buildFeeLinesDraft(config.payment_schedule ?? 'upfront_only', config.fee_lines));
      setDocumentsText(pretty(coerceDocuments(config.required_documents)));
      setRevenueHeadCode(config.revenue_head?.code ?? '');
      setBocPolicy(config.boc_policy ?? 'never');
      setMunicipalSignoffPolicy(config.municipal_signoff_policy ?? 'high_value_only');
      setMunicipalSignoffThresholdRupees(
        String((config.municipal_signoff_threshold_paise ?? 50_000_000) / 100),
      );
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
    const serviceCode = designer?.service.code?.trim();
    if (!serviceCode) {
      setStatus('Service code is missing — reload the designer page.');
      return false;
    }
    const workflow = ensureWorkflowCodeForService(parsedWorkflow.workflow, serviceCode);
    if (workflow.code !== parsedWorkflow.workflow.code) {
      setWorkflowText(pretty(workflow));
    }
    try {
      const res = await fetch(`${apiBase}/admin/tenant/services/${serviceId}/workflow-draft`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ workflow }),
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
    } catch {
      setStatus(
        `Could not reach the API at ${apiBase}. Start the API (pnpm --filter @enagar/api dev), confirm NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api in apps/admin-tenant/.env.local, then restart admin-tenant.`,
      );
      return false;
    }
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
    let res: Response;
    try {
      res = await fetch(`${apiBase}/admin/tenant/services/${serviceId}/workflow-draft/publish`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
    } catch {
      setStatus(
        `Could not reach the API at ${apiBase}. Start the API on port 3001 and restart admin-tenant.`,
      );
      return;
    }
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
    const payloadFeeLines = serializeFeeLines(paymentSchedule, feeLines);
    const res = await fetch(`${apiBase}/admin/tenant/services/${serviceId}/config`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({
        fee_rule: parsedFee.value,
        payment_schedule: paymentSchedule,
        fee_lines: payloadFeeLines,
        required_documents: coerceDocuments(parsedDocuments.value),
        revenue_head_code: revenueHeadCode,
        boc_policy: bocPolicy,
        municipal_signoff_policy: municipalSignoffPolicy,
        municipal_signoff_threshold_paise: Math.round(
          Number(municipalSignoffThresholdRupees) * 100,
        ),
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

  function toggleBookableAsset(code: string, checked: boolean): void {
    setBookableAssetCodes((prev) => {
      if (checked) {
        return prev.includes(code) ? prev : [...prev, code];
      }
      return prev.filter((item) => item !== code);
    });
  }

  async function saveBookableAssetMapping(): Promise<void> {
    if (!token) {
      return;
    }
    const codes = resolveBookableAssetCodesForMapping(bookableAssetCodes, bookableAssets);
    const res = await fetch(`${apiBase}/admin/tenant/services/${serviceId}/config`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ bookable_asset_codes: codes }),
    });
    if (!res.ok) {
      if (redirectIfUnauthorized(res)) {
        return;
      }
      const body = await res.text().catch(() => '');
      setStatus(`Asset mapping save failed (${res.status}). ${body.slice(0, 180)}`);
      return;
    }
    setStatus('Bookable asset mapping saved.');
    await loadDesigner();
  }

  const showBookableAssetsPanel = serviceShowsBookableAssetMapping(
    designer?.workflow_pattern,
    parsedWorkflow.workflow,
    designer?.service.code,
  );

  if (!token || !designer || !serviceConfig) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-ink-secondary">Loading service designer…</p>
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
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/services/${serviceId}/setup-assistant` as Route}
              className="text-sm font-medium text-brand hover:underline"
            >
              Open Setup Assistant
            </Link>
            <Link
              href={'/dashboard' as Route}
              className="text-sm font-medium text-brand hover:underline"
            >
              Back to catalogue
            </Link>
          </div>
        }
      />

      {status ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {status}
        </p>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <FormImportPanel
            uploadPath={`${apiBase}/admin/tenant/services/${serviceId}/form-import`}
            getAuthHeaders={uploadAuthHeaders}
            draftSchema={parsedForm.schema}
            onApply={(schema) => {
              setFormText(pretty(schema));
              setSelectedFieldId(null);
            }}
            onStatus={setStatus}
          />
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
            serviceCode={designer.service.code}
            catalogueWorkflowPattern={designer.workflow_pattern}
            workflow={parsedWorkflow.workflow}
            valid={parsedWorkflow.validation.ok}
            nodes={workflowNodes}
            edges={workflowEdges}
            designations={designations}
            selectedStageCode={selectedStageCode}
            onSelectStage={setSelectedStageCode}
            onAddStage={addWorkflowStage}
            onUpdateStage={updateStage}
            onRemoveStage={removeStage}
            onAddTransition={addWorkflowTransition}
            onUpdateWorkflow={updateWorkflow}
            onApplyTemplate={(message) => setStatus(message)}
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
          {showBookableAssetsPanel ? (
            <BookableAssetsMappingPanel
              serviceCode={designer.service.code}
              selectedCodes={bookableAssetCodes}
              assets={bookableAssets}
              configCodesMissingFromDb={bookableAssetCodesMissingFromDb(
                serviceConfig.bookable_asset_codes ?? [],
                bookableAssets,
              )}
              onToggle={toggleBookableAsset}
              onSave={() => void saveBookableAssetMapping()}
            />
          ) : null}
          {/* Fee, documents, and revenue mapping stays on the Sprint 6.3 config contract. */}
          <ServiceConfigPanel
            serviceConfig={serviceConfig}
            revenueHeads={revenueHeads}
            paymentSchedule={paymentSchedule}
            feeLines={feeLines}
            feeText={feeText}
            documentsText={documentsText}
            revenueHeadCode={revenueHeadCode}
            parsedFee={parsedFee}
            parsedDocuments={parsedDocuments}
            onPaymentScheduleChange={setPaymentSchedule}
            onFeeLinesChange={setFeeLines}
            onFeeTextChange={setFeeText}
            onDocumentsTextChange={setDocumentsText}
            onRevenueHeadCodeChange={setRevenueHeadCode}
            bocPolicy={bocPolicy}
            onBocPolicyChange={setBocPolicy}
            municipalSignoffPolicy={municipalSignoffPolicy}
            onMunicipalSignoffPolicyChange={setMunicipalSignoffPolicy}
            municipalSignoffThresholdRupees={municipalSignoffThresholdRupees}
            onMunicipalSignoffThresholdRupeesChange={setMunicipalSignoffThresholdRupees}
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
  serviceCode,
  catalogueWorkflowPattern,
  workflow,
  valid,
  nodes,
  edges,
  designations,
  selectedStageCode,
  onSelectStage,
  onAddStage,
  onUpdateStage,
  onRemoveStage,
  onAddTransition,
  onUpdateWorkflow,
  onApplyTemplate,
}: {
  serviceCode: string;
  catalogueWorkflowPattern: string | null;
  workflow: WorkflowDefinition | null;
  valid: boolean;
  nodes: Node[];
  edges: Edge[];
  designations: DesignationOption[];
  selectedStageCode: string | null;
  onSelectStage: (stageCode: string | null) => void;
  onAddStage: () => void;
  onUpdateStage: (stageCode: string, patch: Partial<WorkflowStage>) => void;
  onRemoveStage: (stageCode: string) => void;
  onAddTransition: () => void;
  onUpdateWorkflow: (updater: (workflow: WorkflowDefinition) => WorkflowDefinition) => void;
  onApplyTemplate: (message: string) => void;
}): JSX.Element {
  const selectedStage = workflow?.stages.find((stage) => stage.code === selectedStageCode) ?? null;

  function applyTemplate(
    updater: (draft: WorkflowDefinition) => WorkflowDefinition,
    message: string,
  ): void {
    if (!workflow) {
      onApplyTemplate('Fix workflow JSON before applying templates.');
      return;
    }
    onUpdateWorkflow((draft) => updater(draft));
    onApplyTemplate(message);
  }

  return (
    <article className="rounded-xl border border-warm-border bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
            Phase 6 · Designation workflow designer
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink-primary">Visual workflow designer</h2>
          <p className="text-xs text-ink-secondary">
            Pick ULB designations per stage and forward/return verbs. Template buttons replace the
            draft (legacy approved/closed paths are removed). Orange dashed edges are returns.
            {catalogueWorkflowPattern === 'booking'
              ? ' For hall booking services, start with Hall & facility booking — asset mapping appears after that template is applied.'
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddStage}
            className="rounded bg-brand px-3 py-2 text-xs font-medium text-brand-fg"
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
      {workflow ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand"
            onClick={() =>
              applyTemplate(
                (draft) => applyBookingHallTemplate(draft, serviceCode),
                'Replaced workflow with hall booking (submitted → slot review → confirmed/rejected). Bookable asset mapping is now available — link halls, then save and publish the workflow.',
              )
            }
          >
            Hall &amp; facility booking (replace)
          </button>
          <button
            type="button"
            className="rounded border border-warm-border bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-primary"
            onClick={() =>
              applyTemplate(
                (draft) => applyHoardingScrutinyTemplate(draft),
                'Replaced workflow with hoarding scrutiny (submitted → clerk → inspector → officer → certificate).',
              )
            }
          >
            Hoarding scrutiny (replace)
          </button>
          <button
            type="button"
            className="rounded border border-warm-border bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-primary"
            onClick={() =>
              applyTemplate(
                (draft) => applyPwdWorksTemplate(draft),
                'Replaced workflow with PWD maker–checker–approver–dept head + municipal ladder.',
              )
            }
          >
            PWD works (replace)
          </button>
          <button
            type="button"
            className="rounded border border-warm-border bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-primary"
            onClick={() =>
              applyTemplate(
                (draft) => applyMunicipalLadderTemplate(draft),
                'Replaced workflow with dept head + municipal ladder (EO → CIC → VC → Chairperson).',
              )
            }
          >
            Municipal ladder (replace)
          </button>
          <button
            type="button"
            className="rounded border border-warm-border bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-primary"
            disabled={!selectedStageCode}
            onClick={() => {
              if (!selectedStageCode) {
                return;
              }
              const targetDesig = designations[0]?.code ?? 'hoarding_inspector';
              applyTemplate((draft) => {
                const { workflow: withStage, stageCode } = addDesignationStage(draft, {
                  designationCode: targetDesig,
                });
                return addForwardReturnPair(withStage, {
                  from: selectedStageCode,
                  to: stageCode,
                  forwardDesignation:
                    draft.stages.find((stage) => stage.code === selectedStageCode)
                      ?.owner_designation ?? targetDesig,
                  returnDesignation: targetDesig,
                });
              }, `Added forward/return pair from ${selectedStageCode}.`);
            }}
          >
            Forward + return pair
          </button>
        </div>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[420px] overflow-hidden rounded-lg border border-warm-border bg-canvas">
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
            <p className="p-4 text-sm text-ink-secondary">
              Fix workflow JSON before using the canvas.
            </p>
          )}
        </div>
        <div className="space-y-4">
          <StageInspector
            stage={selectedStage}
            designations={designations}
            onUpdateStage={onUpdateStage}
            onRemoveStage={onRemoveStage}
          />
          {workflow ? (
            <TransitionEditor
              workflow={workflow}
              designations={designations}
              onUpdateWorkflow={onUpdateWorkflow}
            />
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
  designations,
  onUpdateStage,
  onRemoveStage,
}: {
  stage: WorkflowStage | null;
  designations: DesignationOption[];
  onUpdateStage: (stageCode: string, patch: Partial<WorkflowStage>) => void;
  onRemoveStage: (stageCode: string) => void;
}): JSX.Element {
  if (!stage) {
    return (
      <div className="rounded-lg border border-warm-border bg-canvas p-3 text-sm text-ink-secondary">
        Select a canvas node to edit designation owner, stage kind, allowed verbs, and SLA.
      </div>
    );
  }

  const actorMode = stage.owner_designation ? 'designation' : 'role';
  const selectedDesig = designations.find((row) => row.code === stage.owner_designation);

  return (
    <div className="rounded-lg border border-warm-border bg-canvas p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
        Stage inspector
      </p>
      <label className="block text-xs font-medium text-ink-secondary">
        Stage code
        <input
          className="mt-1 w-full rounded border border-warm-border px-2 py-1 font-mono text-xs"
          value={stage.code}
          onChange={(event) =>
            onUpdateStage(stage.code, { code: slugify(event.target.value, stage.code) })
          }
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-ink-secondary">
        Label EN
        <input
          className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
          value={stage.label.en}
          onChange={(event) =>
            onUpdateStage(stage.code, { label: { ...stage.label, en: event.target.value } })
          }
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-ink-secondary">
        Pending owner
        <select
          className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
          value={actorMode}
          onChange={(event) => {
            if (event.target.value === 'designation') {
              const first = designations[0];
              if (!first) {
                return;
              }
              onUpdateStage(stage.code, {
                owner_designation: first.code,
                owner_role: 'tenant_clerk',
                allowed_verbs: defaultAllowedVerbsForDesignation(first.code, first),
              });
            } else {
              onUpdateStage(stage.code, {
                owner_designation: undefined,
                owner_role: stage.owner_role || 'tenant_clerk',
              });
            }
          }}
        >
          <option value="role">Legacy role</option>
          <option value="designation">ULB designation</option>
        </select>
      </label>
      {actorMode === 'role' ? (
        <label className="mt-3 block text-xs font-medium text-ink-secondary">
          Owner role
          <select
            className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
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
      ) : (
        <label className="mt-3 block text-xs font-medium text-ink-secondary">
          Owner designation
          <select
            className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
            value={stage.owner_designation ?? ''}
            onChange={(event) => {
              const code = event.target.value;
              const desig = designations.find((row) => row.code === code);
              onUpdateStage(stage.code, {
                owner_designation: code,
                owner_role: 'tenant_clerk',
                allowed_verbs: desig
                  ? defaultAllowedVerbsForDesignation(code, desig)
                  : ['forward', 'return'],
              });
            }}
          >
            <option value="">Select designation…</option>
            {designations.map((row) => (
              <option key={row.code} value={row.code}>
                {row.label} ({row.code})
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="mt-3 block text-xs font-medium text-ink-secondary">
        Stage kind
        <select
          className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
          value={stage.stage_kind ?? ''}
          onChange={(event) =>
            onUpdateStage(stage.code, {
              stage_kind: (event.target.value || undefined) as WorkflowStageKind | undefined,
            })
          }
        >
          <option value="">(none)</option>
          {STAGE_KIND_OPTIONS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>
      {actorMode === 'designation' && selectedDesig ? (
        <p className="mt-2 text-[11px] text-ink-secondary">
          {selectedDesig.is_department_head ? 'Department head — reject allowed. ' : ''}
          {selectedDesig.can_reject_municipal ? 'Municipal reject (Chairperson). ' : ''}
          Configure allowed verbs below.
        </p>
      ) : null}
      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-ink-secondary">Allowed verbs</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DESIGNATION_WORKFLOW_VERBS.map((verb) => (
            <label key={verb} className="flex items-center gap-1 text-xs text-ink-primary">
              <input
                type="checkbox"
                checked={stage.allowed_verbs?.includes(verb) ?? false}
                onChange={(event) => {
                  const current = new Set(stage.allowed_verbs ?? ['forward', 'return']);
                  if (event.target.checked) {
                    current.add(verb);
                  } else {
                    current.delete(verb);
                  }
                  onUpdateStage(stage.code, {
                    allowed_verbs: [...current],
                  });
                }}
              />
              {verb}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 block text-xs font-medium text-ink-secondary">
        SLA hours
        <input
          type="number"
          min={0}
          className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
          value={stage.sla_hours ?? 0}
          onChange={(event) => onUpdateStage(stage.code, { sla_hours: Number(event.target.value) })}
        />
      </label>
      <div className="mt-3 grid gap-2 text-xs font-medium text-ink-secondary">
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
  designations,
  onUpdateWorkflow,
}: {
  workflow: WorkflowDefinition;
  designations: DesignationOption[];
  onUpdateWorkflow: (updater: (workflow: WorkflowDefinition) => WorkflowDefinition) => void;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-warm-border bg-canvas p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
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
              <label className="block text-xs font-medium text-ink-secondary">
                Verb
                <select
                  className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
                  value={transition.verb}
                  onChange={(event) =>
                    onUpdateWorkflow((draft) =>
                      updateTransition(draft, index, { verb: event.target.value }),
                    )
                  }
                >
                  {[...DESIGNATION_WORKFLOW_VERBS, 'advance', 'submit', 'approve'].map((verb) => (
                    <option key={verb} value={verb}>
                      {verb}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-ink-secondary">
                Actor designation
                <select
                  className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
                  value={transition.actor_designation ?? ''}
                  onChange={(event) => {
                    const code = event.target.value;
                    onUpdateWorkflow((draft) =>
                      updateTransition(draft, index, {
                        actor_designation: code || undefined,
                        actor_role: code ? 'tenant_clerk' : transition.actor_role,
                      }),
                    );
                  }}
                >
                  <option value="">Legacy role only</option>
                  {designations.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!transition.actor_designation ? (
              <label className="mt-2 block text-xs font-medium text-ink-secondary">
                Actor role (legacy)
                <select
                  className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
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
            ) : null}
            <label className="mt-2 block text-xs font-medium text-ink-secondary">
              Transition guard
              <select
                className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
                value={
                  typeof transition.guard?.type === 'string'
                    ? transition.guard.type
                    : typeof transition.guard?.kind === 'string'
                      ? transition.guard.kind
                      : ''
                }
                onChange={(event) => {
                  const type = event.target.value;
                  onUpdateWorkflow((draft) =>
                    updateTransition(draft, index, {
                      guard: type
                        ? type === 'payment_paid'
                          ? { type, fee_code: 'approval' }
                          : { type }
                        : undefined,
                    }),
                  );
                }}
              >
                {WORKFLOW_GUARD_PRESETS.map((preset) => (
                  <option key={preset.value || 'none'} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block text-xs font-medium text-ink-secondary">
              Effect
              <select
                className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
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
                            : event.target.value === 'generate_payment_link'
                              ? { payload: { fee_code: 'approval' } }
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
            {transition.effects?.[0]?.type === 'generate_payment_link' ? (
              <label className="mt-2 block text-xs font-medium text-ink-secondary">
                Payment link fee line
                <select
                  className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
                  value={String(paymentLinkPayload(transition).fee_code ?? 'approval')}
                  onChange={(event) =>
                    onUpdateWorkflow((draft) =>
                      updateTransition(draft, index, {
                        effects: [
                          {
                            type: 'generate_payment_link',
                            payload: {
                              ...paymentLinkPayload(transition),
                              fee_code: event.target.value,
                            },
                          },
                        ],
                      }),
                    )
                  }
                >
                  <option value="approval">Approval / licence fee</option>
                  <option value="application">Application fee</option>
                </select>
              </label>
            ) : null}
            {typeof transition.guard?.type === 'string' &&
            transition.guard.type === 'payment_paid' ? (
              <label className="mt-2 block text-xs font-medium text-ink-secondary">
                Guard fee line (optional)
                <select
                  className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
                  value={String(transition.guard.fee_code ?? '')}
                  onChange={(event) =>
                    onUpdateWorkflow((draft) =>
                      updateTransition(draft, index, {
                        guard: {
                          type: 'payment_paid',
                          ...(event.target.value ? { fee_code: event.target.value } : {}),
                        },
                      }),
                    )
                  }
                >
                  <option value="">All required lines paid (rollup)</option>
                  <option value="approval">Approval line paid</option>
                  <option value="application">Application line paid</option>
                </select>
              </label>
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
    <label className="block text-xs font-medium text-ink-secondary">
      {label}
      <select
        className="mt-1 w-full rounded border border-warm-border px-2 py-1 text-xs"
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

function paymentLinkPayload(transition: WorkflowTransition): Record<string, unknown> {
  const effect = transition.effects?.find((entry) => entry.type === 'generate_payment_link');
  const payload = effect?.payload;
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
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
            className="h-80 w-full rounded-lg border border-warm-border bg-sidebar p-3 font-mono text-xs text-ink-onDark"
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
