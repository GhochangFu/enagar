import { localeMap, slugify } from '@enagar/forms/builder';

import type { WorkflowDefinition, WorkflowStage, WorkflowTransition } from '@enagar/workflow';

export const DESIGNATION_WORKFLOW_VERBS = [
  'forward',
  'return',
  'return-for-correction',
  'reject',
  'route-to-boc',
  'approve-to-executive',
  'record-boc-resolution',
] as const;

export const WORKFLOW_GUARD_PRESETS = [
  { value: '', label: 'No guard' },
  { value: 'boc_required', label: 'BOC required (requires_boc_resolution)' },
  { value: 'boc_not_required', label: 'BOC not required (skip BOC stage)' },
  { value: 'municipal_signoff_required', label: 'Municipal sign-off required (ladder)' },
  {
    value: 'municipal_signoff_not_required',
    label: 'Municipal sign-off not required (skip ladder)',
  },
  { value: 'payment_paid', label: 'Payment paid or not required' },
  { value: 'approval_fee_paid', label: 'Approval fee paid or not required (Phase 12)' },
] as const;

export type DesignationWorkflowVerb = (typeof DESIGNATION_WORKFLOW_VERBS)[number];

const MUNICIPAL_STAGE_DEFS: Array<{
  code: string;
  designation: string;
  labelEn: string;
}> = [
  { code: 'eo-approval', designation: 'executive_officer', labelEn: 'Executive Officer approval' },
  { code: 'cic-approval', designation: 'cic', labelEn: 'Commissioner in Council approval' },
  { code: 'vc-approval', designation: 'vice_chairperson', labelEn: 'Vice-Chairperson approval' },
  {
    code: 'chairperson-approval',
    designation: 'chairperson',
    labelEn: 'Chairperson approval',
  },
];

function stageLabel(en: string) {
  return localeMap(en);
}

function upsertStage(workflow: WorkflowDefinition, stage: WorkflowStage): WorkflowDefinition {
  const exists = workflow.stages.some((row) => row.code === stage.code);
  return {
    ...workflow,
    stages: exists
      ? workflow.stages.map((row) => (row.code === stage.code ? { ...row, ...stage } : row))
      : [...workflow.stages, stage],
  };
}

function hasTransition(
  workflow: WorkflowDefinition,
  from: string,
  to: string,
  verb: string,
): boolean {
  return workflow.transitions.some(
    (row) => row.from === from && row.to === to && row.verb === verb,
  );
}

function addTransition(
  workflow: WorkflowDefinition,
  transition: WorkflowTransition,
): WorkflowDefinition {
  if (hasTransition(workflow, transition.from, transition.to, transition.verb)) {
    return workflow;
  }
  return { ...workflow, transitions: [...workflow.transitions, transition] };
}

function designationTransition(
  from: string,
  to: string,
  verb: string,
  designation: string,
  extra?: Partial<WorkflowTransition>,
): WorkflowTransition {
  return {
    from,
    to,
    verb,
    actor_role: 'tenant_clerk',
    actor_designation: designation,
    effects: [{ type: 'audit' }],
    ...extra,
  };
}

function designationStage(
  code: string,
  designation: string,
  labelEn: string,
  stageKind: WorkflowStage['stage_kind'],
  allowedVerbs: string[],
  extra?: Partial<WorkflowStage>,
): WorkflowStage {
  return {
    code,
    label: stageLabel(labelEn),
    owner_role: 'tenant_clerk',
    owner_designation: designation,
    stage_kind: stageKind,
    allowed_verbs: allowedVerbs,
    sla_hours: 48,
    ...extra,
  };
}

/**
 * Drops legacy linear stages/transitions (e.g. approved → closed) before applying a template.
 * Keeps workflow code/version and one citizen initial stage.
 */
export function resetDesignationWorkflow(workflow: WorkflowDefinition): WorkflowDefinition {
  const initial =
    workflow.stages.find((stage) => stage.initial) ??
    workflow.stages.find((stage) => stage.owner_role === 'citizen');

  const submittedStage: WorkflowStage = initial
    ? {
        ...initial,
        code: initial.code || 'submitted',
        initial: true,
        terminal: false,
        owner_role: 'citizen',
        owner_designation: undefined,
      }
    : {
        code: 'submitted',
        label: stageLabel('Submitted'),
        owner_role: 'citizen',
        initial: true,
      };

  return {
    code: workflow.code,
    version: workflow.version,
    stages: [submittedStage],
    transitions: [],
  };
}

