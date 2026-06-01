export type WorkflowRole = 'citizen' | 'tenant_clerk' | 'tenant_admin' | 'state_admin' | string;
export type WorkflowStageKind =
  | 'maker'
  | 'checker'
  | 'approver'
  | 'dept_head'
  | 'municipality'
  | 'post_approval'
  | 'citizen'
  | 'system';
export type WorkflowEffectType =
  | 'notify'
  | 'sla_timer'
  | 'audit'
  | 'certificate'
  | 'escalate'
  | 'generate_payment_link'
  | 'create_work_order';

const WORKFLOW_STAGE_KINDS = new Set<WorkflowStageKind>([
  'maker',
  'checker',
  'approver',
  'dept_head',
  'municipality',
  'post_approval',
  'citizen',
  'system',
]);

const WORKFLOW_EFFECT_TYPES = new Set<WorkflowEffectType>([
  'notify',
  'sla_timer',
  'audit',
  'certificate',
  'escalate',
  'generate_payment_link',
  'create_work_order',
]);

export interface WorkflowLabel {
  en: string;
  bn: string;
  hi: string;
}

export interface WorkflowStage {
  code: string;
  label: WorkflowLabel;
  /** Legacy coarse role; required when `owner_designation` is absent. */
  owner_role: WorkflowRole;
  /** ULB designation code; preferred at runtime when set (ADR-0011). */
  owner_designation?: string;
  stage_kind?: WorkflowStageKind;
  /** Default at runtime: `forward`, `return`; dept head / chairperson may add `reject`. */
  allowed_verbs?: string[];
  sla_hours?: number;
  initial?: boolean;
  terminal?: boolean;
}

export interface WorkflowEffect {
  type: WorkflowEffectType;
  payload?: Record<string, unknown>;
}

export interface WorkflowTransition {
  from: string;
  to: string;
  verb: string;
  /** Legacy coarse role; required when `actor_designation` is absent. */
  actor_role: WorkflowRole;
  /** ULB designation code; preferred at runtime when set (ADR-0011). */
  actor_designation?: string;
  /** BOC, municipal sign-off, payment-paid, etc. (evaluated in Phase 4+). */
  guard?: Record<string, unknown>;
  requires_comment?: boolean;
  effects?: WorkflowEffect[];
}

export interface WorkflowDefinition {
  code: string;
  version: number;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
}

export interface WorkflowValidationIssue {
  path: string;
  message: string;
}

export interface WorkflowValidationResult {
  ok: boolean;
  issues: WorkflowValidationIssue[];
}

export interface DesignationCapability {
  code: string;
  is_department_head?: boolean;
  can_reject_municipal?: boolean;
}

export interface EvaluateTransitionInput {
  workflow: WorkflowDefinition;
  current_stage: string;
  verb: string;
  actor_roles: WorkflowRole[];
  /** ULB designation codes for the acting staff user (ADR-0011 Phase 4). */
  actor_designations?: string[];
  designation_capabilities?: DesignationCapability[];
  runtime_snapshot?: Record<string, unknown>;
  comment?: string;
}

export interface EvaluatedTransition {
  ok: true;
  from: WorkflowStage;
  to: WorkflowStage;
  transition: WorkflowTransition;
  effects: WorkflowEffect[];
}

export interface RejectedTransition {
  ok: false;
  reason:
    | 'UNKNOWN_STAGE'
    | 'TERMINAL_STAGE'
    | 'UNKNOWN_TRANSITION'
    | 'ROLE_NOT_ALLOWED'
    | 'ACTOR_NOT_ALLOWED'
    | 'COMMENT_REQUIRED'
    | 'GUARD_BLOCKED'
    | 'REJECT_NOT_PERMITTED'
    | 'RETURN_TARGET_NOT_ALLOWED'
    | 'VERB_NOT_ALLOWED'
    | 'PAYMENT_LINK_NOT_PERMITTED';
}

/** System verb for post-approval advance when {@link evaluateTransitionGuard} `payment_paid` passes (Phase 11). */
export const POST_APPROVAL_PAYMENT_CONFIRMED_VERB = 'confirm-payment';

/** Citizen verb at `citizen-feedback` stage (Phase 12 / ADR-0012). */
export const CITIZEN_FEEDBACK_VERB = 'submit-feedback';

