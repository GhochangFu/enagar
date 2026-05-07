import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  calculateSlaDueAt,
  certificateIssuanceWorkflow,
  evaluateTransition,
  getInitialStage,
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
