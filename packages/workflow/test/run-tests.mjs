import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';

import {
  applyBocPolicyToSnapshot,
  assertRequireBocAllowed,
  assertValidWorkflowDefinition,
  calculateSlaDueAt,
  certificateIssuanceWorkflow,
  createLinearWorkflowDraft,
  evaluateTransition,
  evaluateTransitionGuard,
  paymentLinkTransitionPermitted,
  POST_APPROVAL_PAYMENT_CONFIRMED_VERB,
  transitionIncludesPaymentLinkEffect,
  getInitialStage,
  mergeOfficerRequireBoc,
  parseBocPolicy,
  applyMunicipalSignoffPolicyToSnapshot,
  readMunicipalSignoffPolicy,
  readMunicipalSignoffThresholdPaise,
  resolveMunicipalSignoffRequired,
  pendingActorFromWorkflowStage,
  transitionActorAllowed,
  validateWorkflowDefinition,
} from '../dist/index.js';

test('evaluates a valid role-owned transition', () => {
  const result = evaluateTransition({
    workflow: certificateIssuanceWorkflow,
    current_stage: 'submitted',
    verb: 'start-verification',
    actor_roles: ['tenant_clerk'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.ok ? result.to.code : undefined, 'document-verification');
});

test('creates a valid tenant-admin linear workflow draft', () => {
  const draft = createLinearWorkflowDraft('pet-licence', 2);

  assert.equal(draft.code, 'pet-licence-workflow-v2');
  assert.equal(validateWorkflowDefinition(draft).ok, true);
  assert.equal(assertValidWorkflowDefinition(draft), draft);
});

test('rejects invalid workflow definitions before publishing', () => {
  const invalid = {
    ...certificateIssuanceWorkflow,
    stages: certificateIssuanceWorkflow.stages.map((stage) => ({
      ...stage,
      initial: false,
    })),
    transitions: [
      ...certificateIssuanceWorkflow.transitions,
      { from: 'missing', to: 'issued', verb: '', actor_role: '' },
    ],
  };

  const result = validateWorkflowDefinition(invalid);

  assert.equal(result.ok, false);
  assert.match(
    result.issues.map((entry) => `${entry.path}:${entry.message}`).join('\n'),
    /exactly one initial stage|unknown stage|verb is required/,
  );
});

test('rejects wrong-role and terminal-stage transitions', () => {
  assert.deepEqual(
    evaluateTransition({
      workflow: certificateIssuanceWorkflow,
      current_stage: 'submitted',
      verb: 'start-verification',
      actor_roles: ['citizen'],
    }),
    { ok: false, reason: 'ROLE_NOT_ALLOWED' },
  );
  assert.deepEqual(
    evaluateTransition({
      workflow: certificateIssuanceWorkflow,
      current_stage: 'issued',
      verb: 'approve',
      actor_roles: ['tenant_admin'],
    }),
    { ok: false, reason: 'TERMINAL_STAGE' },
  );
});

test('requires comments for rejection transitions', () => {
  assert.deepEqual(
    evaluateTransition({
      workflow: certificateIssuanceWorkflow,
      current_stage: 'document-verification',
      verb: 'reject',
      actor_roles: ['tenant_admin'],
    }),
    { ok: false, reason: 'COMMENT_REQUIRED' },
  );
});

test('finds initial stage and calculates SLA due dates', () => {
  const initial = getInitialStage(certificateIssuanceWorkflow);
  const submittedAt = new Date('2026-05-07T00:00:00.000Z');

  assert.equal(initial.code, 'submitted');
  assert.equal(
    calculateSlaDueAt(submittedAt, initial.sla_hours)?.toISOString(),
    '2026-05-08T00:00:00.000Z',
  );
});

test('allows designation-owned transitions when actor_designations match', () => {
  const workflow = {
    code: 'hoarding-v1',
    version: 1,
    stages: [
      {
        code: 'maker-review',
        label: { en: 'Maker', bn: 'Maker', hi: 'Maker' },
        owner_role: 'tenant_clerk',
        owner_designation: 'hoarding_clerk',
        stage_kind: 'maker',
        allowed_verbs: ['forward', 'return'],
        initial: true,
      },
      {
        code: 'checker-review',
        label: { en: 'Checker', bn: 'Checker', hi: 'Checker' },
        owner_role: 'tenant_clerk',
        owner_designation: 'hoarding_inspector',
        terminal: true,
      },
    ],
    transitions: [
      {
        from: 'maker-review',
        to: 'checker-review',
        verb: 'forward',
        actor_role: 'tenant_clerk',
        actor_designation: 'hoarding_clerk',
      },
    ],
  };

  assert.equal(
    transitionActorAllowed(workflow.transitions[0], ['tenant_admin'], ['hoarding_clerk']),
    true,
  );
  assert.equal(transitionActorAllowed(workflow.transitions[0], ['tenant_clerk'], []), false);

  const result = evaluateTransition({
    workflow,
    current_stage: 'maker-review',
    verb: 'forward',
    actor_roles: ['tenant_clerk'],
    actor_designations: ['hoarding_clerk'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.ok ? result.to.owner_designation : undefined, 'hoarding_inspector');
  assert.deepEqual(pendingActorFromWorkflowStage(result.ok ? result.to : {}), {
    pending_designation: 'hoarding_inspector',
    pending_role: null,
  });
});

test('blocks transitions when guards fail', () => {
  const workflow = {
    code: 'boc-branch-v1',
    version: 1,
    stages: [
      {
        code: 'scrutiny',
        label: { en: 'Scrutiny', bn: 'Scrutiny', hi: 'Scrutiny' },
        owner_role: 'tenant_clerk',
        initial: true,
      },
      {
        code: 'boc',
        label: { en: 'BOC', bn: 'BOC', hi: 'BOC' },
        owner_role: 'tenant_admin',
        terminal: true,
      },
    ],
    transitions: [
      {
        from: 'scrutiny',
        to: 'boc',
        verb: 'route-to-boc',
        actor_role: 'tenant_clerk',
        guard: { type: 'boc_required' },
      },
    ],
  };

  assert.equal(
    evaluateTransitionGuard({ type: 'boc_required' }, { requires_boc_resolution: true }),
    true,
  );
  assert.equal(evaluateTransitionGuard({ type: 'boc_required' }, {}), false);

  assert.deepEqual(
    evaluateTransition({
      workflow,
      current_stage: 'scrutiny',
      verb: 'route-to-boc',
      actor_roles: ['tenant_clerk'],
      runtime_snapshot: {},
    }),
    { ok: false, reason: 'GUARD_BLOCKED' },
  );
});

test('rejects dept-head reject without is_department_head capability', () => {
  const workflow = {
    code: 'pwd-v1',
    version: 1,
    stages: [
      {
        code: 'dept-head-review',
        label: { en: 'Head', bn: 'Head', hi: 'Head' },
        owner_role: 'tenant_admin',
        owner_designation: 'pwd_executive_engineer',
        stage_kind: 'dept_head',
        initial: true,
      },
      {
        code: 'rejected',
        label: { en: 'Rejected', bn: 'Rejected', hi: 'Rejected' },
        owner_role: 'citizen',
        terminal: true,
      },
    ],
    transitions: [
      {
        from: 'dept-head-review',
        to: 'rejected',
        verb: 'reject',
        actor_role: 'tenant_admin',
        actor_designation: 'pwd_executive_engineer',
        requires_comment: true,
      },
    ],
  };

  assert.deepEqual(
    evaluateTransition({
      workflow,
      current_stage: 'dept-head-review',
      verb: 'reject',
      actor_roles: ['tenant_admin'],
      actor_designations: ['pwd_executive_engineer'],
      designation_capabilities: [{ code: 'pwd_executive_engineer', is_department_head: false }],
      comment: 'Incomplete file',
    }),
    { ok: false, reason: 'REJECT_NOT_PERMITTED' },
  );

  const allowed = evaluateTransition({
    workflow,
    current_stage: 'dept-head-review',
    verb: 'reject',
    actor_roles: ['tenant_admin'],
    actor_designations: ['pwd_executive_engineer'],
    designation_capabilities: [{ code: 'pwd_executive_engineer', is_department_head: true }],
    comment: 'Incomplete file',
  });
  assert.equal(allowed.ok, true);
});

test('blocks clerk reject on maker stage when designation capabilities are set', () => {
  const workflow = {
    code: 'hoarding-reject-v1',
    version: 1,
    stages: [
      {
        code: 'maker-review',
        label: { en: 'Maker', bn: 'Maker', hi: 'Maker' },
        owner_role: 'tenant_clerk',
        owner_designation: 'hoarding_clerk',
        stage_kind: 'maker',
        allowed_verbs: ['forward', 'return', 'reject'],
        initial: true,
      },
      {
        code: 'rejected',
        label: { en: 'Rejected', bn: 'Rejected', hi: 'Rejected' },
        owner_role: 'citizen',
        terminal: true,
      },
    ],
    transitions: [
      {
        from: 'maker-review',
        to: 'rejected',
        verb: 'reject',
        actor_role: 'tenant_clerk',
        actor_designation: 'hoarding_clerk',
      },
    ],
  };

  assert.deepEqual(
    evaluateTransition({
      workflow,
      current_stage: 'maker-review',
      verb: 'reject',
      actor_roles: ['tenant_clerk'],
      actor_designations: ['hoarding_clerk'],
      designation_capabilities: [{ code: 'hoarding_clerk' }],
      comment: 'Should not allow',
    }),
    { ok: false, reason: 'REJECT_NOT_PERMITTED' },
  );
});

test('allows chairperson reject only at chairperson-approval', () => {
  const workflow = {
    code: 'municipal-reject-v1',
    version: 1,
    stages: [
      {
        code: 'eo-approval',
        label: { en: 'EO', bn: 'EO', hi: 'EO' },
        owner_role: 'tenant_admin',
        owner_designation: 'executive_officer',
        stage_kind: 'municipality',
        allowed_verbs: ['forward', 'return', 'reject'],
        initial: true,
      },
      {
        code: 'chairperson-approval',
        label: { en: 'Chair', bn: 'Chair', hi: 'Chair' },
        owner_role: 'tenant_admin',
        owner_designation: 'chairperson',
        stage_kind: 'municipality',
        allowed_verbs: ['forward', 'return', 'reject'],
      },
      {
        code: 'rejected',
        label: { en: 'Rejected', bn: 'Rejected', hi: 'Rejected' },
        owner_role: 'citizen',
        terminal: true,
      },
    ],
    transitions: [
      {
        from: 'eo-approval',
        to: 'rejected',
        verb: 'reject',
        actor_role: 'tenant_admin',
        actor_designation: 'chairperson',
      },
      {
        from: 'chairperson-approval',
        to: 'rejected',
        verb: 'reject',
        actor_role: 'tenant_admin',
        actor_designation: 'chairperson',
      },
    ],
  };

  assert.deepEqual(
    evaluateTransition({
      workflow,
      current_stage: 'eo-approval',
      verb: 'reject',
      actor_roles: ['tenant_admin'],
      actor_designations: ['chairperson'],
      designation_capabilities: [{ code: 'chairperson', can_reject_municipal: true }],
      comment: 'Not at EO',
    }),
    { ok: false, reason: 'REJECT_NOT_PERMITTED' },
  );

  const allowed = evaluateTransition({
    workflow,
    current_stage: 'chairperson-approval',
    verb: 'reject',
    actor_roles: ['tenant_admin'],
    actor_designations: ['chairperson'],
    designation_capabilities: [{ code: 'chairperson', can_reject_municipal: true }],
    comment: 'Policy breach',
  });
  assert.equal(allowed.ok, true);
});

test('internal return walks back one internal stage', () => {
  const workflow = {
    code: 'return-chain-v1',
    version: 1,
    stages: [
      {
        code: 'maker-review',
        label: { en: 'Maker', bn: 'Maker', hi: 'Maker' },
        owner_role: 'tenant_clerk',
        owner_designation: 'hoarding_clerk',
        stage_kind: 'maker',
        initial: true,
      },
      {
        code: 'checker-review',
        label: { en: 'Checker', bn: 'Checker', hi: 'Checker' },
        owner_role: 'tenant_clerk',
        owner_designation: 'hoarding_inspector',
        stage_kind: 'checker',
      },
    ],
    transitions: [
      {
        from: 'checker-review',
        to: 'maker-review',
        verb: 'return',
        actor_role: 'tenant_clerk',
        actor_designation: 'hoarding_inspector',
      },
    ],
  };

  const back = evaluateTransition({
    workflow,
    current_stage: 'checker-review',
    verb: 'return',
    actor_roles: ['tenant_clerk'],
    actor_designations: ['hoarding_inspector'],
    designation_capabilities: [{ code: 'hoarding_inspector' }],
  });
  assert.equal(back.ok, true);
  assert.equal(back.ok ? back.to.code : undefined, 'maker-review');
});

test('blocks return verb to citizen-owned stage; return-for-correction allowed', () => {
  const workflow = {
    code: 'return-citizen-v1',
    version: 1,
    stages: [
      {
        code: 'checker-review',
        label: { en: 'Checker', bn: 'Checker', hi: 'Checker' },
        owner_role: 'tenant_clerk',
        owner_designation: 'hoarding_inspector',
        stage_kind: 'checker',
        initial: true,
      },
      {
        code: 'submitted',
        label: { en: 'Submitted', bn: 'Submitted', hi: 'Submitted' },
        owner_role: 'citizen',
        stage_kind: 'citizen',
      },
    ],
    transitions: [
      {
        from: 'checker-review',
        to: 'submitted',
        verb: 'return',
        actor_role: 'tenant_clerk',
        actor_designation: 'hoarding_inspector',
      },
      {
        from: 'checker-review',
        to: 'submitted',
        verb: 'return-for-correction',
        actor_role: 'tenant_clerk',
        actor_designation: 'hoarding_inspector',
      },
    ],
  };

  assert.deepEqual(
    evaluateTransition({
      workflow,
      current_stage: 'checker-review',
      verb: 'return',
      actor_roles: ['tenant_clerk'],
      actor_designations: ['hoarding_inspector'],
      designation_capabilities: [{ code: 'hoarding_inspector' }],
    }),
    { ok: false, reason: 'RETURN_TARGET_NOT_ALLOWED' },
  );

  const correction = evaluateTransition({
    workflow,
    current_stage: 'checker-review',
    verb: 'return-for-correction',
    actor_roles: ['tenant_clerk'],
    actor_designations: ['hoarding_inspector'],
    designation_capabilities: [{ code: 'hoarding_inspector' }],
  });
  assert.equal(correction.ok, true);
  assert.equal(correction.ok ? correction.to.code : undefined, 'submitted');
});

test('reject requires comment even when transition omits requires_comment', () => {
  const workflow = {
    code: 'reject-comment-v1',
    version: 1,
    stages: [
      {
        code: 'dept-head-review',
        label: { en: 'Head', bn: 'Head', hi: 'Head' },
        owner_role: 'tenant_admin',
        owner_designation: 'pwd_executive_engineer',
        stage_kind: 'dept_head',
        initial: true,
      },
      {
        code: 'rejected',
        label: { en: 'Rejected', bn: 'Rejected', hi: 'Rejected' },
        owner_role: 'citizen',
        terminal: true,
      },
    ],
    transitions: [
      {
        from: 'dept-head-review',
        to: 'rejected',
        verb: 'reject',
        actor_role: 'tenant_admin',
        actor_designation: 'pwd_executive_engineer',
      },
    ],
  };

  assert.deepEqual(
    evaluateTransition({
      workflow,
      current_stage: 'dept-head-review',
      verb: 'reject',
      actor_roles: ['tenant_admin'],
      actor_designations: ['pwd_executive_engineer'],
      designation_capabilities: [{ code: 'pwd_executive_engineer', is_department_head: true }],
    }),
    { ok: false, reason: 'COMMENT_REQUIRED' },
  );
});

test('boc policy branches never / always / officer_may_require', () => {
  assert.equal(parseBocPolicy({ boc_policy: 'always' }), 'always');
  assert.equal(parseBocPolicy({}), 'never');

  assert.equal(applyBocPolicyToSnapshot('always', {}).requires_boc_resolution, true);
  assert.equal(
    applyBocPolicyToSnapshot('never', { requires_boc_resolution: true }).requires_boc_resolution,
    false,
  );

  const officerSet = mergeOfficerRequireBoc('officer_may_require', {}, true, 'technical-scrutiny');
  assert.equal(officerSet.requires_boc_resolution, true);

  assert.throws(() => {
    assertRequireBocAllowed('never', true);
  });
});

test('municipal signoff policy never / always / high_value_only', () => {
  assert.equal(readMunicipalSignoffPolicy({ municipal_signoff_policy: 'always' }), 'always');
  assert.equal(readMunicipalSignoffPolicy({}), 'high_value_only');
  assert.equal(readMunicipalSignoffThresholdPaise({ municipal_signoff_threshold_paise: 100 }), 100);

  assert.equal(
    resolveMunicipalSignoffRequired('never', { computed_fee_paise: 99_999_999 }, 50_000_000),
    false,
  );
  assert.equal(resolveMunicipalSignoffRequired('always', {}, 50_000_000), true);
  assert.equal(
    resolveMunicipalSignoffRequired(
      'high_value_only',
      { computed_fee_paise: 50_000_000 },
      50_000_000,
    ),
    true,
  );
  assert.equal(
    resolveMunicipalSignoffRequired('high_value_only', { computed_fee_paise: 1_000 }, 50_000_000),
    false,
  );
  assert.equal(
    resolveMunicipalSignoffRequired(
      'high_value_only',
      { requires_municipal_signoff: true },
      50_000_000,
    ),
    true,
  );

  const low = applyMunicipalSignoffPolicyToSnapshot(
    'high_value_only',
    { computed_fee_paise: 100 },
    {
      thresholdPaise: 50_000_000,
    },
  );
  assert.equal(low.municipal_signoff_required, false);

  const high = applyMunicipalSignoffPolicyToSnapshot(
    'high_value_only',
    { computed_fee_paise: 60_000_000 },
    {
      thresholdPaise: 50_000_000,
    },
  );
  assert.equal(high.municipal_signoff_required, true);
});

test('municipal guarded forward picks ladder or skip transition', () => {
  const workflow = {
    code: 'pwd-muni-v1',
    version: 1,
    stages: [
      {
        code: 'dept-head-review',
        label: { en: 'Head', bn: 'Head', hi: 'Head' },
        owner_role: 'tenant_admin',
        owner_designation: 'pwd_executive_engineer',
        stage_kind: 'dept_head',
        initial: true,
        allowed_verbs: ['forward'],
      },
      {
        code: 'eo-approval',
        label: { en: 'EO', bn: 'EO', hi: 'EO' },
        owner_role: 'tenant_admin',
        owner_designation: 'executive_officer',
        stage_kind: 'municipality',
      },
      {
        code: 'dept-head-final',
        label: { en: 'Final', bn: 'Final', hi: 'Final' },
        owner_role: 'tenant_admin',
        owner_designation: 'pwd_executive_engineer',
        stage_kind: 'dept_head',
      },
    ],
    transitions: [
      {
        from: 'dept-head-review',
        to: 'eo-approval',
        verb: 'forward',
        actor_role: 'tenant_admin',
        actor_designation: 'pwd_executive_engineer',
        guard: { type: 'municipal_signoff_required' },
      },
      {
        from: 'dept-head-review',
        to: 'dept-head-final',
        verb: 'forward',
        actor_role: 'tenant_admin',
        actor_designation: 'pwd_executive_engineer',
        guard: { type: 'municipal_signoff_not_required' },
      },
    ],
  };

  const toLadder = evaluateTransition({
    workflow,
    current_stage: 'dept-head-review',
    verb: 'forward',
    actor_roles: ['tenant_admin'],
    actor_designations: ['pwd_executive_engineer'],
    designation_capabilities: [{ code: 'pwd_executive_engineer', is_department_head: true }],
    runtime_snapshot: { municipal_signoff_required: true, high_value: true },
  });
  assert.equal(toLadder.ok, true);
  assert.equal(toLadder.ok ? toLadder.to.code : undefined, 'eo-approval');

  const toSkip = evaluateTransition({
    workflow,
    current_stage: 'dept-head-review',
    verb: 'forward',
    actor_roles: ['tenant_admin'],
    actor_designations: ['pwd_executive_engineer'],
    designation_capabilities: [{ code: 'pwd_executive_engineer', is_department_head: true }],
    runtime_snapshot: { municipal_signoff_required: false, high_value: false },
  });
  assert.equal(toSkip.ok, true);
  assert.equal(toSkip.ok ? toSkip.to.code : undefined, 'dept-head-final');

  assert.equal(
    evaluateTransitionGuard(
      { type: 'municipal_signoff_not_required' },
      { municipal_signoff_required: false },
    ),
    true,
  );
});

test('payment_paid guard and confirm-payment system transition', () => {
  assert.equal(evaluateTransitionGuard({ type: 'payment_paid' }, { payment_status: 'paid' }), true);
  assert.equal(
    evaluateTransitionGuard({ type: 'payment_paid' }, { payment_status: 'not_required' }),
    true,
  );
  assert.equal(
    evaluateTransitionGuard({ type: 'payment_paid' }, { payment_status: 'pending' }),
    false,
  );

  const workflow = {
    code: 'post-approval-v1',
    version: 1,
    stages: [
      {
        code: 'payment-pending',
        label: { en: 'Pay', bn: 'Pay', hi: 'Pay' },
        owner_role: 'tenant_clerk',
        owner_designation: 'pwd_executive_engineer',
        stage_kind: 'post_approval',
        initial: true,
      },
      {
        code: 'payment-received',
        label: { en: 'Received', bn: 'Received', hi: 'Received' },
        owner_role: 'system',
        stage_kind: 'system',
      },
    ],
    transitions: [
      {
        from: 'payment-pending',
        to: 'payment-received',
        verb: POST_APPROVAL_PAYMENT_CONFIRMED_VERB,
        actor_role: 'system',
        guard: { type: 'payment_paid' },
      },
    ],
  };

  const blocked = evaluateTransition({
    workflow,
    current_stage: 'payment-pending',
    verb: POST_APPROVAL_PAYMENT_CONFIRMED_VERB,
    actor_roles: ['system'],
    runtime_snapshot: { payment_status: 'pending' },
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.ok ? undefined : blocked.reason, 'GUARD_BLOCKED');

  const ok = evaluateTransition({
    workflow,
    current_stage: 'payment-pending',
    verb: POST_APPROVAL_PAYMENT_CONFIRMED_VERB,
    actor_roles: ['system'],
    runtime_snapshot: { payment_status: 'paid' },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.ok ? ok.to.code : undefined, 'payment-received');
});

test('payment_paid guard with fee_code checks fee_settlement line', () => {
  assert.equal(
    evaluateTransitionGuard(
      { type: 'payment_paid', fee_code: 'approval' },
      {
        payment_status: 'not_required',
        fee_settlement: { approval: { status: 'paid' } },
      },
    ),
    true,
  );
  assert.equal(
    evaluateTransitionGuard(
      { type: 'payment_paid', fee_code: 'approval' },
      {
        payment_status: 'not_required',
        fee_settlement: { approval: { status: 'pending' } },
      },
    ),
    false,
  );
  assert.equal(
    evaluateTransitionGuard(
      { type: 'payment_paid' },
      {
        payment_status: 'not_required',
        payment_schedule: 'upfront_and_deferred',
        fee_settlement: {
          application: { status: 'paid' },
          approval: { status: 'paid' },
        },
      },
    ),
    true,
  );
});

test('approval_fee_paid guard allows upfront_only without approval line', () => {
  assert.equal(
    evaluateTransitionGuard(
      { type: 'approval_fee_paid' },
      { payment_schedule: 'upfront_only', payment_status: 'not_required' },
    ),
    true,
  );
});

test('approval_fee_paid guard requires approval line paid for deferred schedules', () => {
  assert.equal(
    evaluateTransitionGuard(
      { type: 'approval_fee_paid' },
      {
        payment_schedule: 'deferred_only',
        fee_settlement: { approval: { status: 'paid' } },
      },
    ),
    true,
  );
  assert.equal(
    evaluateTransitionGuard(
      { type: 'approval_fee_paid' },
      {
        payment_schedule: 'deferred_only',
        fee_settlement: { approval: { status: 'not_required' } },
      },
    ),
    false,
  );
});

test('generate_payment_link transition requires department head capability', () => {
  const transition = {
    from: 'dept-head-final',
    to: 'payment-pending',
    verb: 'forward',
    actor_role: 'tenant_clerk',
    actor_designation: 'pwd_executive_engineer',
    effects: [{ type: 'generate_payment_link' }],
  };
  assert.equal(transitionIncludesPaymentLinkEffect(transition), true);
  assert.equal(
    paymentLinkTransitionPermitted(
      transition,
      ['pwd_executive_engineer'],
      [{ code: 'pwd_executive_engineer', is_department_head: false }],
    ),
    false,
  );
  assert.equal(
    paymentLinkTransitionPermitted(
      transition,
      ['pwd_executive_engineer'],
      [{ code: 'pwd_executive_engineer', is_department_head: true }],
    ),
    true,
  );

  const workflow = {
    code: 'pay-link-v1',
    version: 1,
    stages: [
      {
        code: 'dept-head-final',
        label: { en: 'Final', bn: 'Final', hi: 'Final' },
        owner_role: 'tenant_clerk',
        owner_designation: 'pwd_executive_engineer',
        stage_kind: 'dept_head',
        initial: true,
        allowed_verbs: ['forward'],
      },
      {
        code: 'payment-pending',
        label: { en: 'Pending', bn: 'Pending', hi: 'Pending' },
        owner_role: 'tenant_clerk',
        owner_designation: 'pwd_executive_engineer',
        stage_kind: 'post_approval',
      },
    ],
    transitions: [transition],
  };

  const denied = evaluateTransition({
    workflow,
    current_stage: 'dept-head-final',
    verb: 'forward',
    actor_roles: ['tenant_clerk'],
    actor_designations: ['pwd_executive_engineer'],
    designation_capabilities: [{ code: 'pwd_executive_engineer', is_department_head: false }],
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.ok ? undefined : denied.reason, 'PAYMENT_LINK_NOT_PERMITTED');

  const allowed = evaluateTransition({
    workflow,
    current_stage: 'dept-head-final',
    verb: 'forward',
    actor_roles: ['tenant_clerk'],
    actor_designations: ['pwd_executive_engineer'],
    designation_capabilities: [{ code: 'pwd_executive_engineer', is_department_head: true }],
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.ok ? allowed.to.code : undefined, 'payment-pending');
  assert.equal(
    allowed.ok && allowed.effects.some((effect) => effect.type === 'generate_payment_link'),
    true,
  );
});

test('evaluates workflow transitions within a local smoke budget', () => {
  const start = performance.now();

  for (let index = 0; index < 1_000; index += 1) {
    const result = evaluateTransition({
      workflow: certificateIssuanceWorkflow,
      current_stage: 'submitted',
      verb: 'start-verification',
      actor_roles: ['tenant_clerk'],
    });

    assert.equal(result.ok, true);
  }

  assert.ok(performance.now() - start < 100);
});