/** Pattern C — full hoarding scrutiny workflow (replaces draft, not merge). */
export function applyHoardingScrutinyTemplate(workflow: WorkflowDefinition): WorkflowDefinition {
  const base = resetDesignationWorkflow(workflow);
  const entryCode = base.stages[0]?.code ?? 'submitted';

  const next = insertHoardingScrutinyBlock(base, { afterStageCode: entryCode });

  return insertBocResolutionBranch(next);
}

/** BOC stage + executive approval + certificate (guarded branches from technical-scrutiny). */
export function insertBocResolutionBranch(workflow: WorkflowDefinition): WorkflowDefinition {
  let next = upsertStage(
    workflow,
    designationStage('boc-resolution', 'board_of_councillors', 'BOC resolution', 'municipality', [
      'record-boc-resolution',
      'forward',
    ]),
  );
  next = upsertStage(
    next,
    designationStage(
      'executive-approval',
      'executive_officer',
      'Executive approval',
      'municipality',
      ['forward'],
    ),
  );
  next = upsertStage(next, {
    code: 'certificate-issued',
    label: stageLabel('Certificate issued'),
    owner_role: 'citizen',
    terminal: true,
  });

  next = addTransition(
    next,
    designationTransition(
      'technical-scrutiny',
      'boc-resolution',
      'route-to-boc',
      'hoarding_officer',
      {
        guard: { type: 'boc_required' },
      },
    ),
  );
  next = addTransition(
    next,
    designationTransition(
      'technical-scrutiny',
      'executive-approval',
      'approve-to-executive',
      'hoarding_officer',
      { guard: { type: 'boc_not_required' } },
    ),
  );
  next = addTransition(
    next,
    designationTransition(
      'boc-resolution',
      'executive-approval',
      'record-boc-resolution',
      'board_of_councillors',
    ),
  );
  return insertPostApprovalPaymentBlock(next, {
    entryStageCode: 'executive-approval',
    headDesignation: 'hoarding_officer',
    terminalStageCode: 'certificate-issued',
    terminalStageLabel: 'Certificate issued',
  });
}

/** Pattern B — PWD maker–checker–approver–dept head + municipal ladder (replaces draft). */
export function applyPwdWorksTemplate(workflow: WorkflowDefinition): WorkflowDefinition {
  const base = resetDesignationWorkflow(workflow);
  const entryCode = base.stages[0]?.code ?? 'submitted';

  let next = upsertStage(
    base,
    designationStage('maker-review', 'pwd_junior_engineer', 'Maker review', 'maker', [
      'forward',
      'return-for-correction',
    ]),
  );
  next = upsertStage(
    next,
    designationStage('checker-review', 'pwd_assistant_engineer', 'Checker review', 'checker', [
      'forward',
      'return',
    ]),
  );
  next = upsertStage(
    next,
    designationStage('approver-review', 'pwd_assistant_engineer', 'Approver review', 'approver', [
      'forward',
      'return',
    ]),
  );
  next = upsertStage(
    next,
    designationStage(
      'dept-head-review',
      'pwd_executive_engineer',
      'Department head review',
      'dept_head',
      ['forward', 'forward-to-eo', 'forward-to-dept-head-final', 'return', 'reject'],
    ),
  );

  next = addTransition(
    next,
    designationTransition(entryCode, 'maker-review', 'forward', 'citizen', {
      actor_role: 'citizen',
      actor_designation: undefined,
    }),
  );
  next = addForwardReturnPair(next, {
    from: 'maker-review',
    to: 'checker-review',
    forwardDesignation: 'pwd_junior_engineer',
    returnDesignation: 'pwd_assistant_engineer',
  });
  next = addForwardReturnPair(next, {
    from: 'checker-review',
    to: 'approver-review',
    forwardDesignation: 'pwd_assistant_engineer',
    returnDesignation: 'pwd_assistant_engineer',
  });
  next = addTransition(
    next,
    designationTransition(
      'approver-review',
      'dept-head-review',
      'forward',
      'pwd_assistant_engineer',
    ),
  );
  next = addTransition(
    next,
    designationTransition(
      'dept-head-review',
      'approver-review',
      'return',
      'pwd_executive_engineer',
    ),
  );

  next = insertMunicipalSignoffBlock(next, {
    entryStageCode: 'dept-head-review',
    includeReturnChain: true,
  });

  next = insertPostApprovalPaymentBlock(next, { skipTerminal: true });
  next = insertPostApprovalExecutionBlock(next);

  return next;
}

