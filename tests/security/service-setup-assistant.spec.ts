import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const ssaDir = join(repoRoot, 'apps', 'api', 'src', 'modules', 'service-setup-assistant');
const toolDir = join(ssaDir, 'tools');

const read = (relativePath: string): string => readFileSync(join(repoRoot, relativePath), 'utf8');

const listToolSourceFiles = (): string[] =>
  readdirSync(toolDir)
    .filter((name) => name.endsWith('.tools.ts'))
    .map((name) => join(toolDir, name));

describe('EN-57 — Service Setup Assistant hardening', () => {
  it('guardrails module blocks publish and policy violations', () => {
    const guardrails = read('apps/api/src/modules/service-setup-assistant/guardrails.ts');
    expect(guardrails).toContain('sanitizeSetupAssistantInput');
    expect(guardrails).toContain('assertSetupAssistantInputAllowed');
    expect(guardrails).toContain('POLICY_VIOLATION_PATTERNS');
    expect(guardrails).toContain('sanitizeChatbotInput');
  });

  it('orchestration service wires guardrails and token budget', () => {
    const service = read(
      'apps/api/src/modules/service-setup-assistant/service-setup-assistant.service.ts',
    );
    expect(service).toContain('assertSetupAssistantInputAllowed');
    expect(service).toContain('resolveSessionTokenCap');
    expect(service).toContain('isSessionOverTokenCap');
    expect(service).toContain('recordSessionTokenUsage');
    expect(service).toContain('serviceSetupAuditLog.create');
  });

  it('tenant controller enforces tenant portal staff role', () => {
    const controller = read(
      'apps/api/src/modules/service-setup-assistant/service-setup-assistant.controller.ts',
    );
    expect(controller).toContain('assertTenantPortalStaff');
    expect(controller).not.toContain('assertStateAdmin');
  });

  it('state form controller enforces state admin role', () => {
    const controller = read(
      'apps/api/src/modules/service-setup-assistant/state-form-assistant.controller.ts',
    );
    expect(controller).toContain('assertStateAdmin');
    expect(controller).not.toContain('assertTenantPortalStaff');
  });

  it('setup session service rejects cross-tenant access', () => {
    const sessionService = read(
      'apps/api/src/modules/service-setup-assistant/setup-session.service.ts',
    );
    expect(sessionService).toContain('Setup session does not belong to this tenant');
    expect(sessionService).toContain('ForbiddenException');
  });

  it('tool registry exposes no publish* tools', () => {
    const names: string[] = [];
    for (const file of listToolSourceFiles()) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/name:\s*'([^']+)'/g)) {
        names.push(match[1]);
      }
    }
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.toLowerCase()).not.toMatch(/^publish/);
      expect(name.toLowerCase()).not.toContain('publish');
    }
  });

  it('schema tracks per-session token usage', () => {
    const schema = read('apps/api/prisma/schema.prisma');
    expect(schema).toContain('tokenUsageJson');
    expect(schema).toContain('token_usage_json');
  });

  it('runbook and smoke script exist', () => {
    const runbook = read('docs/runbooks/service-setup-assistant.md');
    expect(runbook).toContain('SETUP_ASSISTANT_SKIP_DPA_DEV');
    expect(runbook).toContain('smoke-service-setup-assistant.mjs');
    const smoke = read('scripts/smoke-service-setup-assistant.mjs');
    expect(smoke).toContain('setup-assistant/sessions');
  });

  it('infrastructure env example documents setup assistant keys', () => {
    const env = read('infrastructure/.env.example');
    expect(env).toContain('SETUP_ASSISTANT_SKIP_DPA_DEV');
    expect(env).toContain('SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION');
  });
});
