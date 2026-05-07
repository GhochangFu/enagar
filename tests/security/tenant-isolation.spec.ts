import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const apiPrismaDir = join(repoRoot, 'apps', 'api', 'prisma');
const migrationsDir = join(apiPrismaDir, 'migrations');
const schemaPath = join(apiPrismaDir, 'schema.prisma');

const requiredSprint11Tables = [
  'tenants',
  'tenant_config',
  'citizens',
  'users',
  'roles',
  'user_roles',
  'wards',
  'boroughs',
  'localities',
  'notifications',
] as const;

const requiredSprint21Tables = [
  'revenue_heads',
  'service_categories',
  'global_services',
  'services',
  'service_documents',
  'service_form_versions',
] as const;

const requiredTenantIsolationTables = [
  ...requiredSprint11Tables,
  ...requiredSprint21Tables,
  'workflows',
  'workflow_stages',
  'workflow_transitions',
  'role_stage_map',
  'applications',
  'application_timeline',
  'application_comments',
  'application_documents',
  'holding_records',
  'holding_lookup_audit',
] as const;

const normalizeSql = (sql: string): string =>
  sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').toLowerCase();

const readAllMigrationSql = (): string => {
  const migrationNames = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return migrationNames
    .map((migrationName) =>
      readFileSync(join(migrationsDir, migrationName, 'migration.sql'), 'utf8'),
    )
    .join('\n');
};

const extractCreatedTables = (sql: string): string[] =>
  Array.from(sql.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?("?[\w]+"?)/gi)).map(
    ([, tableName]) => tableName.replace(/"/g, '').toLowerCase(),
  );

const extractTenantScopedTables = (sql: string): string[] =>
  Array.from(
    sql.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?("?[\w]+"?)\s*\(([\s\S]*?)\n\);/gi),
  )
    .filter(([, , body]) => /\btenant_id\b/i.test(body))
    .map(([, tableName]) => tableName.replace(/"/g, '').toLowerCase());

describe('Tenant-isolation migration contract', () => {
  const migrationSql = readAllMigrationSql();
  const normalizedSql = normalizeSql(migrationSql);
  const createdTables = extractCreatedTables(migrationSql);
  const tenantScopedTables = extractTenantScopedTables(migrationSql);

  it('creates the complete Phase 1 through Sprint 2.3 database table set', () => {
    expect(createdTables).toEqual(expect.arrayContaining([...requiredTenantIsolationTables]));
  });

  it('keeps the Prisma schema mapped to the Phase 1 through Sprint 2.3 database tables', () => {
    const schema = readFileSync(schemaPath, 'utf8');

    for (const tableName of requiredTenantIsolationTables) {
      expect(schema).toContain(`@@map("${tableName}")`);
    }
  });

  it('enables RLS on every Phase 1 through Sprint 2.3 table', () => {
    for (const tableName of requiredTenantIsolationTables) {
      expect(normalizedSql).toContain(`alter table ${tableName} enable row level security`);
    }
  });

  it('adds tenant_isolation policies to every tenant_id table', () => {
    expect(tenantScopedTables).not.toHaveLength(0);

    for (const tableName of tenantScopedTables) {
      expect(normalizedSql).toContain(`create policy tenant_isolation on ${tableName}`);
      expect(normalizedSql).toContain(`${tableName} enable row level security`);
    }
  });
});
