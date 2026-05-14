import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const pwaPagePath = join(repoRoot, 'apps', 'citizen-pwa', 'app', 'page.tsx');
const mobileShellPath = join(repoRoot, 'apps', 'mobile', 'src', 'CitizenShell.tsx');
const mobileFlowTypesPath = join(repoRoot, 'apps', 'mobile', 'src', 'navigation', 'types.ts');
const tenantPickerPath = join(
  repoRoot,
  'apps',
  'mobile',
  'src',
  'screens',
  'TenantPickerScreen.tsx',
);
const appModulePath = join(repoRoot, 'apps', 'api', 'src', 'app.module.ts');

const sprint13ApiRoutes = [
  '/auth/send-otp',
  '/auth/verify-otp',
  '/tenants',
  '/citizen/select-tenant',
];

describe('Sprint 1.3 citizen onboarding contract', () => {
  const pwaPage = readFileSync(pwaPagePath, 'utf8');
  const mobileShell = readFileSync(mobileShellPath, 'utf8');
  const mobileFlowTypes = readFileSync(mobileFlowTypesPath, 'utf8');
  const tenantPicker = readFileSync(tenantPickerPath, 'utf8');
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

  it('declares the citizen native-stack contract (Splash → tenants → OTP → hub + grievances)', () => {
    expect(mobileFlowTypes).toContain('CitizenShellFlowContract');
    for (const step of ["'splash'", "'tenant'", "'login'", "'main'"]) {
      expect(mobileFlowTypes).toContain(step);
    }
    expect(mobileShell).toContain('SessionProvider');
    expect(mobileShell).toContain('NavigationContainer');
    expect(mobileShell).toContain('CitizenNavigator');
    expect(tenantPicker).toContain('fetchPublicTenants');
    expect(tenantPicker).toContain('resolveLocale');
  });

  it('registers tenant and citizen modules in the API app', () => {
    expect(appModule).toContain('TenantsModule');
    expect(appModule).toContain('CitizenModule');
  });
});
