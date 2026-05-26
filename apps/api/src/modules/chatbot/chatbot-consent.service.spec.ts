import { ChatbotConsentService } from './chatbot-consent.service';

describe('ChatbotConsentService', () => {
  it('records consent for a citizen', async () => {
    const prisma = {
      chatbotConsent: {
        upsert: jest.fn().mockResolvedValue({
          mode: 'llm',
          disclosureVersion: '2026-05',
          updatedAt: new Date('2026-05-01'),
        }),
      },
    };
    const context = {
      buildCitizenSummary: jest.fn().mockResolvedValue({
        citizenId: 'cit-1',
        summary: '',
        applications: '',
      }),
    };
    const svc = new ChatbotConsentService(prisma as never, context as never);
    const row = await svc.recordConsent({
      tenantId: 't1',
      citizenSubject: 'sub-1',
      mode: 'llm',
      accepted: true,
    });
    expect(row.accepted).toBe(true);
    expect(row.mode).toBe('llm');
  });
});