/** Municipal ladder stage where Chairperson may reject (workflow-designations §4.5). */
export const CHAIRPERSON_REJECT_STAGE_CODE = 'chairperson-approval';

export const INTERNAL_RETURN_VERB = 'return';
export const CITIZEN_CORRECTION_VERB = 'return-for-correction';

export type TransitionEvaluation = EvaluatedTransition | RejectedTransition;

export const certificateIssuanceWorkflow: WorkflowDefinition = {
  code: 'cert-issuance-v1',
  version: 1,
  stages: [
    stage('submitted', 'Submitted', 'জমা হয়েছে', 'जमा हुआ', 'tenant_clerk', 24, true),
    stage(
      'document-verification',
      'Document Verification',
      'নথি যাচাই',
      'दस्तावेज़ सत्यापन',
      'tenant_clerk',
      72,
    ),
    stage('approved', 'Approved', 'অনুমোদিত', 'स्वीकृत', 'tenant_admin', 24),
    stage(
      'issued',
      'Certificate Issued',
      'সনদ ইস্যু হয়েছে',
      'प्रमाणपत्र जारी',
      'citizen',
      undefined,
      false,
      true,
    ),
    stage('rejected', 'Rejected', 'প্রত্যাখ্যাত', 'अस्वीकृत', 'citizen', undefined, false, true),
    stage(
      'withdrawn',
      'Withdrawn',
      'প্রত্যাহার করা হয়েছে',
      'वापस लिया गया',
      'citizen',
      undefined,
      false,
      true,
    ),
  ],
  transitions: [
    transition('submitted', 'document-verification', 'start-verification', 'tenant_clerk', [
      { type: 'sla_timer' },
      { type: 'audit' },
    ]),
    transition('document-verification', 'approved', 'approve', 'tenant_admin', [
      { type: 'certificate' },
      { type: 'notify' },
    ]),
    transition(
      'document-verification',
      'rejected',
      'reject',
      'tenant_admin',
      [{ type: 'notify' }],
      true,
    ),
    transition('submitted', 'withdrawn', 'cancel', 'citizen', [{ type: 'notify' }]),
  ],
};

export const instantWorkflow: WorkflowDefinition = {
  code: 'instant-v1',
  version: 1,
  stages: [
    stage('submitted', 'Submitted', 'জমা হয়েছে', 'जमा हुआ', 'tenant_clerk', 1, true),
    stage('closed', 'Closed', 'বন্ধ', 'बंद', 'citizen', undefined, false, true),
    stage(
      'withdrawn',
      'Withdrawn',
      'প্রত্যাহার করা হয়েছে',
      'वापस लिया गया',
      'citizen',
      undefined,
      false,
      true,
    ),
  ],
  transitions: [
    transition('submitted', 'closed', 'close', 'tenant_clerk', [{ type: 'notify' }]),
    transition('submitted', 'withdrawn', 'cancel', 'citizen', [{ type: 'notify' }]),
  ],
};

export const bookingWorkflow: WorkflowDefinition = {
  code: 'booking-v1',
  version: 1,
  stages: [
    stage('submitted', 'Submitted', 'জমা হয়েছে', 'जमा हुआ', 'tenant_clerk', 24, true),
    stage('slot-review', 'Slot Review', 'স্লট পর্যালোচনা', 'स्लॉट समीक्षा', 'tenant_clerk', 48),
    stage('confirmed', 'Confirmed', 'নিশ্চিত', 'पुष्ट', 'citizen', undefined, false, true),
    stage('rejected', 'Rejected', 'প্রত্যাখ্যাত', 'अस्वीकृत', 'citizen', undefined, false, true),
    stage(
      'withdrawn',
      'Withdrawn',
      'প্রত্যাহার করা হয়েছে',
      'वापस लिया गया',
      'citizen',
      undefined,
      false,
      true,
    ),
  ],
  transitions: [
    transition('submitted', 'slot-review', 'review-slot', 'tenant_clerk', [{ type: 'sla_timer' }]),
    transition('slot-review', 'confirmed', 'confirm', 'tenant_clerk', [{ type: 'notify' }]),
    transition('slot-review', 'rejected', 'reject', 'tenant_clerk', [{ type: 'notify' }], true),
    transition('submitted', 'withdrawn', 'cancel', 'citizen', [{ type: 'notify' }]),
  ],
};