/** Dept head + municipal ladder only (replaces draft, not merge). */
export function applyMunicipalLadderTemplate(workflow: WorkflowDefinition): WorkflowDefinition {
  const base = resetDesignationWorkflow(workflow);
  const entryCode = base.stages[0]?.code ?? 'submitted';

  let next = upsertStage(
    base,
    designationStage(
      'dept-head-review',
      'pwd_executive_engineer',
      'Department head review',
      'dept_head',
      ['forward', 'forward-to-eo', 'forward-to-dept-head-final', 'return', 'reject'],
    ),
  );

  next = addTransition(
    next,
    designationTransition(entryCode, 'dept-head-review', 'forward', 'citizen', {
      actor_role: 'citizen',
      actor_designation: undefined,
    }),
  );

  next = insertMunicipalSignoffBlock(next, {
    entryStageCode: 'dept-head-review',
    includeReturnChain: true,
  });

  next = insertPostApprovalPaymentBlock(next, { skipTerminal: true });
  next = insertPostApprovalExecutionBlock(next);

  return next;
}

/**
 * Post-approval payment stages (ADR-0012 Phase 11): dept head issues link → system confirms paid.
 * Replaces any direct `dept-head-final` → `closed` forward edge when present.
 */
export function insertPostApprovalPaymentBlock(
  workflow: WorkflowDefinition,
  options?: {
    entryStageCode?: string;
    headDesignation?: string;
    terminalStageCode?: string;
    terminalStageLabel?: string;
    /** When true, stop at payment-received (Phase 12 execution block follows). */
    skipTerminal?: boolean;
  },
): WorkflowDefinition {
  const entryCode = options?.entryStageCode ?? 'dept-head-final';
  const headDesignation = options?.headDesignation ?? 'pwd_executive_engineer';
  const terminalCode = options?.terminalStageCode ?? 'closed';
  const terminalLabel = options?.terminalStageLabel ?? 'Closed';
  const skipTerminal = options?.skipTerminal === true;

  let next = {
    ...workflow,
    transitions: workflow.transitions.filter(
      (row) => !(row.from === entryCode && row.to === terminalCode && row.verb === 'forward'),
    ),
  };

  next = upsertStage(
    next,
    designationStage('payment-pending', headDesignation, 'Payment pending', 'post_approval'),
  );
  next = upsertStage(next, {
    code: 'payment-received',
    label: stageLabel('Payment received'),
    owner_role: 'system',
    stage_kind: 'system',
    allowed_verbs: ['forward'],
  });

  if (!skipTerminal) {
    next = upsertStage(next, {
      code: terminalCode,
      label: stageLabel(terminalLabel),
      owner_role: 'citizen',
      terminal: true,
    });
  }

  next = addTransition(
    next,
    designationTransition(entryCode, 'payment-pending', 'forward', headDesignation, {
      effects: [
        { type: 'audit' },
        { type: 'generate_payment_link', payload: { fee_code: 'approval' } },
      ],
    }),
  );
  next = addTransition(next, {
    from: 'payment-pending',
    to: 'payment-received',
    verb: 'confirm-payment',
    actor_role: 'system',
    guard: { type: 'payment_paid', fee_code: 'approval' },
    effects: [{ type: 'audit' }],
  });

  if (!skipTerminal) {
    next = addTransition(next, {
      from: 'payment-received',
      to: terminalCode,
      verb: 'forward',
      actor_role: 'system',
      guard: { type: 'approval_fee_paid' },
      effects: [{ type: 'audit' }],
    });
  }

  return next;
}

/**
 * Post-approval execution (Phase 12 / ADR-0012): work order → progress → feedback → closed.
 * Chains after `payment-received` when payment block uses `skipTerminal: true`.
 */
