import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

describe('Sprint 1.4 security review gate', () => {
  it('keeps DigiLocker real integration blocked until access is granted', () => {
    const roadmap = readFileSync(join(repoRoot, 'ROADMAP.md'), 'utf8');

    expect(roadmap).toContain('DigiLocker OIDC broker placeholder wired');
    expect(roadmap).toContain('real integration blocked until access / permission is granted');
  });

  it('uses explicit local CORS configuration instead of wildcard origins', () => {
    const main = readFileSync(join(repoRoot, 'apps', 'api', 'src', 'main.ts'), 'utf8');

    expect(main).toContain('CORS_ORIGIN');
    expect(main).toContain('http://localhost:3000');
    expect(main).not.toContain('origin: true');
  });

  it('runs i18n missing-key lint in package tests', () => {
    const packageJson = JSON.parse(
      readFileSync(join(repoRoot, 'packages', 'i18n', 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts.test).toContain('lint-catalogues');
  });

  it('keeps tenant onboarding data-driven through the seed registry and CLI', () => {
    const rootPackageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const tenants = JSON.parse(
      readFileSync(
        join(repoRoot, 'infrastructure', 'seed', 'tenants', 'tenant-seeds.json'),
        'utf8',
      ),
    ) as Array<{ code: string }>;

    expect(rootPackageJson.scripts['seed:tenant']).toBe('node scripts/seed-tenant.mjs');
    expect(tenants.map((tenant) => tenant.code)).toEqual(
      expect.arrayContaining(['KMC', 'HMC', 'CMC', 'BMC', 'SMC', 'AMC', 'DMC', 'SDDM']),
    );
  });

  it('defines a repeatable ZAP auth scan command and report location', () => {
    const rootPackageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const zapRunbook = readFileSync(
      join(repoRoot, 'docs', 'security', 'zap', 'phase-1-auth-zap.md'),
      'utf8',
    );

    expect(rootPackageJson.scripts['security:zap:auth']).toBe('node scripts/run-zap-auth-scan.mjs');
    expect(zapRunbook).toContain('Phase 1 exit criterion is satisfied');
  });
});