export function createLinearWorkflowDraft(serviceCode: string, version = 1): WorkflowDefinition {
  return {
    code: `${serviceCode}-workflow-v${version}`,
    version,
    stages: [
      stage('submitted', 'Submitted', 'জমা হয়েছে', 'जमा हुआ', 'tenant_clerk', 24, true),
      stage('approved', 'Approved', 'অনুমোদিত', 'स्वीकृत', 'tenant_admin', 24),
      stage('closed', 'Closed', 'বন্ধ', 'बंद', 'citizen', undefined, false, true),
    ],
    transitions: [
      transition('submitted', 'approved', 'verify', 'tenant_clerk', [{ type: 'audit' }]),
      transition('approved', 'closed', 'approve', 'tenant_admin', [{ type: 'notify' }]),
    ],
  };
}

export function validateWorkflowDefinition(workflow: WorkflowDefinition): WorkflowValidationResult {
  const issues: WorkflowValidationIssue[] = [];

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(workflow.code)) {
    issues.push(issue('code', 'workflow code must be lowercase and URL-safe'));
  }
  if (!Number.isInteger(workflow.version) || workflow.version < 1) {
    issues.push(issue('version', 'version must be a positive integer'));
  }
  if (!Array.isArray(workflow.stages) || workflow.stages.length < 2) {
    issues.push(issue('stages', 'at least two stages are required'));
    return result(issues);
  }

  const stageCodes = new Set<string>();
  let initialCount = 0;
  let terminalCount = 0;
  for (const [index, item] of workflow.stages.entries()) {
    const path = `stages.${index}`;
    if (!/^[a-z][a-z0-9-]*$/.test(item.code)) {
      issues.push(issue(`${path}.code`, 'stage code must be lowercase and kebab-case'));
    }
    if (stageCodes.has(item.code)) {
      issues.push(issue(`${path}.code`, `duplicate stage code: ${item.code}`));
    }
    stageCodes.add(item.code);
    if (item.initial) {
      initialCount += 1;
    }
    if (item.terminal) {
      terminalCount += 1;
    }
    validateWorkflowLabel(item.label, `${path}.label`, issues);
    if (!item.owner_role && !item.owner_designation) {
      issues.push(issue(`${path}.owner_role`, 'owner_role or owner_designation is required'));
    }
    if (item.owner_designation && !/^[a-z][a-z0-9_]*$/.test(item.owner_designation)) {
      issues.push(
        issue(`${path}.owner_designation`, 'owner_designation must be lowercase snake_case'),
      );
    }
    if (item.stage_kind && !WORKFLOW_STAGE_KINDS.has(item.stage_kind)) {
      issues.push(issue(`${path}.stage_kind`, `unsupported stage_kind: ${item.stage_kind}`));
    }
    if (item.allowed_verbs !== undefined) {
      if (!Array.isArray(item.allowed_verbs) || item.allowed_verbs.length === 0) {
        issues.push(issue(`${path}.allowed_verbs`, 'allowed_verbs must be a non-empty array'));
      } else {
        for (const [verbIndex, verb] of item.allowed_verbs.entries()) {
          if (typeof verb !== 'string' || !verb.trim()) {
            issues.push(
              issue(`${path}.allowed_verbs.${verbIndex}`, 'verb must be a non-empty string'),
            );
          }
        }
      }
    }
    if (item.sla_hours !== undefined && (!Number.isInteger(item.sla_hours) || item.sla_hours < 0)) {
      issues.push(issue(`${path}.sla_hours`, 'sla_hours must be a non-negative integer'));
    }
  }

  if (initialCount !== 1) {
    issues.push(issue('stages', 'exactly one initial stage is required'));
  }
  if (terminalCount < 1) {
    issues.push(issue('stages', 'at least one terminal stage is required'));
  }

  for (const [index, item] of workflow.transitions.entries()) {
    const path = `transitions.${index}`;
    if (!stageCodes.has(item.from)) {
      issues.push(issue(`${path}.from`, `unknown stage: ${item.from}`));
    }
    if (!stageCodes.has(item.to)) {
      issues.push(issue(`${path}.to`, `unknown stage: ${item.to}`));
    }
    if (!item.verb) {
      issues.push(issue(`${path}.verb`, 'verb is required'));
    }
    if (!item.actor_role && !item.actor_designation) {
      issues.push(issue(`${path}.actor_role`, 'actor_role or actor_designation is required'));
    }
    if (item.actor_designation && !/^[a-z][a-z0-9_]*$/.test(item.actor_designation)) {
      issues.push(
        issue(`${path}.actor_designation`, 'actor_designation must be lowercase snake_case'),
      );
    }
    if (
      item.guard !== undefined &&
      (typeof item.guard !== 'object' || item.guard === null || Array.isArray(item.guard))
    ) {
      issues.push(issue(`${path}.guard`, 'guard must be a JSON object'));
    }
    for (const [effectIndex, effect] of (item.effects ?? []).entries()) {
      validateWorkflowEffect(effect, `${path}.effects.${effectIndex}`, stageCodes, issues);
    }
  }

  return result(issues);
}

