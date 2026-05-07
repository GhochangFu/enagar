export type WorkflowRole = 'citizen' | 'tenant_clerk' | 'tenant_admin' | 'state_admin' | string;
export type WorkflowEffectType = 'notify' | 'sla_timer' | 'audit' | 'certificate' | 'escalate';

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
