import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.12 — Phase 6 P5 identity, library, integrations, and hardening', () => {
  const schema = readRepo('apps/api/prisma/schema.prisma');
  const migration = readRepo(
    'apps/api/prisma/migrations/20260516160000_phase6_p5_identity_library_integrations/migration.sql',
  );
  const tenantController = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.controller.ts');
  const tenantService = readRepo('apps/api/src/modules/admin-tenant/admin-tenant.service.ts');
  const tenantOperations = readRepo(
    'apps/admin-tenant/app/dashboard/operations/operations-client.tsx',
  );
  const stateController = readRepo('apps/api/src/modules/admin-state/admin-state.controller.ts');
  const stateService = readRepo('apps/api/src/modules/admin-state/admin-state.service.ts');
  const stateClient = readRepo('apps/admin-state/app/dashboard/state-dashboard-client.tsx');

  it('adds tenant-scoped staff invites with dry-run provisioning and no secret persistence', () => {
    expect(schema).toContain('model StaffInvite');
    expect(schema).toContain('tenantId        String');
    expect(schema).not.toContain('generatedPassword');
    expect(migration).toContain('CREATE TABLE staff_invites');
    expect(migration).toContain('ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY');
    expect(tenantController).toContain("@Post('staff-invites')");
    expect(tenantController).toContain("@Patch('staff-invites')");
    expect(tenantService).toContain('provisioningMode');
    expect(tenantService).toContain('dry_run');
    expect(tenantService).toContain('staff_invite.create');
    expect(tenantOperations).toContain('Guided staff invite / provisioning');
  });

  it('adds global library curation without destructive tenant override mutation', () => {
    expect(schema).toContain('lifecycleStatus');
    expect(migration).toContain('ADD COLUMN lifecycle_status');
    expect(stateController).toContain("@Get('global-service-library')");
    expect(stateController).toContain("@Post('global-service-library/lifecycle')");
    expect(stateService).toContain('Publishing does not mutate tenant overrides automatically');
    expect(stateService).toContain('global_library.publish');
    expect(stateService).not.toContain('tenantService.updateMany');
    expect(stateClient).toContain('Global service library curator');
  });

  it('keeps integration cockpit metadata-only and rejects secret-like values', () => {
    expect(schema).toContain('model StateIntegration');
    expect(migration).toContain('CREATE TABLE state_integrations');
    expect(stateController).toContain("@Get('integrations')");
    expect(stateController).toContain("@Get('integrations.csv')");
    expect(stateService).toContain('rejectSecretLikeValues');
    expect(stateService).toContain('integration cockpit accepts metadata only');
    expect(stateService).toContain('checked_without_secrets');
    expect(stateClient).toContain('Secret-like values are rejected');
  });

  it('documents and exposes audit coverage for new admin mutations', () => {
    expect(stateController).toContain("@Get('audit-coverage')");
    expect(stateService).toContain('requiredAuditActions');
    expect(stateService).toContain('staff_invite.disable');
    expect(stateService).toContain('integration_cockpit.check');
    expect(stateClient).toContain('Sprint 6.12 audit coverage');
  });

  it('enforces wizard-only tenant onboarding guardrails for active tenants', () => {
    expect(stateService).toContain('assertWizardOnboarding');
    expect(stateService).toContain('config.onboarding_source=state_wizard');
    expect(stateService).toContain('config.wizard_completed=true');
    expect(stateClient).toContain("onboarding_source: 'state_wizard'");
  });
});