function validateWorkflowEffect(
  effect: WorkflowEffect,
  path: string,
  stageCodes: Set<string>,
  issues: WorkflowValidationIssue[],
): void {
  if (!WORKFLOW_EFFECT_TYPES.has(effect.type)) {
    issues.push(issue(`${path}.type`, `unsupported workflow effect: ${effect.type}`));
    return;
  }
  if (!effect.payload || typeof effect.payload !== 'object' || Array.isArray(effect.payload)) {
    if (effect.type === 'escalate') {
      issues.push(issue(`${path}.payload`, 'escalate effect requires a payload'));
    }
    return;
  }
  if (effect.type === 'escalate') {
    const payload = effect.payload;
    const timeoutHours = payload.timeout_hours;
    const targetRole = payload.target_role;
    const triggerStage = payload.trigger_stage;
    const templateCode = payload.notification_template_code;
    if (!Number.isInteger(timeoutHours) || Number(timeoutHours) <= 0) {
      issues.push(
        issue(`${path}.payload.timeout_hours`, 'timeout_hours must be a positive integer'),
      );
    }
    if (typeof targetRole !== 'string' || targetRole.trim().length === 0) {
      issues.push(issue(`${path}.payload.target_role`, 'target_role is required'));
    }
    if (
      triggerStage !== undefined &&
      (typeof triggerStage !== 'string' || !stageCodes.has(triggerStage))
    ) {
      issues.push(
        issue(`${path}.payload.trigger_stage`, 'trigger_stage must reference a workflow stage'),
      );
    }
    if (
      templateCode !== undefined &&
      (typeof templateCode !== 'string' || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(templateCode))
    ) {
      issues.push(
        issue(
          `${path}.payload.notification_template_code`,
          'notification_template_code must be URL-safe',
        ),
      );
    }
  }
}

export function assertValidWorkflowDefinition(workflow: WorkflowDefinition): WorkflowDefinition {
  const validation = validateWorkflowDefinition(workflow);
  if (!validation.ok) {
    throw new Error(validation.issues.map((entry) => `${entry.path}: ${entry.message}`).join('; '));
  }

  return workflow;
}

export function pendingActorFromWorkflowStage(stage: WorkflowStage): {
  pending_designation: string | null;
  pending_role: string | null;
} {
  if (stage.owner_designation) {
    return { pending_designation: stage.owner_designation, pending_role: null };
  }
  return { pending_designation: null, pending_role: stage.owner_role };
}

export function transitionActorAllowed(
  transition: WorkflowTransition,
  actorRoles: WorkflowRole[],
  actorDesignations: string[] = [],
): boolean {
  if (transition.actor_designation) {
    return actorDesignations.includes(transition.actor_designation);
  }
  if (transition.actor_role === 'citizen') {
    return actorRoles.includes('citizen');
  }
  if (transition.actor_role === 'system') {
    return actorRoles.includes('system');
  }
  return actorRoles.includes(transition.actor_role);
}

