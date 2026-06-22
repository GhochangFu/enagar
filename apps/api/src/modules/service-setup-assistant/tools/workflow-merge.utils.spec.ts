import { createLinearWorkflowDraft } from '@enagar/workflow';

import { bindWorkflowToService, mergeWorkflowDraft } from './workflow-merge.utils';

describe('workflow-merge.utils', () => {
  const serviceCode = 'trade-licence';

  it('binds workflow code to service prefix', () => {
    const bound = bindWorkflowToService(createLinearWorkflowDraft(serviceCode, 1), serviceCode, 1);
    expect(bound.code).toBe('trade-licence-workflow-v1');
  });

  it('mergeWorkflowDraft upserts stages and transitions', () => {
    const base = bindWorkflowToService(createLinearWorkflowDraft(serviceCode, 1), serviceCode, 1);
    const merged = mergeWorkflowDraft(base, {
      ...base,
      stages: [
        ...base.stages,
        {
          code: 'clerk-review',
          label: { en: 'Clerk review', bn: 'Clerk review', hi: 'Clerk review' },
          owner_role: 'tenant_clerk',
        },
      ],
      transitions: [
        ...base.transitions,
        {
          from: 'submitted',
          to: 'clerk-review',
          verb: 'forward',
          actor_role: 'tenant_clerk',
        },
        {
          from: 'clerk-review',
          to: 'approved',
          verb: 'forward',
          actor_role: 'tenant_clerk',
        },
      ],
    });

    expect(merged.stages.some((stage) => stage.code === 'clerk-review')).toBe(true);
    expect(merged.transitions.length).toBeGreaterThan(base.transitions.length);
    expect(merged.stages.find((stage) => stage.code === 'submitted')).toBeTruthy();
  });
});
