import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

describe('Hub H6.1 — citizen hub docs + dashboard wiring', () => {
  const dashboardPath = join(
    repoRoot,
    'apps',
    'api',
    'src',
    'modules',
    'citizen',
    'citizen-hub-dashboard.service.ts',
  );
  const hubRunbookPath = join(repoRoot, 'docs', 'runbooks', 'citizen-unified-hub.md');
  const exitPath = join(repoRoot, 'docs', 'runbooks', 'hub-h6-exit-checklist.md');

  it('documents portal-JWT missing-header troubleshooting with API message literals', () => {
    const md = readFileSync(hubRunbookPath, 'utf8');
    expect(md).toContain('Active municipality is required. Send X-Enagar-Tenant-Code');
    expect(md).toContain('Filings must target a municipality');
  });

  it('exit checklist reminds operators to grep citizen_hub_dashboard logs', () => {
    expect(readFileSync(exitPath, 'utf8')).toContain('citizen_hub_dashboard');
  });

  it('dashboard service fans out parallel list calls + structured hub log stub', () => {
    const src = readFileSync(dashboardPath, 'utf8');
    expect(src).toContain('await Promise.all');
    expect(src).toContain('citizen_hub_dashboard: true');
    expect(src).toContain('jwt_tenant_code');
  });
});
