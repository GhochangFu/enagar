import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const hubConfigPath = join(repoRoot, 'infrastructure', 'portal-hub', 'config.js');
const startGuidePath = join(repoRoot, 'docs', 'help', 'start-the-app-step-by-step.md');
const phase6RunbookPath = join(repoRoot, 'docs', 'runbooks', 'unified-portal-local-dev-phase6.md');

/** Matches pnpm dev:portals — apps/api citizen-pwa admin-tenant admin-state ports. */
const DEV_PORTALS = {
  citizen: 'http://localhost:3000',
  tenant: 'http://localhost:3002/login',
  state: 'http://localhost:3003/login',
};

describe('Unified Portal Option A — local dev story (Phase 6)', () => {
  it('portal hub config.js links localhost hub to dev:portals ports', () => {
    const config = readFileSync(hubConfigPath, 'utf8');
    expect(config).toContain(DEV_PORTALS.citizen);
    expect(config).toContain(DEV_PORTALS.tenant);
    expect(config).toContain(DEV_PORTALS.state);
  });

  it('portal hub config.js supports optional enagar.local pre-prod hostnames', () => {
    const config = readFileSync(hubConfigPath, 'utf8');
    expect(config).toContain('.enagar.local');
    expect(config).toContain('http://enagarcitizen.enagar.local:3000');
    expect(config).toContain('http://enagartenant.enagar.local:3002/login');
    expect(config).toContain('http://enagarstate.enagar.local:3003/login');
  });

  it('root package.json exposes dev:portals and dev:hub', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['dev:portals']).toContain('@enagar/citizen-pwa');
    expect(pkg.scripts['dev:portals']).toContain('@enagar/admin-tenant');
    expect(pkg.scripts['dev:hub']).toContain('portal-hub');
    expect(pkg.scripts['dev:hub']).toContain('5500');
  });

  it('start guide documents optional hub, dev:portals, and build-time prod URLs', () => {
    const guide = readFileSync(startGuidePath, 'utf8');
    expect(guide).toContain('pnpm dev:portals');
    expect(guide).toContain('pnpm dev:hub');
    expect(guide).toContain('Portal hub');
    expect(guide).toContain('build-time only');
    expect(guide).toContain('unified-portal-env-matrix.md');
    expect(guide).toContain('localhost:5500');
    expect(guide).toContain(DEV_PORTALS.tenant);
  });

  it('Phase 6 runbook documents hosts recipe and no ingress for daily dev', () => {
    const runbook = readFileSync(phase6RunbookPath, 'utf8');
    expect(runbook).toContain('enagar.enagar.local');
    expect(runbook).toContain('pnpm dev:hub');
    expect(runbook).toContain('build-time');
    expect(runbook).toContain('No reverse proxy');
  });
});
