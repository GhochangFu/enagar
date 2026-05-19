import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Citizen PWA — Warm Coral B+ Pro palette', () => {
  const tricolorCss = readRepo('packages/config/styles/tricolor-calm.css');
  const tenantTheme = readRepo('packages/tenant-theme/src/index.ts');
  const authFlow = readRepo('apps/citizen-pwa/components/citizen-auth-flow.tsx');
  const page = readRepo('apps/citizen-pwa/app/page.tsx');
  const manifest = readRepo('apps/citizen-pwa/app/manifest.ts');

  it('locks warm white canvas and forest tokens in platform CSS', () => {
    expect(tricolorCss).toContain('250 247 244');
    expect(tricolorCss).toContain('--forest-rgb: 74 107 71');
    expect(tricolorCss).toContain('--platform-accent-rgb: 191 74 10');
    expect(tricolorCss).not.toContain('linear-gradient');
    expect(tricolorCss).not.toContain('radial-gradient');
  });

  it('uses applyPlatformTheme for hub shell brand', () => {
    expect(tenantTheme).toContain('PLATFORM_BRAND_HEX');
    expect(tenantTheme).toContain("'#BF4A0A'");
    expect(page).toContain('applyPlatformTheme');
    expect(page).toContain('goBackToHub');
  });

  it('removes gradient backgrounds from citizen auth and hub', () => {
    expect(authFlow).toContain('bg-canvas');
    expect(authFlow).not.toContain('radial-gradient');
    expect(page).not.toContain('radial-gradient');
    expect(page).not.toContain('bg-gradient-to-br');
  });

  it('sets PWA chrome to burnt orange on warm white', () => {
    expect(manifest).toContain("theme_color: '#BF4A0A'");
    expect(manifest).toContain("background_color: '#FAF7F4'");
  });
});
