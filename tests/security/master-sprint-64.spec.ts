import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const schemaPath = join(repoRoot, 'apps', 'api', 'prisma', 'schema.prisma');
const migrationPath = join(
  repoRoot,
  'apps',
  'api',
  'prisma',
  'migrations',
  '20260515161000_admin_tenant_operations',
  'migration.sql',
);
const adminControllerPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'admin-tenant',
  'admin-tenant.controller.ts',
);
const adminContractsPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'admin-tenant',
  'admin-tenant-config.contracts.ts',
);
const operationsClientPath = join(
  repoRoot,
  'apps',
  'admin-tenant',
  'app',
  'dashboard',
  'operations',
  'operations-client.tsx',
);

describe('Master Sprint 6.4 — tenant operations contract', () => {
  it('adds tenant-scoped persistence for notification templates and KB articles', () => {
    const schema = readFileSync(schemaPath, 'utf8');
    const migration = readFileSync(migrationPath, 'utf8');

    expect(schema).toContain('model NotificationTemplate');
    expect(schema).toContain('model KbArticle');
    expect(migration).toContain('CREATE TABLE notification_templates');
    expect(migration).toContain('CREATE TABLE kb_articles');
    expect(migration).toContain('ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY');
  });

  it('exposes authenticated tenant-admin endpoints for 6.4 operations', () => {
    const src = readFileSync(adminControllerPath, 'utf8');
    for (const marker of [
      `@Get('settings')`,
      `@Patch('settings')`,
      `@Get('notification-templates')`,
      `@Patch('notification-templates')`,
      `@Get('kb-articles')`,
      `@Patch('kb-articles')`,
      `@Get('staff')`,
      `@Patch('staff')`,
      `@Get('role-stage-maps')`,
      `@Patch('role-stage-maps')`,
    ]) {
      expect(src).toContain(marker);
    }
  });

  it('validates templates, KB markdown, branding, and feature flags without provider sends', () => {
    const src = readFileSync(adminContractsPath, 'utf8');
    expect(src).toContain('assertValidNotificationVariables');
    expect(src).toContain('assertValidLocalizedMarkdown');
    expect(src).toContain('assertValidBranding');
    expect(src).toContain('assertValidFeatureFlags');
    expect(src).not.toContain('sendSms');
    expect(src).not.toContain('sendWhatsApp');
    expect(src).not.toContain('new Function');
    expect(src).not.toContain('eval(');
  });

  it('adds tenant admin UI for operations and keeps external integrations deferred', () => {
    const src = readFileSync(operationsClientPath, 'utf8');
    expect(src).toContain('title="Operations"');
    expect(src).toContain('notification-templates');
    expect(src).toContain('kb-articles');
    expect(src).toContain('feature_flags');
    expect(src).toContain('role-stage-maps');
    expect(src).not.toContain('dangerouslySetInnerHTML');
  });
});
