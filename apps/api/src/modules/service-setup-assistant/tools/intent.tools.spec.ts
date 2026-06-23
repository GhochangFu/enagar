import { IntentTools } from './intent.tools';

describe('IntentTools', () => {
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
      scope: 'full' as const,
      current_step: 1 as const,
      archetype: null,
      step_completion: {},
      status: 'active' as const,
    },
    tenantId: 'tenant-1',
    serviceId: 'svc-1',
    step: 1 as const,
    scope: 'full' as const,
  };

  it('detectArchetype persists to session without patching designer', async () => {
    const prisma = {
      serviceSetupSession: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({
        service: { code: 'birth-cert' },
        workflow_pattern: 'cert-issuance',
        global_form_template: null,
      }),
      saveFormDraft: jest.fn(),
      patchServiceConfig: jest.fn(),
    };
    const tools = new IntentTools(adminTenant as never, prisma as never);
    const detect = tools.definitions().find((tool) => tool.name === 'detectArchetype')!;

    const result = await detect.execute(baseCtx, {
      description: 'Birth certificate issuance with upfront fee',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expect.objectContaining({ archetype: 'certificate' }));
    expect(prisma.serviceSetupSession.update).toHaveBeenCalledWith({
      where: { id: 'sess-1' },
      data: { archetype: 'certificate' },
    });
    expect(adminTenant.saveFormDraft).not.toHaveBeenCalled();
    expect(adminTenant.patchServiceConfig).not.toHaveBeenCalled();
  });

  it('summarizeRequirements writes requirements_json to session', async () => {
    const prisma = {
      serviceSetupSession: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const tools = new IntentTools({} as never, prisma as never);
    const summarize = tools.definitions().find((tool) => tool.name === 'summarizeRequirements')!;

    const summary = { purpose: 'Birth registration', payment_timing: 'upfront' };
    const result = await summarize.execute(baseCtx, { summary });

    expect(result.success).toBe(true);
    expect(prisma.serviceSetupSession.update).toHaveBeenCalledWith({
      where: { id: 'sess-1' },
      data: { requirementsJson: summary },
    });
  });
});