export function evaluateTransitionGuard(
  guard: Record<string, unknown> | undefined,
  runtimeSnapshot: Record<string, unknown> | undefined,
): boolean {
  if (!guard) {
    return true;
  }
  const type =
    typeof guard.type === 'string' ? guard.type : typeof guard.kind === 'string' ? guard.kind : '';
  if (!type) {
    return true;
  }
  const snapshot = runtimeSnapshot ?? {};
  if (type === 'boc_required') {
    return snapshot.requires_boc_resolution === true;
  }
  if (type === 'boc_skip' || type === 'boc_not_required') {
    return snapshot.requires_boc_resolution !== true;
  }
  if (type === 'municipal_signoff_required') {
    if (snapshot.municipal_signoff_required === false) {
      return false;
    }
    if (snapshot.municipal_signoff_required === true) {
      return true;
    }
    return snapshot.high_value === true;
  }
  if (type === 'municipal_signoff_not_required' || type === 'municipal_signoff_skip') {
    if (snapshot.municipal_signoff_required === true) {
      return false;
    }
    if (snapshot.municipal_signoff_required === false) {
      return true;
    }
    return snapshot.high_value !== true;
  }
  if (type === 'payment_paid') {
    const feeCode = guard.fee_code;
    if (feeCode === 'application' || feeCode === 'approval') {
      return feeLinePaidInSnapshot(snapshot, feeCode);
    }
    const schedule = snapshot.payment_schedule;
    if (typeof schedule === 'string') {
      const required = requiredFeeLineCodesForSchedule(schedule);
      if (required.length > 0 && required.every((code) => feeLinePaidInSnapshot(snapshot, code))) {
        return true;
      }
    }
    const status = snapshot.payment_status;
    return status === 'paid' || status === 'not_required';
  }
  if (type === 'approval_fee_paid') {
    const schedule = snapshot.payment_schedule;
    if (schedule === 'upfront_only') {
      return true;
    }
    if (feeLinePaidInSnapshot(snapshot, 'approval')) {
      return true;
    }
    const status = snapshot.payment_status;
    return status === 'paid' || status === 'not_required';
  }
  return true;
}

function requiredFeeLineCodesForSchedule(schedule: string): Array<'application' | 'approval'> {
  if (schedule === 'deferred_only') {
    return ['approval'];
  }
  if (schedule === 'upfront_and_deferred') {
    return ['application', 'approval'];
  }
  return ['application'];
}

function feeLinePaidInSnapshot(
  snapshot: Record<string, unknown>,
  feeCode: 'application' | 'approval',
): boolean {
  const settlement = snapshot.fee_settlement;
  if (!settlement || typeof settlement !== 'object' || Array.isArray(settlement)) {
    return false;
  }
  const line = (settlement as Record<string, unknown>)[feeCode];
  if (!line || typeof line !== 'object' || Array.isArray(line)) {
    return false;
  }
  return (line as { status?: unknown }).status === 'paid';
}

export function transitionIncludesPaymentLinkEffect(transition: WorkflowTransition): boolean {
  return (transition.effects ?? []).some((effect) => effect.type === 'generate_payment_link');
}

export function paymentLinkTransitionPermitted(
  transition: WorkflowTransition,
  actorDesignations: string[],
  capabilities: DesignationCapability[],
): boolean {
  if (!transitionIncludesPaymentLinkEffect(transition)) {
    return true;
  }
  if (!capabilities.length) {
    return false;
  }
  const active = capabilities.filter((entry) => actorDesignations.includes(entry.code));
  return active.some((entry) => entry.is_department_head === true);
}

function rejectPermittedForActor(
  verb: string,
  from: WorkflowStage,
  actorDesignations: string[],
  capabilities: DesignationCapability[],
): boolean {
  if (verb !== 'reject') {
    return true;
  }
  if (!capabilities.length) {
    return true;
  }
  const active = capabilities.filter((entry) => actorDesignations.includes(entry.code));
  if (!active.length) {
    return false;
  }
  if (from.stage_kind === 'dept_head') {
    return active.some((entry) => entry.is_department_head === true);
  }
  if (from.stage_kind === 'municipality') {
    if (from.code !== CHAIRPERSON_REJECT_STAGE_CODE) {
      return false;
    }
    return active.some((entry) => entry.can_reject_municipal === true);
  }
  if (from.stage_kind) {
    return false;
  }
  return true;
}

function internalReturnTargetAllowed(to: WorkflowStage): boolean {
  if (to.owner_role === 'citizen') {
    return false;
  }
  if (to.stage_kind === 'citizen') {
    return false;
  }
  return true;
}

function transitionRequiresComment(verb: string, transition: WorkflowTransition): boolean {
  return verb === 'reject' || transition.requires_comment === true;
}

