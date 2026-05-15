import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const schemaPath = join(repoRoot, 'apps', 'api', 'prisma', 'schema.prisma');
const migrationsSql = join(
  repoRoot,
  'apps',
  'api',
  'prisma',
  'migrations',
  '20260515120000_citizen_push_devices',
  'migration.sql',
);
const citizenCtlPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'citizen',
  'citizen.controller.ts',
);

describe('Master Sprint 5.4 — citizen push + PWA polish contract', () => {
  it('adds citizen_push_devices with tenant RLS + unique (citizen_id, token)', () => {
    const sql = readFileSync(migrationsSql, 'utf8');
    expect(sql).toContain('citizen_push_devices');
    expect(sql.toLowerCase()).toContain('enable row level security');
    expect(sql.toLowerCase()).toContain('create policy tenant_isolation on citizen_push_devices');
  });

  it('maps CitizenPushDevice in Prisma schema', () => {
    const schema = readFileSync(schemaPath, 'utf8');
    expect(schema).toContain('model CitizenPushDevice');
    expect(schema).toContain('@@map("citizen_push_devices")');
  });

  it('exposes authenticated push-token registration route', () => {
    const citizenCtl = readFileSync(citizenCtlPath, 'utf8');
    expect(citizenCtl).toContain(`@Post('notifications/push-token')`);
    expect(citizenCtl).toContain('RegisterPushTokenDto');
  });
});
