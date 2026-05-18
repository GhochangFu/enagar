export type WorkflowRole = 'citizen' | 'tenant_clerk' | 'tenant_admin' | 'state_admin' | string;
export type WorkflowEffectType = 'notify' | 'sla_timer' | 'audit' | 'certificate' | 'escalate';

const WORKFLOW_EFFECT_TYPES = new Set<WorkflowEffectType>([
  'notify',
  'sla_timer',
  'audit',
  'certificate',
  'escalate',
]);

export interface WorkflowLabel {
  en: string;
  bn: string;
  hi: string;
}

export interface WorkflowStage {
  code: string;
  label: WorkflowLabel;
  owner_role: WorkflowRole;
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
  actor_role: WorkflowRole;
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

export interface EvaluateTransitionInput {
  workflow: WorkflowDefinition;
  current_stage: string;
  verb: string;
  actor_roles: WorkflowRole[];
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
    | 'COMMENT_REQUIRED';
}

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
    if (!item.owner_role) {
      issues.push(issue(`${path}.owner_role`, 'owner role is required'));
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
    if (!item.actor_role) {
      issues.push(issue(`${path}.actor_role`, 'actor role is required'));
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

export function evaluateTransition(input: EvaluateTransitionInput): TransitionEvaluation {
  const from = input.workflow.stages.find((stageItem) => stageItem.code === input.current_stage);
  if (!from) {
    return { ok: false, reason: 'UNKNOWN_STAGE' };
  }
  if (from.terminal) {
    return { ok: false, reason: 'TERMINAL_STAGE' };
  }

  const candidate = input.workflow.transitions.find(
    (transitionItem) =>
      transitionItem.from === input.current_stage && transitionItem.verb === input.verb,
  );
  if (!candidate) {
    return { ok: false, reason: 'UNKNOWN_TRANSITION' };
  }
  if (!input.actor_roles.includes(candidate.actor_role)) {
    return { ok: false, reason: 'ROLE_NOT_ALLOWED' };
  }
  if (candidate.requires_comment && !input.comment?.trim()) {
    return { ok: false, reason: 'COMMENT_REQUIRED' };
  }

  const to = input.workflow.stages.find((stageItem) => stageItem.code === candidate.to);
  if (!to) {
    return { ok: false, reason: 'UNKNOWN_STAGE' };
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
