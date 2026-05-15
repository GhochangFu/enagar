import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const adminCtlPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'modules',
  'admin-tenant',
  'admin-tenant.controller.ts',
);
const adminPkgPath = join(repoRoot, 'apps', 'admin-tenant', 'package.json');
const dashboardClientPath = join(
  repoRoot,
  'apps',
  'admin-tenant',
  'app',
  'dashboard',
  'dashboard-client.tsx',
);

describe('Master Sprint 6.1 — tenant admin portal contract', () => {
  it('exposes authenticated tenant-admin dashboard + catalogue routes', () => {
    const src = readFileSync(adminCtlPath, 'utf8');
    expect(src).toContain(`@Controller('admin/tenant')`);
    expect(src).toContain(`@Get('dashboard')`);
    expect(src).toContain(`@Get('services')`);
    expect(src).toContain(`@Patch('services/:serviceId')`);
  });

  it('runs Next.js admin-tenant dev server on port 3002', () => {
    const pkg = JSON.parse(readFileSync(adminPkgPath, 'utf8')) as { scripts?: { dev?: string } };
    expect(pkg.scripts?.dev).toContain('-p 3002');
  });

  it('dashboard client loads tenant-admin API endpoints', () => {
    const src = readFileSync(dashboardClientPath, 'utf8');
    expect(src).toContain('/admin/tenant/dashboard');
    expect(src).toContain('/admin/tenant/services');
  });
});