export function insertPostApprovalExecutionBlock(
  workflow: WorkflowDefinition,
  options?: {
    assigneeDesignation?: string;
  },
): WorkflowDefinition {
  const assignee = options?.assigneeDesignation ?? 'pwd_executive_engineer';
  let next = {
    ...workflow,
    transitions: workflow.transitions.filter(
      (row) => !(row.from === 'payment-received' && row.verb === 'forward'),
    ),
  };

  next = upsertStage(next, {
    code: 'work-order-issued',
    label: stageLabel('Work order issued'),
    owner_role: 'tenant_clerk',
    owner_designation: assignee,
    stage_kind: 'post_approval',
    allowed_verbs: ['forward'],
  });
  next = upsertStage(
    next,
    designationStage('work-in-progress', assignee, 'Work in progress', 'post_approval', [
      'forward',
    ]),
  );
  next = upsertStage(
    next,
    designationStage('work-completed', assignee, 'Work completed', 'post_approval', ['forward']),
  );
  next = upsertStage(next, {
    code: 'citizen-feedback',
    label: stageLabel('Citizen feedback'),
    owner_role: 'citizen',
    stage_kind: 'citizen',
    allowed_verbs: ['submit-feedback'],
  });
  next = upsertStage(next, {
    code: 'closed',
    label: stageLabel('Closed'),
    owner_role: 'citizen',
    terminal: true,
  });

  next = addTransition(next, {
    from: 'payment-received',
    to: 'work-order-issued',
    verb: 'forward',
    actor_role: 'system',
    guard: { type: 'approval_fee_paid' },
    effects: [{ type: 'audit' }, { type: 'create_work_order' }],
  });
  next = addTransition(
    next,
    designationTransition('work-order-issued', 'work-in-progress', 'forward', assignee, {
      guard: { type: 'approval_fee_paid' },
    }),
  );
  next = addTransition(
    next,
    designationTransition('work-in-progress', 'work-completed', 'forward', assignee, {
      guard: { type: 'approval_fee_paid' },
    }),
  );
  next = addTransition(
    next,
    designationTransition('work-completed', 'citizen-feedback', 'forward', assignee, {
      guard: { type: 'approval_fee_paid' },
    }),
  );
  next = addTransition(next, {
    from: 'citizen-feedback',
    to: 'closed',
    verb: 'submit-feedback',
    actor_role: 'citizen',
    effects: [{ type: 'audit' }],
  });

  return next;
}

/** EO → CIC → VC → Chairperson municipal forward ladder + optional return spine (merge onto existing draft). */
export function insertMunicipalSignoffBlock(
  workflow: WorkflowDefinition,
  options: {
    /** Dept-head (or similar) stage that forwards into EO when sign-off is required. */
    entryStageCode: string;
    /** Stage after municipal return (defaults to `dept-head-final`). */
    exitStageCode?: string;
    includeReturnChain?: boolean;
  },
): WorkflowDefinition {
  const exitCode = options.exitStageCode ?? 'dept-head-final';
  let next = { ...workflow };

  for (const item of MUNICIPAL_STAGE_DEFS) {
    next = upsertStage(
      next,
      designationStage(item.code, item.designation, item.labelEn, 'municipality', [
        'forward',
        'return',
        ...(item.designation === 'chairperson' ? ['reject'] : []),
      ]),
    );
  }

  next = upsertStage(
    next,
    designationStage(exitCode, 'pwd_executive_engineer', 'Department head (final)', 'dept_head', [
      'forward',
      'return',
      'reject',
    ]),
  );

  const ladder = MUNICIPAL_STAGE_DEFS.map((row) => row.code);
  for (let index = 0; index < ladder.length - 1; index += 1) {
    const from = ladder[index]!;
    const to = ladder[index + 1]!;
    const designation = MUNICIPAL_STAGE_DEFS[index]!.designation;
    next = addTransition(next, designationTransition(from, to, 'forward', designation));
  }

  next = addTransition(
    next,
    designationTransition(
      options.entryStageCode,
      ladder[0]!,
      'forward-to-eo',
      'pwd_executive_engineer',
      {
        guard: { type: 'municipal_signoff_required' },
      },
    ),
  );

  next = addTransition(
    next,
    designationTransition(
      options.entryStageCode,
      exitCode,
      'forward-to-dept-head-final',
      'pwd_executive_engineer',
      { guard: { type: 'municipal_signoff_not_required' } },
    ),
  );

  next = addTransition(
    next,
    designationTransition(ladder[ladder.length - 1]!, exitCode, 'forward', 'chairperson'),
  );

  if (options.includeReturnChain !== false) {
    const reversed = [...ladder].reverse();
    for (let index = 0; index < reversed.length - 1; index += 1) {
      const from = reversed[index]!;
      const to = reversed[index + 1]!;
      const designation =
        MUNICIPAL_STAGE_DEFS.find((row) => row.code === from)?.designation ?? 'chairperson';
      next = addTransition(next, designationTransition(from, to, 'return', designation));
    }
    next = addTransition(
      next,
      designationTransition(ladder[0]!, exitCode, 'return', 'executive_officer'),
    );
  }

  return next;
}