function stageAllowsVerb(stage: WorkflowStage, verb: string): boolean {
  if (!stage.allowed_verbs?.length) {
    return true;
  }
  return stage.allowed_verbs.includes(verb);
}

export function evaluateTransition(input: EvaluateTransitionInput): TransitionEvaluation {
  const from = input.workflow.stages.find((stageItem) => stageItem.code === input.current_stage);
  if (!from) {
    return { ok: false, reason: 'UNKNOWN_STAGE' };
  }
  if (from.terminal) {
    return { ok: false, reason: 'TERMINAL_STAGE' };
  }
  if (!stageAllowsVerb(from, input.verb)) {
    return { ok: false, reason: 'VERB_NOT_ALLOWED' };
  }

  const candidates = input.workflow.transitions.filter(
    (transitionItem) =>
      transitionItem.from === input.current_stage && transitionItem.verb === input.verb,
  );
  if (!candidates.length) {
    return { ok: false, reason: 'UNKNOWN_TRANSITION' };
  }
  const candidate =
    candidates.find((transitionItem) =>
      evaluateTransitionGuard(transitionItem.guard, input.runtime_snapshot),
    ) ?? null;
  if (!candidate) {
    return { ok: false, reason: 'GUARD_BLOCKED' };
  }

  const actorDesignations = input.actor_designations ?? [];
  if (!transitionActorAllowed(candidate, input.actor_roles, actorDesignations)) {
    return {
      ok: false,
      reason: actorDesignations.length ? 'ACTOR_NOT_ALLOWED' : 'ROLE_NOT_ALLOWED',
    };
  }

  if (
    !rejectPermittedForActor(
      input.verb,
      from,
      actorDesignations,
      input.designation_capabilities ?? [],
    )
  ) {
    return { ok: false, reason: 'REJECT_NOT_PERMITTED' };
  }

  if (
    !paymentLinkTransitionPermitted(
      candidate,
      actorDesignations,
      input.designation_capabilities ?? [],
    )
  ) {
    return { ok: false, reason: 'PAYMENT_LINK_NOT_PERMITTED' };
  }

  if (transitionRequiresComment(input.verb, candidate) && !input.comment?.trim()) {
    return { ok: false, reason: 'COMMENT_REQUIRED' };
  }

  const to = input.workflow.stages.find((stageItem) => stageItem.code === candidate.to);
  if (!to) {
    return { ok: false, reason: 'UNKNOWN_STAGE' };
  }

  if (input.verb === INTERNAL_RETURN_VERB && !internalReturnTargetAllowed(to)) {
    return { ok: false, reason: 'RETURN_TARGET_NOT_ALLOWED' };
  }

  return {
    ok: true,
    from,
    to,
    transition: candidate,
    effects: candidate.effects ?? [],
  };
}

export function calculateSlaDueAt(submittedAt: Date, slaHours: number | undefined): Date | null {
  if (slaHours === undefined) {
    return null;
  }

  const dueAt = new Date(submittedAt);
  dueAt.setHours(dueAt.getHours() + slaHours);
  return dueAt;
}

export function getInitialStage(workflow: WorkflowDefinition): WorkflowStage {
  const initial = workflow.stages.find((stageItem) => stageItem.initial);
  if (!initial) {
    throw new Error(`Workflow ${workflow.code} has no initial stage`);
  }
  return initial;
}

export function workflowForPattern(pattern: string): WorkflowDefinition {
  if (pattern === 'booking') {
    return bookingWorkflow;
  }
  if (pattern === 'tax-payment' || pattern === 'instant') {
    return instantWorkflow;
  }
  return certificateIssuanceWorkflow;
}

function stage(
  code: string,
  en: string,
  bn: string,
  hi: string,
  ownerRole: WorkflowRole,
  slaHours?: number,
  initial = false,
  terminal = false,
): WorkflowStage {
  return {
    code,
    label: { en, bn, hi },
    owner_role: ownerRole,
    sla_hours: slaHours,
    initial,
    terminal,
  };
}

function transition(
  from: string,
  to: string,
  verb: string,
  actorRole: WorkflowRole,
  effects: WorkflowEffect[] = [],
  requiresComment = false,
): WorkflowTransition {
  return {
    from,
    to,
    verb,
    actor_role: actorRole,
    requires_comment: requiresComment,
    effects,
  };
}

