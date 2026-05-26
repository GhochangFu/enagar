import { formatKbOnlyReply } from './kb-only-reply';

describe('formatKbOnlyReply', () => {
  it('returns Bengali KB-only summary with citations', () => {
    const text = formatKbOnlyReply({
      language: 'bn',
      chunks: [
        { slug: 'help-services-birth-cert', title: 'Birth cert', body: 'Steps', score: 0.9 },
      ],
      citations: [{ slug: 'help-services-birth-cert', title: 'Birth cert', score: 0.9 }],
      grievanceSummary: 'Total grievances filed under this municipality: 1.',
      applicationSummary: 'Total active applications on file (excluding cancelled/rejected): 0.',
      paymentSummary: 'Total payment attempts under this municipality: 0.',
    });
    expect(text).toContain('KB-only');
    expect(text).toContain('help-services-birth-cert');
  });
});
