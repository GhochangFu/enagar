import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const hubDir = join(repoRoot, 'infrastructure', 'portal-hub');

function hubFile(name: string): string {
  return readFileSync(join(hubDir, name), 'utf8');
}

describe('Unified Portal Option A — static hub (Phase 7)', () => {
  it('hub HTML exposes three portal entry points without linking enagarauth', () => {
    const html = hubFile('index.html');
    expect(html).toContain('data-portal-link="citizen"');
    expect(html).toContain('data-portal-link="tenant"');
    expect(html).toContain('data-portal-link="state"');
    expect(html.toLowerCase()).not.toContain('enagarauth');
  });

  it('hub config.js lists demo subdomains for non-local hosts', () => {
    const config = hubFile('config.js');
    expect(config).toContain('https://enagarcitizen.demosites.co.in');
    expect(config).toContain('https://enagartenant.demosites.co.in/login');
    expect(config).toContain('https://enagarstate.demosites.co.in/login');
  });

  it('maintenance.json is valid JSON with enabled flag', () => {
    const raw = hubFile('maintenance.json');
    const parsed = JSON.parse(raw) as { enabled: boolean };
    expect(typeof parsed.enabled).toBe('boolean');
  });

  it('hub ships required static assets', () => {
    const names = readdirSync(hubDir);
    expect(names).toEqual(
      expect.arrayContaining([
        'index.html',
        'config.js',
        'main.js',
        'styles.css',
        'maintenance.json',
      ]),
    );
  });
});