function validateWorkflowLabel(
  value: WorkflowLabel | undefined,
  path: string,
  issues: WorkflowValidationIssue[],
): void {
  for (const locale of ['en', 'bn', 'hi'] as const) {
    if (!value?.[locale]) {
      issues.push(issue(`${path}.${locale}`, `${locale} translation is required`));
    }
  }
}

function issue(path: string, message: string): WorkflowValidationIssue {
  return { path, message };
}

function result(issues: WorkflowValidationIssue[]): WorkflowValidationResult {
  return { ok: issues.length === 0, issues };
}

export const BOC_POLICIES = ['never', 'always', 'officer_may_require'] as const;

export type BocPolicy = (typeof BOC_POLICIES)[number];

export const DEFAULT_BOC_POLICY: BocPolicy = 'never';

export const BOC_RECORD_VERB = 'record-boc-resolution';

export type BocResolutionPayload = {
  resolution_number: string;
  resolution_date: string;
};

function isOverrideConfigRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseBocPolicy(overrideConfig: unknown): BocPolicy {
  return readBocPolicy(overrideConfig);
}

export function readBocPolicy(overrideConfig: unknown): BocPolicy {
  if (!isOverrideConfigRecord(overrideConfig)) {
    return DEFAULT_BOC_POLICY;
  }
  const raw = overrideConfig.boc_policy;
  if (typeof raw === 'string' && (BOC_POLICIES as readonly string[]).includes(raw)) {
    return raw as BocPolicy;
  }
  return DEFAULT_BOC_POLICY;
}

/** Merge service policy into the runtime snapshot used for guard evaluation. */
export function applyBocPolicyToSnapshot(
  policy: BocPolicy,
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  if (policy === 'always') {
    return { ...snapshot, requires_boc_resolution: true };
  }
  if (policy === 'never') {
    return { ...snapshot, requires_boc_resolution: false };
  }
  return snapshot;
}

export function assertRequireBocAllowed(policy: BocPolicy, requireBoc: boolean | undefined): void {
  if (requireBoc === true && policy === 'never') {
    throw new Error('BOC resolution cannot be required when service boc_policy is never');
  }
}

export function mergeOfficerRequireBoc(
  policy: BocPolicy,
  snapshot: Record<string, unknown>,
  requireBoc: boolean | undefined,
  currentStage: string,
): Record<string, unknown> {
  if (policy !== 'officer_may_require' || requireBoc === undefined) {
    return snapshot;
  }
  if (currentStage !== 'technical-scrutiny') {
    return snapshot;
  }
  assertRequireBocAllowed(policy, requireBoc);
  return { ...snapshot, requires_boc_resolution: requireBoc };
}

export function validateBocResolutionForTransition(
  verb: string,
  policy: BocPolicy,
  payload: BocResolutionPayload | undefined,
): void {
  if (verb !== BOC_RECORD_VERB) {
    return;
  }
  if (policy === 'never') {
    throw new Error('BOC resolution recording is disabled for this service');
  }
  const number = payload?.resolution_number?.trim();
  const date = payload?.resolution_date?.trim();
  if (!number || !date) {
    throw new Error('BOC resolution number and date are required');
  }
}

export function mergeBocResolutionIntoSnapshot(
  snapshot: Record<string, unknown>,
  payload: BocResolutionPayload,
): Record<string, unknown> {
  return {
    ...snapshot,
    boc_resolution: {
      resolution_number: payload.resolution_number.trim(),
      resolution_date: payload.resolution_date.trim(),
    },
  };
}

export function officerMaySetRequireBoc(policy: BocPolicy, currentStage: string): boolean {
  return policy === 'officer_may_require' && currentStage === 'technical-scrutiny';
}

export function transitionRequiresBocResolutionFields(verb: string): boolean {
  return verb === BOC_RECORD_VERB;
}

export const MUNICIPAL_SIGNOFF_POLICIES = ['never', 'high_value_only', 'always'] as const;

export type MunicipalSignoffPolicy = (typeof MUNICIPAL_SIGNOFF_POLICIES)[number];

export const DEFAULT_MUNICIPAL_SIGNOFF_POLICY: MunicipalSignoffPolicy = 'high_value_only';

