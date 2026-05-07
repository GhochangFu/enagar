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

describe('Sprint 1.1 tenant-isolation migration contract', () => {
  const migrationSql = readAllMigrationSql();
  const normalizedSql = normalizeSql(migrationSql);
  const createdTables = extractCreatedTables(migrationSql);
  const tenantScopedTables = extractTenantScopedTables(migrationSql);

  it('creates the complete Sprint 1.1 database table set', () => {
    expect(createdTables).toEqual(expect.arrayContaining([...requiredSprint11Tables]));
  });

  it('keeps the Prisma schema mapped to the Sprint 1.1 database tables', () => {
    const schema = readFileSync(schemaPath, 'utf8');

    for (const tableName of requiredSprint11Tables) {
      expect(schema).toContain(`@@map("${tableName}")`);
    }
  });

  it('enables RLS on every Sprint 1.1 table', () => {
    for (const tableName of requiredSprint11Tables) {
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
