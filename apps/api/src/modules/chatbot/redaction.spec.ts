import {
  hashRedactedQuery,
  PII_PLACEHOLDERS,
  redactPii,
  restorePii,
  stripUnsafeMarkup,
} from './redaction';

describe('redactPii', () => {
  const cases: Array<{ label: string; input: string; mustContain: string[]; mustNot?: RegExp }> = [
    {
      label: 'plain mobile',
      input: 'Call me at 9876543210',
      mustContain: [PII_PLACEHOLDERS.phone],
    },
    { label: '+91 spaced', input: '+91 98765 43210', mustContain: [PII_PLACEHOLDERS.phone] },
    { label: '91 prefix', input: '91-9876543210', mustContain: [PII_PLACEHOLDERS.phone] },
    { label: 'leading zero', input: '09876543210', mustContain: [PII_PLACEHOLDERS.phone] },
    {
      label: 'aadhaar dashed',
      input: 'UID 1234-5678-9012',
      mustContain: [PII_PLACEHOLDERS.aadhaar],
    },
    { label: 'aadhaar spaced', input: '1234 5678 9012', mustContain: [PII_PLACEHOLDERS.aadhaar] },
    {
      label: 'docket ULB format',
      input: 'Track KMC/BC/2024/00123',
      mustContain: [PII_PLACEHOLDERS.docket],
    },
    {
      label: 'docket GRV',
      input: 'GRV-KMC-2024-00456',
      mustContain: [PII_PLACEHOLDERS.docket],
    },
    {
      label: 'holding number',
      input: 'Holding number KMC-12/34',
      mustContain: [PII_PLACEHOLDERS.holding],
    },
    {
      label: 'holding shorthand',
      input: 'holding KMC-99',
      mustContain: [PII_PLACEHOLDERS.holding],
    },
    {
      label: 'english name',
      input: 'My name is Ananya Sen',
      mustContain: [PII_PLACEHOLDERS.name],
    },
    {
      label: 'applicant name',
      input: 'Applicant name is Ravi Kumar',
      mustContain: [PII_PLACEHOLDERS.name],
    },
    {
      label: 'bengali name',
      input: 'আমার নাম অর্ণব মুখোপাধ্যায়',
      mustContain: [PII_PLACEHOLDERS.name],
    },
    {
      label: 'english address',
      input: 'Address: 12 Park Street, Kolkata 700016',
      mustContain: [PII_PLACEHOLDERS.address],
    },
    {
      label: 'pincode',
      input: 'Pin code 700016',
      mustContain: ['[PIN]'],
    },
    {
      label: 'combined PII',
      input: '9876543210, holding KMC-1, GRV-KMC-2024-00456',
      mustContain: [PII_PLACEHOLDERS.phone, PII_PLACEHOLDERS.holding, PII_PLACEHOLDERS.docket],
    },
    {
      label: 'no false positive on short numbers',
      input: 'Ward 12 has 3 parks',
      mustContain: [],
      mustNot: /\[CITIZEN_PHONE\]/,
    },
    {
      label: 'service question safe',
      input: 'How do I apply for birth certificate?',
      mustContain: [],
      mustNot: /\[DOCKET\]/,
    },
    {
      label: 'bengali help safe',
      input: 'জন্ম সনদের জন্য কী কাগজপত্র লাগে?',
      mustContain: [],
    },
    {
      label: 'email not phone',
      input: 'support@kmc.gov.in',
      mustContain: [],
      mustNot: /\[CITIZEN_PHONE\]/,
    },
    {
      label: 'year not aadhaar',
      input: 'Submitted in 2024',
      mustContain: [],
      mustNot: /\[AADHAAR_4\]/,
    },
    {
      label: 'multiple phones',
      input: '9876543210 or 8765432109',
      mustContain: [PII_PLACEHOLDERS.phone],
    },
    {
      label: 'name colon',
      input: 'Name: Priya Das',
      mustContain: [PII_PLACEHOLDERS.name],
    },
    {
      label: 'residing at',
      input: 'Residing at 45 Lake Road, Howrah',
      mustContain: [PII_PLACEHOLDERS.address],
    },
    {
      label: 'live at',
      input: 'I live at 9 MG Road',
      mustContain: [PII_PLACEHOLDERS.address],
    },
    {
      label: 'নাম bengali label',
      input: 'নাম: সুমিত্রা দেব',
      mustContain: [PII_PLACEHOLDERS.name],
    },
    {
      label: 'obfuscated mobile spaces',
      input: '9 8 7 6 5 4 3 2 1 0',
      mustContain: [],
      mustNot: /9876543210/,
    },
    {
      label: 'script strip separate',
      input: '<script>alert(1)</script>hello',
      mustContain: [],
    },
  ];

  it.each(cases)('$label', ({ input, mustContain, mustNot }) => {
    const { redacted } = redactPii(input);
    for (const token of mustContain) {
      expect(redacted).toContain(token);
    }
    if (mustNot) {
      expect(redacted).not.toMatch(mustNot);
    }
  });

  it('restorePii round-trips placeholders', () => {
    const raw = 'My name is Ananya Sen, mobile 9876543210';
    const { redacted, map } = redactPii(raw);
    const restored = restorePii(redacted, map);
    expect(restored).toContain('Ananya');
    expect(restored).toContain('9876543210');
  });

  it('hashRedactedQuery is stable SHA-256 hex', () => {
    const { redacted } = redactPii('no pii here');
    const h1 = hashRedactedQuery(redacted);
    const h2 = hashRedactedQuery(redacted);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('stripUnsafeMarkup removes script blocks', () => {
    expect(stripUnsafeMarkup('<script>x</script>text')).toBe('text');
  });
});
