import { ChatbotAuditService } from './audit';

describe('ChatbotAuditService', () => {
  it('persists audit without raw query text fields', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'audit-1',
      requestId: 'req-1',
    });
    const prisma = { chatbotAuditLog: { create } };
    const svc = new ChatbotAuditService(prisma as never);

    await svc.record({
      tenantId: '11111111-1111-4111-8111-111111111111',
      citizenId: null,
      sessionId: 'sess-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      latencyMs: 120,
      redactionCount: 2,
      queryHash: 'a'.repeat(64),
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          queryHash: 'a'.repeat(64),
          redactionCount: 2,
        }),
      }),
    );
    const payload = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(payload).not.toHaveProperty('query');
    expect(payload).not.toHaveProperty('rawQuery');
  });
});
