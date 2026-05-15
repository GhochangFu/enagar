import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';

import {
  assertValidWorkflowDefinition,
  calculateSlaDueAt,
  certificateIssuanceWorkflow,
  createLinearWorkflowDraft,
  evaluateTransition,
  getInitialStage,
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
