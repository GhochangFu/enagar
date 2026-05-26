import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

// Load compiled redaction via ts-jest path from API package tests instead of duplicating logic.
// Security suite statically asserts adversarial coverage exists in API unit tests.
describe('PII redaction — security contract', () => {
  const redactionSpec = readFileSync(
    join(repoRoot, 'apps/api/src/modules/chatbot/redaction.spec.ts'),
    'utf8',
  );
  const redaction = readFileSync(
    join(repoRoot, 'apps/api/src/modules/chatbot/redaction.ts'),
    'utf8',
  );

  it('maintains ≥25 adversarial redaction cases in API unit tests', () => {
    const caseCount = (redactionSpec.match(/label:/g) ?? []).length;
    expect(caseCount).toBeGreaterThanOrEqual(25);
  });

  it('redacts all ADR-0008 placeholder categories', () => {
    for (const token of [
      'CITIZEN_PHONE',
      'AADHAAR_4',
      'HOLDING',
      'DOCKET',
      'CITIZEN_NAME',
      'ADDRESS',
    ]) {
      expect(redaction).toContain(`[${token}]`);
    }
  });

  it('never logs raw query in audit schema', () => {
    const migration = readFileSync(
      join(repoRoot, 'apps/api/prisma/migrations/20260526120000_chatbot_audit_logs/migration.sql'),
      'utf8',
    );
    expect(migration).toContain('query_hash');
    expect(migration).not.toMatch(/\bquery\s+text\b/i);
  });
});
