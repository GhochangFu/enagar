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

  it('streams step 4 config tool and emits draft_updated config', async () => {
    const toolCallsBlock = `\n\n\`\`\`json\n{"tool_calls":[{"name":"applyServiceConfig","arguments":{"fee_rule":{"type":"fixed","amount_paise":5000}}}]}\n\`\`\``;
    const prisma = {
      serviceSetupMessage: {
        create: jest.fn().mockResolvedValue({ id: 'assistant-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      serviceSetupAuditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      serviceSetupSession: {
        findUnique: jest.fn(),
      },
    };
    const sessions = {
      assertSessionAccess: jest.fn().mockResolvedValue({ serviceId: 'svc-1', scope: 'payment' }),
      getSession: jest.fn().mockResolvedValue({
        id: 'sess-1',
        scope: 'payment',
        current_step: 4,
        archetype: null,
        step_completion: {},
        status: 'active',
      }),
      markStepComplete: jest.fn(),
    };
    const readiness = {
      forService: jest.fn().mockResolvedValue({
        items: [
          { key: 'config_complete', status: 'green' },
          { key: 'booking_assets', status: 'green' },
        ],
      }),
    };
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({
        service: { code: 'SVC', name: { en: 'Test' } },
        workflow_pattern: 'cert-issuance',
      }),
      getServiceConfig: jest.fn().mockResolvedValue({
        fee_rule: { type: 'fixed', amount_paise: 5000 },
        fee_preview_paise: 5000,
        payment_schedule: 'upfront_only',
        required_documents: [],
        revenue_head: null,
        boc_policy: null,
        municipal_signoff_policy: null,
        bookable_asset_codes: [],
      }),
      listRevenueHeads: jest.fn().mockResolvedValue([]),
    };
    const llm = {
      prepareOutboundText: jest.fn().mockReturnValue({
        redactedUserText: 'set fee',
        redactionCount: 0,
        restoreMap: {},
      }),
      streamForSetupAssistant: jest.fn(async function* () {
        yield { delta: toolCallsBlock, done: false };
        yield { delta: '', done: true };
      }),
    };
    const tools = {
      formatToolsForPrompt: jest.fn().mockReturnValue('- applyServiceConfig'),
      executeTool: jest.fn().mockResolvedValue({
        success: true,
        summary: 'applied service configuration',
        draftUpdated: 'config',
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
      'set a fixed fee of 50 rupees',
    )) {
      events.push(event);
    }

    expect(events.some((event) => event.type === 'draft_updated' && event.layer === 'config')).toBe(
      true,
    );
    expect(tools.executeTool).toHaveBeenCalledWith(
      'tenant',
      'applyServiceConfig',
      expect.any(Object),
      expect.objectContaining({ fee_rule: { type: 'fixed', amount_paise: 5000 } }),
    );
  });

  it('rejects guardrail policy violations before LLM call', async () => {
    const service = new ServiceSetupAssistantService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      (async () => {
        for await (const _event of service.streamTenantMessage(
          principal,
          'svc-1',
          'sess-1',
          'auto-publish the form now',
        )) {
          // drain
        }
      })(),
    ).rejects.toThrow('setup assistant policy');
  });

  it('returns token budget error when session is over cap', async () => {
    const previousCap = process.env.SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION;
    process.env.SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION = '100';

    const prisma = {
      serviceSetupMessage: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    };
    const sessions = {
      assertSessionAccess: jest.fn().mockResolvedValue({
        serviceId: 'svc-1',
        scope: 'form',
        tokenUsageJson: { input_tokens: 80, output_tokens: 30, total_tokens: 110 },
      }),
      getSession: jest.fn().mockResolvedValue({
        id: 'sess-1',
        scope: 'form',
        current_step: 2,
        archetype: null,
        step_completion: {},
        status: 'active',
      }),
    };
    const llm = { prepareOutboundText: jest.fn() };

    const service = new ServiceSetupAssistantService(
      prisma as never,
      sessions as never,
      {} as never,
      {} as never,
      {} as never,
      llm as never,
      {} as never,
    );

    const events = [];
    for await (const event of service.streamTenantMessage(
      principal,
      'svc-1',
      'sess-1',
      'add applicant name field',
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'meta', session_id: 'sess-1', step: 2 },
      {
        type: 'error',
        message: 'Session token budget exceeded. Start a new setup session to continue.',
      },
    ]);
    expect(llm.prepareOutboundText).not.toHaveBeenCalled();

    if (previousCap === undefined) {
      delete process.env.SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION;
    } else {
      process.env.SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION = previousCap;
    }
  });
});
