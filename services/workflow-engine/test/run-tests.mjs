import assert from 'node:assert/strict';
import { test } from 'node:test';

import { effectIdempotencyKey, executeEffectOnce, reconcileDueStages } from '../dist/index.js';

test('deduplicates side effects by tenant application transition and effect type', () => {
  const store = new Set();
  const job = {
    tenant_id: 'tenant-a',
    application_id: 'app-1',
    transition_id: 'transition-1',
    effect_type: 'notify',
  };

  assert.equal(effectIdempotencyKey(job), 'tenant-a:app-1:transition-1:notify');
  assert.deepEqual(executeEffectOnce(job, store), {
    executed: true,
    key: 'tenant-a:app-1:transition-1:notify',
  });
  assert.deepEqual(executeEffectOnce(job, store), {
    executed: false,
    key: 'tenant-a:app-1:transition-1:notify',
  });
});

test('reconciles overdue SLA stages only once', () => {
  const jobs = reconcileDueStages(new Date('2026-05-07T12:00:00.000Z'), [
    {
      tenant_id: 'tenant-a',
      application_id: 'app-1',
      stage_code: 'document-verification',
      due_at: '2026-05-07T11:00:00.000Z',
      escalated: false,
    },
    {
      tenant_id: 'tenant-a',
      application_id: 'app-2',
      stage_code: 'submitted',
      due_at: '2026-05-07T13:00:00.000Z',
      escalated: false,
    },
    {
      tenant_id: 'tenant-a',
      application_id: 'app-3',
      stage_code: 'submitted',
      due_at: '2026-05-07T10:00:00.000Z',
      escalated: true,
    },
  ]);

  assert.deepEqual(jobs, [
    {
      tenant_id: 'tenant-a',
      application_id: 'app-1',
      stage_code: 'document-verification',
      due_at: '2026-05-07T11:00:00.000Z',
    },
  ]);
});
