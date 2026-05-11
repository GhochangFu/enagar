import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const controllerPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'grievances',
  'grievances.controller.ts',
);
const migrationDir = join(repoRoot, 'apps', 'api', 'prisma', 'migrations');

describe('Sprint 4.1 grievance contract', () => {
  const controller = readFileSync(controllerPath, 'utf8');
  const migrations = readFileSync(
    join(migrationDir, '20260512100000_grievances_sla', 'migration.sql'),
    'utf8',
  );

  it('exposes REST routes mapped to ARCHITECTURE grievance flow', () => {
    for (const route of [
      `Controller('grievances')`,
      `Post('staff/sweep-sla')`,
      `Post(':id/comment')`,
      `Post(':id/feedback')`,
      `Post(':id/assign')`,
      `Patch(':id/status')`,
    ]) {
      expect(controller).toContain(route);
    }
  });

  it('migration creates grievance tables with RLS', () => {
    for (const snippet of [
      'CREATE TABLE grievances',
      'CREATE TABLE grievance_timeline',
      'CREATE TABLE sla_policies',
      'CREATE TABLE grievance_routing_rules',
      'ALTER TABLE grievances ENABLE ROW LEVEL SECURITY',
    ]) {
      expect(migrations).toContain(snippet);
    }
  });
});