/** Hoarding scrutiny stages/transitions only (merge onto existing draft). */
export function insertHoardingScrutinyBlock(
  workflow: WorkflowDefinition,
  options: { afterStageCode: string },
): WorkflowDefinition {
  const stages = [
    designationStage('clerk-verification', 'hoarding_clerk', 'Clerk verification', 'maker', [
      'forward',
      'return-for-correction',
    ]),
    designationStage('site-inspection', 'hoarding_inspector', 'Site inspection', 'checker', [
      'forward',
      'return',
    ]),
    designationStage('technical-scrutiny', 'hoarding_officer', 'Technical scrutiny', 'approver', [
      'forward',
      'return',
      'route-to-boc',
      'approve-to-executive',
    ]),
  ];

  let next = { ...workflow };
  for (const stage of stages) {
    next = upsertStage(next, stage);
  }

  next = addTransition(
    next,
    designationTransition(options.afterStageCode, 'clerk-verification', 'forward', 'citizen', {
      actor_designation: undefined,
      actor_role: 'citizen',
    }),
  );

  next = addForwardReturnPair(next, {
    from: 'clerk-verification',
    to: 'site-inspection',
    forwardDesignation: 'hoarding_clerk',
    returnDesignation: 'hoarding_inspector',
  });

  next = addForwardReturnPair(next, {
    from: 'site-inspection',
    to: 'technical-scrutiny',
    forwardDesignation: 'hoarding_inspector',
    returnDesignation: 'hoarding_officer',
  });

  return next;
}

export function addForwardReturnPair(
  workflow: WorkflowDefinition,
  options: {
    from: string;
    to: string;
    forwardDesignation: string;
    returnDesignation?: string;
  },
): WorkflowDefinition {
  let next = addTransition(
    workflow,
    designationTransition(options.from, options.to, 'forward', options.forwardDesignation),
  );
  if (options.returnDesignation) {
    next = addTransition(
      next,
      designationTransition(options.to, options.from, 'return', options.returnDesignation),
    );
  }
  return next;
}

export function addDesignationStage(
  workflow: WorkflowDefinition,
  options: {
    designationCode: string;
    stageKind?: WorkflowStage['stage_kind'];
    labelEn?: string;
    allowedVerbs?: string[];
  },
): { workflow: WorkflowDefinition; stageCode: string } {
  const code = slugify(options.designationCode.replace(/_/g, '-'), 'review-stage');
  const stage = designationStage(
    code,
    options.designationCode,
    options.labelEn ?? options.designationCode.replace(/_/g, ' '),
    options.stageKind ?? 'maker',
    options.allowedVerbs ?? ['forward', 'return'],
  );
  return { workflow: upsertStage(workflow, stage), stageCode: code };
}

export function defaultAllowedVerbsForDesignation(
  designationCode: string,
  flags: { is_department_head?: boolean; can_reject_municipal?: boolean },
): string[] {
  if (flags.can_reject_municipal) {
    return ['forward', 'return', 'reject'];
  }
  if (flags.is_department_head) {
    return ['forward', 'return', 'reject'];
  }
  if (designationCode.startsWith('hoarding_')) {
    return ['forward', 'return', 'return-for-correction'];
  }
  return ['forward', 'return'];
}
