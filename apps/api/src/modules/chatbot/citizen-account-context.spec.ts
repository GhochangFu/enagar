import {
  formatApplicationAccountSummary,
  formatCitizenAccountBlockForKbOnly,
  formatGrievanceAccountSummary,
  formatPaymentAccountSummary,
} from './citizen-account-context';
import { buildSystemPrompt } from './prompt';

describe('citizen account context formatters', () => {
  it('formats grievance totals and recent rows', () => {
    const text = formatGrievanceAccountSummary({
      linked: true,
      total: 3,
      open: 1,
      recent: [
        {
          grievanceNo: 'GRV-KMC-001',
          status: 'submitted',
          category: 'water_supply',
          createdAt: new Date('2026-05-10T10:00:00Z'),
        },
      ],
    });
    expect(text).toContain('Total grievances filed under this municipality: 3.');
    expect(text).toContain('Open (submitted, under review, in progress): 1.');
    expect(text).toContain('GRV-KMC-001');
  });

  it('reports zero grievances when linked', () => {
    const text = formatGrievanceAccountSummary({
      linked: true,
      total: 0,
      open: 0,
      recent: [],
    });
    expect(text).toContain('Total grievances filed under this municipality: 0.');
  });

  it('includes grievance and payment sections in KB-only account block', () => {
    const block = formatCitizenAccountBlockForKbOnly({
      grievances: 'Total grievances filed under this municipality: 2.',
      applications: 'Total active applications on file (excluding cancelled/rejected): 1.',
      payments: 'Total payment attempts under this municipality: 0.',
    });
    expect(block).toContain('Grievances:');
    expect(block).toContain('Payments:');
  });
});

describe('buildSystemPrompt with citizen account data', () => {
  it('embeds grievance and payment summaries for the LLM', () => {
    const prompt = buildSystemPrompt({
      tenantName: 'Kolkata Municipal Corporation',
      helpline: '9830677740',
      language: 'en',
      citizenSummary: 'Ward linked.',
      applicationSummary: 'Total active applications on file (excluding cancelled/rejected): 1.',
      grievanceSummary: 'Total grievances filed under this municipality: 4.',
      paymentSummary: 'Total payment attempts under this municipality: 2.',
      chunks: [],
    });
    expect(prompt).toContain('CITIZEN ACCOUNT DATA — GRIEVANCES:');
    expect(prompt).toContain('Total grievances filed under this municipality: 4.');
    expect(prompt).toContain('exact numbers from CITIZEN ACCOUNT DATA');
  });
});

describe('formatApplicationAccountSummary', () => {
  it('lists recent application lines', () => {
    const text = formatApplicationAccountSummary({
      linked: true,
      total: 2,
      recentLines: ['- birth_cert: docket DOCK-1, status submitted'],
    });
    expect(text).toContain('Total active applications on file');
    expect(text).toContain('DOCK-1');
  });
});

describe('formatPaymentAccountSummary', () => {
  it('summarizes settled payments', () => {
    const text = formatPaymentAccountSummary({
      total: 3,
      settled: 2,
      recent: [
        {
          status: 'settled',
          amountPaise: 15000,
          createdAt: new Date('2026-04-01'),
          docketNo: 'D-9',
          serviceCode: 'property_tax',
        },
      ],
    });
    expect(text).toContain('Settled payments: 2');
    expect(text).toContain('INR 150.00');
  });
});
