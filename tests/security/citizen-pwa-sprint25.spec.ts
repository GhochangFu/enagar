import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const pwaPagePath = join(repoRoot, 'apps', 'citizen-pwa', 'app', 'page.tsx');
const pwaPackagePath = join(repoRoot, 'apps', 'citizen-pwa', 'package.json');
const nextConfigPath = join(repoRoot, 'apps', 'citizen-pwa', 'next.config.mjs');

describe('Sprint 2.5 citizen PWA contract', () => {
  const pwaPage = readFileSync(pwaPagePath, 'utf8');
  const pwaPackage = readFileSync(pwaPackagePath, 'utf8');
  const nextConfig = readFileSync(nextConfigPath, 'utf8');

  it('wires the citizen UI to Sprint 2 service APIs', () => {
    for (const route of [
      '/services/tenants/',
      '/applications',
      '/documents/upload-intent',
      '/scan-result',
      '/holdings/',
    ]) {
      expect(pwaPage).toContain(route);
    }
  });

  it('keeps the apply flow schema-driven and shared with @enagar/forms', () => {
    expect(pwaPackage).toContain('@enagar/forms');
    expect(nextConfig).toContain('@enagar/forms');
    expect(pwaPage).toContain('createRenderPlan');
    expect(pwaPage).toContain('validateSubmission');
    expect(pwaPage).toContain('schemaByServiceCode');
  });

  it('supports My Applications detail actions', () => {
    expect(pwaPage).toContain("activeTab === 'applications'");
    expect(pwaPage).toContain('/comment');
    expect(pwaPage).toContain('/cancel');
    expect(pwaPage).toContain('ApplicationDetailPanel');
  });

  it('does not introduce service-specific form components', () => {
    for (const componentName of [
      'BirthCertificateForm',
      'TradeLicenceForm',
      'PropertyTaxForm',
      'CommunityHallForm',
    ]) {
      expect(pwaPage).not.toContain(componentName);
    }
  });
});
