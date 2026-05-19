import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.15 — Citizen PWA auth, hub and navigation', () => {
  const page = readRepo('apps/citizen-pwa/app/page.tsx');
  const authFlow = readRepo('apps/citizen-pwa/components/citizen-auth-flow.tsx');
  const hubComponents = readRepo('apps/citizen-pwa/components/citizen-hub-components.tsx');
  const tailwindConfig = readRepo('apps/citizen-pwa/tailwind.config.ts');
  const tsconfig = readRepo('apps/citizen-pwa/tsconfig.json');
  const sprintPlan = readRepo('docs/runbooks/master-sprint-615-plan.md');
  const phasePlan = readRepo('docs/runbooks/phase-ux-revamp-plan.md');

  it('extracts auth and hub chrome from the monolithic citizen page', () => {
    expect(page).toContain('SplashStep');
    expect(page).toContain('PinMunicipalitiesStep');
    expect(page).toContain('CitizenHubNavigation');
    expect(page).toContain('PinnedMunicipalityCard');
    expect(page).toContain('BrowseMunicipalityModal');
  });

  it('keeps the sprint focused on Warm Coral B+ Pro UX without API drift', () => {
    expect(authFlow).toContain('bg-canvas');
    expect(authFlow).not.toContain('radial-gradient');
    expect(authFlow).toContain('bg-mint-band');
    expect(authFlow).toContain('bg-peach-accent');
    expect(hubComponents).toContain('CitizenHubNavigation');
    expect(hubComponents).toContain('theme_color');
    expect(page).toContain('/citizen/preferences');
    expect(page).toContain('/tenants');
    expect(page).not.toContain('/citizen/ux-615');
  });

  it('uses shared UI primitives and scans local citizen components for Tailwind classes', () => {
    expect(authFlow).toContain("from '@enagar/ui'");
    expect(hubComponents).toContain("from '@enagar/ui'");
    expect(tailwindConfig).toContain('./components/**/*.{ts,tsx}');
    expect(tsconfig).toContain('components/**/*.tsx');
  });

  it('preserves 6.13 Apply catalogue behaviour while polishing browse entry', () => {
    expect(page).toContain('hubTab ===');
    expect(page).toContain("workspaceTab: 'services'");
    expect(hubComponents).toContain('Search by code, name, district');
    expect(hubComponents).toContain('enter its workspace without changing your pins');
  });

  it('documents the 6.15 scope and keeps Phase 7 gated by the UX programme', () => {
    expect(sprintPlan).toContain('Citizen PWA Auth, Hub & Navigation');
    expect(sprintPlan).toContain('No API route, database, service schema');
    expect(sprintPlan).toContain('360 px viewport');
    expect(phasePlan).toContain('Sprint 6.15 — Citizen PWA: auth, hub & navigation');
    expect(phasePlan).toContain('Option B+ Pro');
    expect(phasePlan).toMatch(/Sprint 6\.1[67]/);
  });
});
