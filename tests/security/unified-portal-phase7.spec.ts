import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

const phase7Docs = [
  'docs/runbooks/unified-portal-vm-setup-beginner.md',
  'docs/runbooks/unified-portal-manual-qa.md',
  'docs/runbooks/unified-portal-security-review.md',
  'docs/runbooks/unified-portal-option-a-exit.md',
];

describe('Unified Portal Option A — Phase 7 verification package', () => {
  it('ships Phase 7 runbooks for VM setup, manual QA, and security review', () => {
    for (const doc of phase7Docs) {
      expect(existsSync(join(repoRoot, doc))).toBe(true);
    }
  });

  it('beginner VM guide walks through infra, builds, Caddy, and smoke test', () => {
    const guide = readFileSync(
      join(repoRoot, 'docs/runbooks/unified-portal-vm-setup-beginner.md'),
      'utf8',
    );
    expect(guide).toContain('pnpm infra:up');
    expect(guide).toContain('pnpm build:portal-demo');
    expect(guide).toContain('Caddyfile');
    expect(guide).toContain('unified-portal-manual-qa.md');
    expect(guide).toContain('443');
  });

  it('manual QA script covers plan test matrix flows A-01 through A-10', () => {
    const qa = readFileSync(join(repoRoot, 'docs/runbooks/unified-portal-manual-qa.md'), 'utf8');
    for (const id of [
      'A-01',
      'A-02',
      'A-03',
      'A-04',
      'A-05',
      'A-06',
      'A-07',
      'A-08',
      'A-09',
      'A-10',
    ]) {
      expect(qa).toContain(id);
    }
    expect(qa).toContain('enagar.demosites.co.in');
  });

  it('exit checklist links to VM setup and Phase 5/4 runbooks', () => {
    const exit = readFileSync(
      join(repoRoot, 'docs/runbooks/unified-portal-option-a-exit.md'),
      'utf8',
    );
    expect(exit).toContain('unified-portal-vm-setup-beginner.md');
    expect(exit).toContain('unified-portal-manual-qa.md');
    expect(exit).toContain('unified-portal-cors-phase5.md');
  });

  it('security review covers TLS, CORS, cookies, and NSG exposure', () => {
    const review = readFileSync(
      join(repoRoot, 'docs/runbooks/unified-portal-security-review.md'),
      'utf8',
    );
    expect(review).toContain('HSTS');
    expect(review).toContain('CORS');
    expect(review).toContain('443');
    expect(review).toContain('DEV_AUTH_ENABLED=false');
  });

  it('Caddyfile template reverse-proxies all six demo hosts', () => {
    const caddy = readFileSync(
      join(repoRoot, 'infrastructure/ingress/Caddyfile.demosites'),
      'utf8',
    );
    for (const host of [
      'enagar.demosites.co.in',
      'enagarcitizen.demosites.co.in',
      'enagartenant.demosites.co.in',
      'enagarstate.demosites.co.in',
      'enagarapi.demosites.co.in',
      'enagarauth.demosites.co.in',
    ]) {
      expect(caddy).toContain(host);
    }
  });
});
