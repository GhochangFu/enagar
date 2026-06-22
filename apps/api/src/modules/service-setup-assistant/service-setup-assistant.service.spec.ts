jest.mock('../admin-state/admin-state.service', () => ({
  AdminStateService: jest.fn(),
}));

import { ServiceSetupAssistantService } from './service-setup-assistant.service';

describe('ServiceSetupAssistantService', () => {
  const principal = {
    subject: 'staff-1',
    tenantId: 'tenant-1',
    tenantCode: 'kmc',
    roles: ['tenant_admin'],
    expiresAt: new Date(),
  };

  it('streams tokens and executes parsed tool calls', async () => {
    const toolCallsBlock = `\n\n\`\`\`json\n{"tool_calls":[{"name":"proposeFormFields","arguments":{"fields":[]}}]}\n\`\`\``;
    const prisma = {
      serviceSetupMessage: {
        create: jest.fn().mockResolvedValue({ id: 'assistant-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      serviceSetupAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const sessions = {
      assertSessionAccess: jest.fn().mockResolvedValue({ serviceId: 'svc-1', scope: 'form' }),
      getSession: jest.fn().mockResolvedValue({
        id: 'sess-1',
        scope: 'form',
        current_step: 2,
        archetype: null,
        step_completion: {},
        status: 'active',
      }),
      markStepComplete: jest.fn(),
    };
    const readiness = { forService: jest.fn().mockResolvedValue({ items: [] }) };
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({
        service: { code: 'SVC', name: { en: 'Test' } },
      }),
    };
    const llm = {
      prepareOutboundText: jest.fn().mockReturnValue({
        redactedUserText: 'add field',
        redactionCount: 0,
        restoreMap: {},
      }),
      streamForSetupAssistant: jest.fn(async function* (_req: { messages: unknown[] }) {
        yield { delta: 'Working on it', done: false };
        yield { delta: toolCallsBlock, done: false };
        yield { delta: '', done: true };
      }),
    };
    const tools = {
      formatToolsForPrompt: jest.fn().mockReturnValue('- proposeFormFields'),
      executeTool: jest.fn().mockResolvedValue({
        success: true,
        summary: 'Proposed fields',
      }),
    };

    const service = new ServiceSetupAssistantService(
      prisma as never,
      sessions as never,
      readiness as never,
      adminTenant as never,
      {} as never,
      llm as never,
      tools as never,
    );

    const events = [];
    for await (const event of service.streamTenantMessage(
      principal,
      'svc-1',
      'sess-1',
      'add field',
    )) {
      events.push(event);
    }

    expect(events.some((event) => event.type === 'meta')).toBe(true);
    expect(events.some((event) => event.type === 'token')).toBe(true);
    expect(events.some((event) => event.type === 'tool_result')).toBe(true);
    expect(events.some((event) => event.type === 'done')).toBe(true);
    expect(tools.executeTool).toHaveBeenCalledWith(
      'tenant',
      'proposeFormFields',
      expect.any(Object),
      { fields: [] },
    );
    expect(llm.streamForSetupAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'add field' }],
      }),
      expect.any(Object),
    );
  });

  it('does not duplicate the current user message in LLM history', async () => {
    const toolCallsBlock = `\n\n\`\`\`json\n{"tool_calls":[{"name":"proposeFormFields","arguments":{"fields":[]}}]}\n\`\`\``;
    const prisma = {
      serviceSetupMessage: {
        create: jest.fn().mockResolvedValue({ id: 'assistant-1' }),
        findMany: jest.fn().mockResolvedValue([
          { role: 'assistant', content: 'Added phone', createdAt: new Date(2) },
          { role: 'user', content: 'add phone', createdAt: new Date(1) },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      serviceSetupAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const sessions = {
      assertSessionAccess: jest.fn().mockResolvedValue({ serviceId: 'svc-1', scope: 'form' }),
      getSession: jest.fn().mockResolvedValue({
        id: 'sess-1',
        scope: 'form',
        current_step: 2,
        archetype: null,
        step_completion: {},
        status: 'active',
      }),
      markStepComplete: jest.fn(),
    };
    const readiness = { forService: jest.fn().mockResolvedValue({ items: [] }) };
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({
        service: { code: 'SVC', name: { en: 'Test' } },
        form_draft: {
          form_schema: {
            fields: [
              {
                id: 'contact_phone',
                label: { en: 'Contact phone', bn: 'x', hi: 'y' },
                type: 'text',
              },
            ],
          },
        },
      }),
    };
    const llm = {
      prepareOutboundText: jest.fn().mockReturnValue({
        redactedUserText: 'add email',
        redactionCount: 0,
        restoreMap: {},
      }),
      streamForSetupAssistant: jest.fn(async function* () {
        yield { delta: toolCallsBlock, done: false };
        yield { delta: '', done: true };
      }),
    };
    const tools = {
      formatToolsForPrompt: jest.fn().mockReturnValue('- proposeFormFields'),
      executeTool: jest.fn().mockResolvedValue({
        success: true,
        summary: 'Added field',
        draftUpdated: 'form',
      }),
    };

    const service = new ServiceSetupAssistantService(
      prisma as never,
      sessions as never,
      readiness as never,
      adminTenant as never,
      {} as never,
      llm as never,
      tools as never,
    );

    for await (const _event of service.streamTenantMessage(
      principal,
      'svc-1',
      'sess-1',
      'add email',
    )) {
      /* drain */
    }

    expect(llm.streamForSetupAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'user', content: 'add phone' },
          { role: 'assistant', content: 'Added phone' },
          { role: 'user', content: 'add email' },
        ],
      }),
      expect.objectContaining({
        redactedUserText: 'add email',
      }),
    );
  });
});
