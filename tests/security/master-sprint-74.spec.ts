import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 7.4 — Sahayak UI, consent & feedback', () => {
  const plan = readRepo('docs/runbooks/master-sprint-74-plan.md');
  const controller = readRepo('apps/api/src/modules/chatbot/chatbot.controller.ts');
  const pwa = readRepo('apps/citizen-pwa/components/sahayak-workspace.tsx');
  const mobile = readRepo('apps/mobile/src/screens/sahayak/SahayakChatScreen.tsx');

  it('has sprint plan with consent, feedback, and UI deliverables', () => {
    expect(plan).toContain('Sprint 7.4');
    expect(plan).toContain('chatbot/consent');
    expect(plan).toContain('chatbot/feedback');
  });

  it('ships consent and feedback API routes', () => {
    expect(controller).toContain("Get('consent')");
    expect(controller).toContain("Post('consent')");
    expect(controller).toContain("Post('feedback')");
    expect(readRepo('apps/api/src/modules/chatbot/kb-only-reply.ts')).toContain('kb_only');
  });

  it('includes PWA Sahayak workspace with consent modal', () => {
    expect(pwa).toContain('SahayakWorkspace');
    expect(pwa).toContain('Sahayak AI disclosure');
    expect(readRepo('apps/citizen-pwa/lib/chatbot-sse.ts')).toContain('parseChatbotSseBuffer');
  });

  it('registers mobile Sahayak chat screen', () => {
    expect(mobile).toContain('SahayakChatScreen');
    expect(readRepo('apps/mobile/src/navigation/CitizenNavigator.tsx')).toContain('SahayakChat');
    expect(readRepo('apps/mobile/src/api/chatbotApi.ts')).toContain('/chatbot/query');
  });
});
