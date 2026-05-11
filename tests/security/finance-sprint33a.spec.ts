import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const financeControllerPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'finance',
  'finance.controller.ts',
);
const migrationDir = join(repoRoot, 'apps', 'api', 'prisma', 'migrations');

describe('Sprint 3.3A finance contract', () => {
  const controller = readFileSync(financeControllerPath, 'utf8');
  const migrations = readFileSync(
    join(migrationDir, '20260511143000_deposits_refunds_challans', 'migration.sql'),
    'utf8',
  );

  it('lists staff finance route prefixes for deposits, refunds, and challans', () => {
    for (const route of [
      `Controller('finance')`,
      `Post('deposits')`,
      `refund-dispatch`,
      `refund-dispatches`,
      `Post('challans')`,
      'mark-paid-internal',
    ]) {
      expect(controller).toContain(route);
    }
  });

  it('migration creates tenant-scoped deposits, refund_dispatches, and challans tables with RLS', () => {
    for (const snippet of [
      'CREATE TABLE deposits',
      'CREATE TABLE refund_dispatches',
      'CREATE TABLE challans',
      'ALTER TABLE deposits ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE refund_dispatches ENABLE ROW LEVEL SECURITY',
      'ALTER TABLE challans ENABLE ROW LEVEL SECURITY',
    ]) {
      expect(migrations).toContain(snippet);
    }
  });
});
