import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const pwaPagePath = join(repoRoot, 'apps', 'citizen-pwa', 'app', 'page.tsx');
const mobileIndexPath = join(repoRoot, 'apps', 'mobile', 'src', 'index.ts');
const appModulePath = join(repoRoot, 'apps', 'api', 'src', 'app.module.ts');

const sprint13ApiRoutes = [
  '/auth/send-otp',
  '/auth/verify-otp',
  '/tenants',
  '/citizen/select-tenant',
];

describe('Sprint 1.3 citizen onboarding contract', () => {
  const pwaPage = readFileSync(pwaPagePath, 'utf8');
  const mobileIndex = readFileSync(mobileIndexPath, 'utf8');
  const appModule = readFileSync(appModulePath, 'utf8');

  it('wires the PWA flow to real Sprint 1.3 API routes', () => {
    for (const route of sprint13ApiRoutes) {
      expect(pwaPage).toContain(route);
    }
  });

  it('keeps token persistence behind browser crypto or session fallback', () => {
    expect(pwaPage).toContain('crypto.subtle');
    expect(pwaPage).toContain('AES-GCM');
    expect(pwaPage).toContain('sessionStorage');
  });

  it('declares the same onboarding sequence for the native mobile shell contract', () => {
    for (const step of ['splash', 'language', 'login', 'otp', 'tenant-picker', 'empty-home']) {
      expect(mobileIndex).toContain(step);
    }
  });

  it('registers tenant and citizen modules in the API app', () => {
    expect(appModule).toContain('TenantsModule');
    expect(appModule).toContain('CitizenModule');
  });
});
