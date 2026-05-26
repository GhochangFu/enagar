import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 7.2 — LLM adapter, PII redaction & audit', () => {
  const plan = readRepo('docs/runbooks/master-sprint-72-plan.md');
  const redaction = readRepo('apps/api/src/modules/chatbot/redaction.ts');
  const audit = readRepo('apps/api/src/modules/chatbot/audit.ts');
  const llmService = readRepo('apps/api/src/modules/chatbot/chatbot-llm.service.ts');
  const migration = readRepo(
    'apps/api/prisma/migrations/20260526120000_chatbot_audit_logs/migration.sql',
  );
  const schema = readRepo('apps/api/prisma/schema.prisma');
  const envExample = readRepo('infrastructure/.env.example');

  it('has sprint plan with deliverables and exit criteria', () => {
    expect(plan).toContain('Sprint 7.2');
    expect(plan).toContain('chatbot_audit_logs');
    expect(plan).toContain('redaction.spec.ts');
  });

  it('ships PII placeholders and hash-only audit contract', () => {
    expect(redaction).toContain('[CITIZEN_PHONE]');
    expect(redaction).toContain('[AADHAAR_4]');
    expect(redaction).toContain('hashRedactedQuery');
    expect(audit).toContain('queryHash');
    expect(migration).toContain('query_hash');
    expect(migration).not.toMatch(/raw_query|query_text/i);
    expect(schema).toContain('model ChatbotAuditLog');
  });

  it('implements OpenAI, Gemini, and Ollama providers with DPA guard', () => {
    expect(llmService).toContain('OpenAIProvider');
    expect(llmService).toContain('GeminiProvider');
    expect(llmService).toContain('OllamaProvider');
    expect(llmService).toContain('assertDpaAllowsProviderCall');
    expect(llmService).toContain('dpa_signed');
  });

  it('exposes dev LLM health route under /api/chatbot', () => {
    const controller = readRepo('apps/api/src/modules/chatbot/chatbot.controller.ts');
    expect(controller).toContain("Get('llm/health')");
    expect(readRepo('apps/api/src/app.module.ts')).toContain('ChatbotModule');
  });

  it('documents LLM and DPA skip env vars', () => {
    expect(envExample).toContain('LLM_PROVIDER');
    expect(envExample).toContain('CHATBOT_DPA_SKIP_DEV');
  });
});
