import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const apiModulesPath = join(repoRoot, 'apps', 'api', 'src', 'modules');
const roadmapPath = join(repoRoot, 'ROADMAP.md');
const tenantIsolationPath = join(__dirname, 'tenant-isolation.spec.ts');
const pwaPagePath = join(repoRoot, 'apps', 'citizen-pwa', 'app', 'page.tsx');

const protectedControllers = [
  join(apiModulesPath, 'applications', 'applications.controller.ts'),
  join(apiModulesPath, 'documents', 'documents.controller.ts'),
  join(apiModulesPath, 'holdings', 'holdings.controller.ts'),
] as const;

describe('Sprint 2.6 Phase 2 hardening contract', () => {
  const pwaPage = readFileSync(pwaPagePath, 'utf8');
  const roadmap = readFileSync(roadmapPath, 'utf8');
  const tenantIsolation = readFileSync(tenantIsolationPath, 'utf8');

  it('keeps citizen data APIs protected and bearer-authenticated', () => {
    for (const controllerPath of protectedControllers) {
      const controller = readFileSync(controllerPath, 'utf8');

      expect(controller).toContain('@ApiBearerAuth()');
      expect(controller).not.toContain('@Public()');
    }
  });

  it('keeps the PWA on Phase 2 API contracts without service-specific form components', () => {
    for (const route of [
      '/services/tenants/',
      '/applications',
      '/documents/upload-intent',
      '/holdings/',
    ]) {
      expect(pwaPage).toContain(route);
    }

    for (const componentName of [
      'BirthCertificateForm',
      'TradeLicenceForm',
      'PropertyTaxForm',
      'CommunityHallForm',
    ]) {
      expect(pwaPage).not.toContain(componentName);
    }
  });

  it('keeps the PWA source below the project file-size standard', () => {
    expect(pwaPage.split(/\r?\n/).length).toBeLessThan(1600);
  });

  it('removes stale Sprint 2.3 wording from Phase 2 isolation tests', () => {
    expect(tenantIsolation).toContain('Phase 1 and Phase 2');
    expect(tenantIsolation).not.toContain('through Sprint 2.3');
  });

  it('documents Sprint 2.6 hardening before closure', () => {
    expect(roadmap).toContain('Sprint 2.6 — Detailed Deliverables');
    expect(roadmap).toContain('Tenant/citizen isolation hardening');
    expect(roadmap).toContain('Performance smoke checks');
  });
});
