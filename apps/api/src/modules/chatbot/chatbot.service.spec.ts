import { ChatbotService } from './chatbot.service';

describe('ChatbotService streamQuery', () => {
  it('yields meta before tokens when dependencies are mocked', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          code: 'KMC',
          name: 'Kolkata Municipal Corporation',
          config: { chatbot: { enabled: true, dpa_signed: true } },
        }),
      },
      chatbotSession: {
        upsert: jest.fn().mockResolvedValue({ id: 'sess-db-1' }),
        update: jest.fn(),
      },
      chatbotMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
    };

    const tenants = {
      list: jest.fn().mockReturnValue([
        {
          id: '11111111-1111-4111-8111-111111111111',
          code: 'KMC',
          is_active: true,
        },
      ]),
    };

    const rag = {
      search: jest.fn().mockResolvedValue([
        {
          slug: 'help-services-birth-cert',
          title: 'Birth certificate help',
          body: 'Apply online',
          score: 0.9,
        },
      ]),
    };

    const context = {
      buildCitizenSummary: jest.fn().mockResolvedValue({
        citizenId: null,
        summary: 'No profile',
        applications: 'Not available',
        grievances: 'Not available',
        payments: 'Total payment attempts under this municipality: 0.',
      }),
      resolveTenantHelpline: jest.fn().mockResolvedValue({
        name: 'KMC',
        phone: '033-0000',
      }),
    };

    async function* mockStream() {
      yield { delta: 'Hello', done: false };
      yield { delta: '', done: true, finishReason: 'stop' as const };
    }

    const llm = {
      prepareOutboundText: jest.fn().mockReturnValue({
        redactedUserText: 'birth cert',
        redactionCount: 0,
        restoreMap: {},
      }),
      streamWithAudit: jest.fn().mockReturnValue(mockStream()),
    };

    const consent = {
      getConsent: jest.fn().mockResolvedValue({ accepted: true, mode: 'llm' }),
    };

    const svc = new ChatbotService(
      prisma as never,
      tenants as never,
      rag as never,
      context as never,
      llm as never,
      consent as never,
    );

    const events = [];
    for await (const evt of svc.streamQuery(
      {
        subject: 'citizen-1',
        tenantId: '99999999-9999-4999-8999-999999999999',
        tenantCode: 'WBPORTAL',
        roles: ['citizen'],
        expiresAt: new Date(Date.now() + 3600_000),
      },
      { message: 'How do I get birth certificate?' },
      'KMC',
    )) {
      events.push(evt);
    }

    expect(events[0]?.event).toBe('meta');
    expect(events[0]?.data).toMatchObject({
      citations: expect.arrayContaining([
        expect.objectContaining({ slug: 'help-services-birth-cert' }),
      ]),
    });
    expect(events.some((e) => e.event === 'token')).toBe(true);
    expect(events.at(-1)?.event).toBe('done');
  });

  it('streams KB-only reply without calling LLM', async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't1',
          code: 'KMC',
          name: 'KMC',
          config: { chatbot: { enabled: true } },
        }),
      },
      chatbotSession: {
        upsert: jest.fn().mockResolvedValue({ id: 'sess-1' }),
        update: jest.fn(),
      },
      chatbotMessage: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    };
    const tenants = {
      list: jest.fn().mockReturnValue([{ id: 't1', code: 'KMC', is_active: true }]),
    };
    const rag = {
      search: jest
        .fn()
        .mockResolvedValue([
          { slug: 'help-services-birth-cert', title: 'Birth', body: 'Apply online', score: 0.9 },
        ]),
    };
    const context = {
      buildCitizenSummary: jest.fn().mockResolvedValue({
        citizenId: 'c1',
        summary: 'x',
        applications: 'Total active applications on file (excluding cancelled/rejected): 0.',
        grievances:
          'Total grievances filed under this municipality: 2.\nOpen (submitted, under review, in progress): 1.\nResolved or closed: 1.',
        payments: 'Total payment attempts under this municipality: 0.',
      }),
      resolveTenantHelpline: jest.fn().mockResolvedValue({ name: 'KMC', phone: '033' }),
    };
    const llm = {
      prepareOutboundText: jest.fn().mockReturnValue({
        redactedUserText: 'q',
        redactionCount: 0,
        restoreMap: {},
      }),
      streamWithAudit: jest.fn(),
    };
    const consent = {
      getConsent: jest.fn().mockResolvedValue({ accepted: true, mode: 'kb_only' }),
    };
    const svc = new ChatbotService(
      prisma as never,
      tenants as never,
      rag as never,
      context as never,
      llm as never,
      consent as never,
    );
    const events = [];
    for await (const evt of svc.streamQuery(
      {
        subject: 's1',
        tenantId: 'portal',
        tenantCode: 'WBPORTAL',
        roles: ['citizen'],
        expiresAt: new Date(Date.now() + 3600_000),
      },
      { message: 'birth certificate?' },
      'KMC',
    )) {
      events.push(evt);
    }
    expect(llm.streamWithAudit).not.toHaveBeenCalled();
    expect(events.some((e) => e.event === 'token')).toBe(true);
  });
});
