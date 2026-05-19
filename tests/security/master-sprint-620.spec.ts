import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.20 — Citizen mobile PWA parity (Phase UX gate)', () => {
  const sprintPlan = readRepo('docs/runbooks/master-sprint-620-plan.md');
  const sprintExit = readRepo('docs/runbooks/master-sprint-620-exit.md');
  const phasePlan = readRepo('docs/runbooks/phase-ux-revamp-plan.md');
  const sprint619Exit = readRepo('docs/runbooks/master-sprint-619-exit.md');
  const mobileReadme = readRepo('apps/mobile/README.md');

  it('documents sprint scope and Phase 7 gate in runbooks', () => {
    expect(sprintPlan).toMatch(/Status: \*\*closed\*\*/);
    expect(sprintPlan).toContain('Central citizen hub');
    expect(sprintExit).toMatch(/Status: \*\*closed\*\*/);
    expect(sprintExit).toContain('master-sprint-620-plan.md');
    expect(sprintExit).toContain('Phase 7');
    expect(phasePlan).toContain('Sprint 6.20');
    expect(phasePlan).toContain('master-sprint-620-exit.md');
    expect(sprint619Exit).toMatch(/Status: \*\*closed\*\*/);
    expect(sprint619Exit).toContain('6.20');
  });

  it('619 exit defers mobile to 620', () => {
    expect(sprint619Exit).toContain('Deferred');
    expect(sprint619Exit).toContain('6.20');
  });

  it('620 plan references citizen PWA hub as source of truth', () => {
    expect(sprintPlan).toContain('citizen-pwa');
    expect(sprintPlan).toContain('applyTenantTheme');
    expect(sprintPlan).toContain('CitizenHubNavigation');
  });

  it('documents mobile dev configuration', () => {
    expect(mobileReadme).toContain('EXPO_PUBLIC_API_BASE_URL');
    expect(sprintPlan).toContain('CORS');
    expect(sprintPlan).toContain('8081');
  });

  it('mobile navigator exposes central citizen hub routes', () => {
    const navigator = readRepo('apps/mobile/src/navigation/CitizenNavigator.tsx');
    const types = readRepo('apps/mobile/src/navigation/types.ts');
    expect(navigator).toContain('CitizenHub');
    expect(navigator).toContain('PinMunicipalities');
    expect(navigator).toContain('Workspace');
    expect(types).toContain('CitizenHub');
    expect(readRepo('apps/mobile/src/api/citizenHubApi.ts')).toContain('/citizen/dashboard');
  });
});
