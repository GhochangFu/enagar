import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.9 — Phase 6 P2 reporting, bulk ops, and state visibility', () => {
  const tenantController = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.controller.ts');
  const tenantService = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.service.ts');
  const stateController = readRepo('apps/api/src/modules/admin-state/admin-state.controller.ts');
  const stateService = readRepo('apps/api/src/modules/admin-state/admin-state.service.ts');
  const tenantDashboard = readRepo('apps/admin-tenant/app/dashboard/dashboard-client.tsx');
  const tenantMasters = readRepo('apps/admin-tenant/app/dashboard/masters/masters-client.tsx');
  const stateDashboard = readRepo('apps/admin-state/app/dashboard/state-dashboard-client.tsx');

  it('adds tenant dashboard depth without cross-tenant queries', () => {
    expect(tenantController).toContain("@Get('dashboard/deep')");
    expect(tenantService).toContain('getDashboardDeep');
    expect(tenantService).toContain('tenantId: principal.tenantId');
    expect(tenantDashboard).toContain('DashboardDeep');
    expect(tenantDashboard).toContain('Breached applications');
    expect(tenantDashboard).toContain('Top active workload');
  });

  it('adds tenant CSV exports with formula-injection escaping and auth-header downloads', () => {
    expect(tenantController).toContain("@Get('exports/applications.csv')");
    expect(tenantController).toContain("@Get('exports/payments.csv')");
    expect(tenantController).toContain("@Get('exports/grievances.csv')");
    expect(tenantController).toContain("@Get('exports/sla-summary.csv')");
    expect(tenantService).toContain('function csvSafe');
    expect(tenantService).toContain('/^[=+\\-@]/');
    expect(tenantDashboard).toContain('downloadExport');
    expect(tenantDashboard).toContain('headers: authHeaders()');
  });

  it('adds address-master bulk CSV dry-run/import with row-level validation', () => {
    expect(tenantController).toContain("@Post('address-master/import-csv')");
    expect(tenantService).toContain('importAddressMasterCsv');
    expect(tenantService).toContain('dry_run');
    expect(tenantService).toContain('validateAddressImportRow');
    expect(tenantMasters).toContain('Address master CSV');
    expect(tenantMasters).toContain('Dry-run');
  });

  it('adds state audit search/export and tenant drill-down without unsafe rendering', () => {
    expect(stateController).toContain("@Get('audit-logs.csv')");
    expect(stateController).toContain("@Get('tenants/:code')");
    expect(stateService).toContain('auditWhere');
    expect(stateService).toContain('exportAuditLogsCsv');
    expect(stateService).toContain('getTenantDetail');
    expect(stateDashboard).toContain('Audit log');
    expect(stateDashboard).toContain('StateTenantDetailDrawer');
    expect(stateDashboard).not.toContain('dangerouslySetInnerHTML');
  });
});
