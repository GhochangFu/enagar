import { createLinearWorkflowDraft } from '@enagar/workflow';

import { TenantWorkflowTools } from './tenant-workflow.tools';

describe('TenantWorkflowTools', () => {
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
      scope: 'workflow' as const,
      current_step: 3 as const,
      archetype: null,
      step_completion: {},
      status: 'active' as const,
    },
    tenantId: 'tenant-1',
    serviceId: 'svc-1',
    step: 3 as const,
    scope: 'workflow' as const,
  };

  it('applyWorkflowTemplate saves linear_approval draft', async () => {
    const schema = createLinearWorkflowDraft('trade-licence', 1);
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({
        service: { code: 'trade-licence', name: { en: 'Trade licence' } },
        workflow_pattern: 'cert-issuance',
        workflow_draft: null,
      }),
      saveWorkflowDraft: jest.fn().mockResolvedValue({
        definition: schema,
        version: 1,
      }),
    };
    const tools = new TenantWorkflowTools(adminTenant as never);
    const applyTemplate = tools
      .definitions()
      .find((tool) => tool.name === 'applyWorkflowTemplate')!;

    const result = await applyTemplate.execute(baseCtx, { template_id: 'linear_approval' });

    expect(result.success).toBe(true);
    expect(result.draftUpdated).toBe('workflow');
    expect(adminTenant.saveWorkflowDraft).toHaveBeenCalledTimes(1);
    const saved = adminTenant.saveWorkflowDraft.mock.calls[0]![2] as {
      workflow: { code: string };
    };
    expect(saved.workflow.code).toBe('trade-licence-workflow-v1');
  });

  it('mergeWorkflowDraft rejects invalid workflow', async () => {
    const base = createLinearWorkflowDraft('trade-licence', 1);
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({
        service: { code: 'trade-licence', name: { en: 'Trade licence' } },
        workflow_pattern: 'cert-issuance',
        workflow_draft: { definition: base, version: 1 },
      }),
      saveWorkflowDraft: jest.fn(),
    };
    const tools = new TenantWorkflowTools(adminTenant as never);
    const merge = tools.definitions().find((tool) => tool.name === 'mergeWorkflowDraft')!;

    const result = await merge.execute(baseCtx, {
      workflow: { code: 'bad', version: 0, stages: [], transitions: [] },
    });

    expect(result.success).toBe(false);
    expect(adminTenant.saveWorkflowDraft).not.toHaveBeenCalled();
  });

  it('mergeWorkflowDraft accepts flat LLM stage shorthand', async () => {
    const base = createLinearWorkflowDraft('trade-licence', 1);
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({
        service: { code: 'trade-licence', name: { en: 'Trade licence' } },
        workflow_pattern: 'cert-issuance',
        workflow_draft: { definition: base, version: 1 },
      }),
      saveWorkflowDraft: jest.fn().mockResolvedValue({
        definition: base,
        version: 1,
      }),
    };
    const tools = new TenantWorkflowTools(adminTenant as never);
    const merge = tools.definitions().find((tool) => tool.name === 'mergeWorkflowDraft')!;

    const result = await merge.execute(baseCtx, {
      stage_code: 'tenant-verification',
      stage_name: 'Tenant Admin Verification',
      stage_type: 'tenant_admin',
      insert_before: 'approved',
    });

    expect(result.success).toBe(true);
    expect(adminTenant.saveWorkflowDraft).toHaveBeenCalledTimes(1);
    const saved = adminTenant.saveWorkflowDraft.mock.calls[0]![2] as {
      workflow: { stages: Array<{ code: string }> };
    };
    expect(saved.workflow.stages.map((stage) => stage.code)).toContain('tenant-verification');
  });

  it('mergeWorkflowDraft removes stage via remove_stage_code', async () => {
    const base = createLinearWorkflowDraft('trade-licence', 1);
    const withVerification = {
      ...base,
      stages: [
        ...base.stages.slice(0, 2),
        {
          code: 'tenant-verification',
          label: { en: 'Tenant Admin Verification', bn: 'x', hi: 'x' },
          owner_role: 'tenant_admin' as const,
        },
        ...base.stages.slice(2),
      ],
      transitions: [
        {
          from: 'submitted',
          to: 'tenant-verification',
          verb: 'verify',
          actor_role: 'tenant_clerk',
        },
        {
          from: 'tenant-verification',
          to: 'approved',
          verb: 'forward',
          actor_role: 'tenant_admin',
        },
        { from: 'approved', to: 'closed', verb: 'approve', actor_role: 'tenant_admin' },
      ],
    };
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({
        service: { code: 'trade-licence', name: { en: 'Trade licence' } },
        workflow_pattern: 'cert-issuance',
        workflow_draft: { definition: withVerification, version: 1 },
      }),
      saveWorkflowDraft: jest.fn().mockResolvedValue({
        definition: base,
        version: 1,
      }),
    };
    const tools = new TenantWorkflowTools(adminTenant as never);
    const merge = tools.definitions().find((tool) => tool.name === 'mergeWorkflowDraft')!;

    const result = await merge.execute(baseCtx, { remove_stage_code: 'tenant-verification' });

    expect(result.success).toBe(true);
    const saved = adminTenant.saveWorkflowDraft.mock.calls[0]![2] as {
      workflow: {
        stages: Array<{ code: string }>;
        transitions: Array<{ to: string; from: string }>;
      };
    };
    expect(saved.workflow.stages.map((stage) => stage.code)).not.toContain('tenant-verification');
    expect(
      saved.workflow.transitions.some((t) => t.from === 'submitted' && t.to === 'approved'),
    ).toBe(true);
  });

  it('mergeWorkflowDraft returns clear error for remove when stage missing', async () => {
    const base = createLinearWorkflowDraft('trade-licence', 1);
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({
        service: { code: 'trade-licence', name: { en: 'Trade licence' } },
        workflow_pattern: 'cert-issuance',
        workflow_draft: { definition: base, version: 1 },
      }),
      saveWorkflowDraft: jest.fn(),
    };
    const tools = new TenantWorkflowTools(adminTenant as never);
    const merge = tools.definitions().find((tool) => tool.name === 'mergeWorkflowDraft')!;

    const result = await merge.execute(baseCtx, { remove_stage_code: 'tenant-verification' });

    expect(result.success).toBe(false);
    expect(result.summary).toContain('Stage not found');
    expect(result.summary).not.toBe('workflow must be an object');
    expect(adminTenant.saveWorkflowDraft).not.toHaveBeenCalled();
  });
});
