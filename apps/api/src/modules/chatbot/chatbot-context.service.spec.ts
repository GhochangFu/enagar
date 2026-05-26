import { ChatbotContextService } from './chatbot-context.service';

describe('ChatbotContextService.buildCitizenSummary', () => {
  it('loads grievance counts and recent rows for a linked citizen', async () => {
    const prisma = {
      citizen: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cit-1',
          name: 'Test Citizen',
          wardId: 'ward-1',
          holdingNumber: null,
          languagePref: 'en',
        }),
      },
      application: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { docketNo: 'D-100', status: 'submitted', serviceCode: 'birth_cert' },
          ]),
      },
      grievance: {
        count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2),
        findMany: jest.fn().mockResolvedValue([
          {
            grievanceNo: 'GRV-1',
            status: 'submitted',
            category: 'roads',
            createdAt: new Date('2026-05-01'),
          },
        ]),
      },
      payment: {
        count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1),
        findMany: jest.fn().mockResolvedValue([
          {
            status: 'settled',
            amountPaise: 50000,
            createdAt: new Date('2026-04-15'),
            application: { docketNo: 'D-50', serviceCode: 'property_tax' },
          },
        ]),
      },
    };

    const svc = new ChatbotContextService(prisma as never);
    const row = await svc.buildCitizenSummary({
      tenantId: 'tenant-1',
      citizenSubject: 'kc-subject',
    });

    expect(row.citizenId).toBe('cit-1');
    expect(row.grievances).toContain('Total grievances filed under this municipality: 3.');
    expect(row.grievances).toContain('Open (submitted, under review, in progress): 2.');
    expect(row.grievances).toContain('GRV-1');
    expect(row.payments).toContain('Total payment attempts under this municipality: 2.');
    expect(prisma.grievance.count).toHaveBeenCalledTimes(2);
  });
});