export const DEFAULT_MUNICIPAL_SIGNOFF_THRESHOLD_PAISE = 50_000_000;

export function readMunicipalSignoffPolicy(overrideConfig: unknown): MunicipalSignoffPolicy {
  if (!isOverrideConfigRecord(overrideConfig)) {
    return DEFAULT_MUNICIPAL_SIGNOFF_POLICY;
  }
  const raw = overrideConfig.municipal_signoff_policy;
  if (typeof raw === 'string' && (MUNICIPAL_SIGNOFF_POLICIES as readonly string[]).includes(raw)) {
    return raw as MunicipalSignoffPolicy;
  }
  return DEFAULT_MUNICIPAL_SIGNOFF_POLICY;
}

export function readMunicipalSignoffThresholdPaise(overrideConfig: unknown): number {
  if (!isOverrideConfigRecord(overrideConfig)) {
    return DEFAULT_MUNICIPAL_SIGNOFF_THRESHOLD_PAISE;
  }
  const raw = overrideConfig.municipal_signoff_threshold_paise;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }
  return DEFAULT_MUNICIPAL_SIGNOFF_THRESHOLD_PAISE;
}

function snapshotFeePaise(snapshot: Record<string, unknown>): number | null {
  const computed = snapshot.computed_fee_paise;
  if (typeof computed === 'number' && Number.isFinite(computed) && computed >= 0) {
    return Math.floor(computed);
  }
  const fee = snapshot.fee_paise;
  if (typeof fee === 'number' && Number.isFinite(fee) && fee >= 0) {
    return Math.floor(fee);
  }
  return null;
}

function snapshotRequiresMunicipalFlag(snapshot: Record<string, unknown>): boolean {
  if (snapshot.requires_municipal_signoff === true) {
    return true;
  }
  const formData = snapshot.form_data;
  if (formData && typeof formData === 'object' && !Array.isArray(formData)) {
    return (formData as Record<string, unknown>).requires_municipal_signoff === true;
  }
  return false;
}

/** Whether EO→CIC→VC→Chairperson ladder applies for this application snapshot. */
export function resolveMunicipalSignoffRequired(
  policy: MunicipalSignoffPolicy,
  snapshot: Record<string, unknown>,
  thresholdPaise: number,
  feePreviewPaise?: number | null,
): boolean {
  if (policy === 'never') {
    return false;
  }
  if (policy === 'always') {
    return true;
  }
  if (snapshotRequiresMunicipalFlag(snapshot)) {
    return true;
  }
  const fee = snapshotFeePaise(snapshot) ?? feePreviewPaise ?? null;
  if (fee !== null && fee >= thresholdPaise) {
    return true;
  }
  return false;
}

/** Merge service policy + fee into the runtime snapshot used for guard evaluation. */
export function applyMunicipalSignoffPolicyToSnapshot(
  policy: MunicipalSignoffPolicy,
  snapshot: Record<string, unknown>,
  options?: { thresholdPaise?: number; feePreviewPaise?: number | null },
): Record<string, unknown> {
  const threshold = options?.thresholdPaise ?? DEFAULT_MUNICIPAL_SIGNOFF_THRESHOLD_PAISE;
  const required = resolveMunicipalSignoffRequired(
    policy,
    snapshot,
    threshold,
    options?.feePreviewPaise,
  );
  return {
    ...snapshot,
    municipal_signoff_required: required,
    high_value: required,
  };
}

export function municipalSignoffBranchPreview(
  policy: MunicipalSignoffPolicy,
  snapshot: Record<string, unknown>,
  guard: Record<string, unknown> | undefined,
  options?: { thresholdPaise?: number; feePreviewPaise?: number | null },
): Record<string, unknown> {
  const type =
    typeof guard?.type === 'string'
      ? guard.type
      : typeof guard?.kind === 'string'
        ? guard.kind
        : '';
  if (type === 'municipal_signoff_required') {
    return { ...snapshot, municipal_signoff_required: true, high_value: true };
  }
  if (type === 'municipal_signoff_not_required' || type === 'municipal_signoff_skip') {
    return { ...snapshot, municipal_signoff_required: false, high_value: false };
  }
  return applyMunicipalSignoffPolicyToSnapshot(policy, snapshot, options);
}
