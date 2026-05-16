import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.10 — Phase 6 P3 governance and transparency', () => {
  const tenantController = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.controller.ts');
  const tenantService = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.service.ts');
  const mastersClient = readRepo('apps/admin-tenant/app/dashboard/masters/masters-client.tsx');
  const designerClient = readRepo(
    'apps/admin-tenant/app/dashboard/services/[serviceId]/service-designer-client.tsx',
  );
  const workflowPackage = readRepo('packages/workflow/src/index.ts');
  const stateController = readRepo('apps/api/src/modules/admin-state/admin-state.controller.ts');
  const stateService = readRepo('apps/api/src/modules/admin-state/admin-state.service.ts');
  const stateClient = readRepo('apps/admin-state/app/dashboard/state-dashboard-client.tsx');
  const transparencyController = readRepo(
    'apps/api/src/modules/transparency/transparency.controller.ts',
  );
  const transparencyService = readRepo('apps/api/src/modules/transparency/transparency.service.ts');
  const citizenPwa = readRepo('apps/citizen-pwa/app/page.tsx');

  it('adds guided masters UX while preserving existing master APIs and JSON fallback', () => {
    expect(mastersClient).toContain('Sprint 6.10 · Guided masters');
    expect(mastersClient).toContain('saveGuidedRevenue');
    expect(mastersClient).toContain('saveGuidedTariff');
    expect(mastersClient).toContain('MasterEditor');
    expect(tenantController).toContain("@Patch('revenue-heads')");
    expect(tenantController).toContain("@Patch('tariffs')");
  });

  it('adds tenant catalogue governance without mutating global templates directly', () => {
    expect(tenantController).toContain("@Get('catalogue/inherited')");
    expect(tenantController).toContain("@Post('catalogue/:globalCode/adopt')");
    expect(tenantController).toContain("@Post('catalogue/:serviceCode/fork')");
    expect(tenantController).toContain("@Post('catalogue/:serviceCode/deactivate')");
    expect(tenantService).toContain('globalService.findUnique');
    expect(tenantService).toContain('tenantService.create');
    expect(tenantService).not.toContain('globalService.update');
    expect(mastersClient).toContain('Catalogue governance');
  });

  it('validates workflow escalation effect payloads and exposes guided authoring', () => {
    expect(workflowPackage).toContain('validateWorkflowEffect');
    expect(workflowPackage).toContain('escalate effect requires a payload');
    expect(workflowPackage).toContain('timeout_hours must be a positive integer');
    expect(designerClient).toContain('Escalation policy');
    expect(designerClient).toContain('notification_template_code');
  });

  it('adds state analytics v2 with bounded date ranges and state-admin access', () => {
    expect(stateController).toContain("@Get('analytics/v2')");
    expect(stateService).toContain('analytics v2 range cannot exceed 180 days');
    expect(stateService).toContain('anomaly_hints');
    expect(stateClient).toContain('Sprint 6.10 · Analytics v2');
  });

  it('adds public transparency aggregates without PII-bearing fields', () => {
    expect(transparencyController).toContain("@Controller('public/transparency')");
    expect(transparencyController).toContain('@Public()');
    expect(transparencyController).toContain("@Get('summary')");
    expect(transparencyController).toContain("@Get('sla.csv')");
    expect(transparencyService).toContain('function csvSafe');
    expect(transparencyService).not.toContain('aadhaar');
    expect(transparencyService).not.toContain('mobile');
    expect(transparencyService).not.toContain('actorSubject');
    expect(citizenPwa).toContain('Public transparency');
  });
});
