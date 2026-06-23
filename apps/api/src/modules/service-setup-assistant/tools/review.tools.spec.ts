jest.mock('../readiness-checklist.service', () => ({
  ReadinessChecklistService: jest.fn(),
}));

import { ReviewTools } from './review.tools';

describe('ReviewTools', () => {
  const principal = {
    subject: 'staff-1',
    tenantId: 'tenant-1',
    roles: ['tenant_admin'],
    expiresAt: new Date(),
  };

  const baseCtx = {
    principal,
    session: {
      id: 'sess-1',
      scope: 'review' as const,
      current_step: 5 as const,
      archetype: null,
      step_completion: {},
      status: 'active' as const,
    },
    tenantId: 'tenant-1',
    serviceId: 'svc-1',
    step: 5 as const,
    scope: 'review' as const,
  };

  it('explainBlockers returns human-readable messages for non-green items', async () => {
    const readiness = {
      forService: jest.fn().mockResolvedValue({
        ready_to_publish: false,
        items: [
          { key: 'form_draft_valid', label: 'Form draft is valid', status: 'green' },
          {
            key: 'config_complete',
            label: 'Service configuration is complete',
            status: 'amber',
            message: 'Fee rule, documents, or revenue head is incomplete',
          },
        ],
      }),
    };
    const tools = new ReviewTools(readiness as never, {} as never);
    const explain = tools.definitions().find((tool) => tool.name === 'explainBlockers')!;

    const result = await explain.execute(baseCtx, {});

    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({
        explanations: [
          'Warning — Service configuration is complete: Fee rule, documents, or revenue head is incomplete',
        ],
      }),
    );
  });

  it('getReadinessChecklist wraps readiness service', async () => {
    const checklist = { ready_to_publish: false, items: [] };
    const readiness = { forService: jest.fn().mockResolvedValue(checklist) };
    const tools = new ReviewTools(readiness as never, {} as never);
    const getChecklist = tools.definitions().find((tool) => tool.name === 'getReadinessChecklist')!;

    const result = await getChecklist.execute(baseCtx, {});

    expect(result.success).toBe(true);
    expect(result.data).toEqual(checklist);
    expect(readiness.forService).toHaveBeenCalledWith('tenant-1', 'svc-1');
  });
});
