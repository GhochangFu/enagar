import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 7.3 — Chatbot RAG query pipeline & SSE', () => {
  const plan = readRepo('docs/runbooks/master-sprint-73-plan.md');
  const chatbotService = readRepo('apps/api/src/modules/chatbot/chatbot.service.ts');
  const controller = readRepo('apps/api/src/modules/chatbot/chatbot.controller.ts');
  const rag = readRepo('apps/api/src/modules/chatbot/rag-retrieval.service.ts');
  const guardrails = readRepo('apps/api/src/modules/chatbot/guardrails.ts');
  const migration = readRepo(
    'apps/api/prisma/migrations/20260527120000_chatbot_sessions/migration.sql',
  );

  it('has sprint plan with SSE query and history deliverables', () => {
    expect(plan).toContain('Sprint 7.3');
    expect(plan).toContain('POST /api/chatbot/query');
    expect(plan).toContain('chatbot_sessions');
  });

  it('ships RAG retrieval via rag-indexer and SSE query route', () => {
    expect(rag).toContain('RAG_INDEXER_URL');
    expect(rag).toContain('/search');
    expect(controller).toContain("Post('query')");
    expect(controller).toContain('text/event-stream');
    expect(chatbotService).toContain('streamWithAudit');
    expect(chatbotService).toContain("event: 'meta'");
  });

  it('includes guardrails and session persistence', () => {
    expect(guardrails).toContain('sanitizeChatbotInput');
    expect(migration).toContain('chatbot_sessions');
    expect(migration).toContain('chatbot_messages');
    expect(readRepo('packages/types/src/chatbot.ts')).toContain('ChatbotSseMeta');
  });

  it('documents smoke script and failover env', () => {
    expect(readRepo('scripts/smoke-sprint-73-chatbot.mjs')).toContain('chatbot/query');
    expect(readRepo('infrastructure/.env.example')).toContain('CHATBOT_FALLBACK_PROVIDER');
  });
});
