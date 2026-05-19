import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.14 — UX foundation & design system v2', () => {
  const palette = readRepo('packages/tenant-theme/src/palette.ts');
  const tenantTheme = readRepo('packages/tenant-theme/src/index.ts');
  const tricolorCss = readRepo('packages/config/styles/tricolor-calm.css');
  const tailwindBase = readRepo('packages/config/tailwind/base.js');
  const uiIndex = readRepo('packages/ui/src/index.ts');
  const storyPreview = readRepo('packages/ui/.storybook/preview.tsx');
  const citizenGlobals = readRepo('apps/citizen-pwa/app/globals.css');
  const sprintPlan = readRepo('docs/runbooks/master-sprint-614-plan.md');
  const designSystem = readRepo('docs/design-system.md');

  it('derives tenant palette tokens and platform theme without Inter default', () => {
    expect(palette).toContain('createTenantPalette');
    expect(palette).toContain('brandMutedRgb');
    expect(palette).toContain('brandSurfaceRgb');
    expect(tenantTheme).toContain('applyPlatformTheme');
    expect(tenantTheme).toContain('--brand-muted-rgb');
    expect(tenantTheme).toContain('Plus Jakarta Sans');
    expect(tenantTheme).not.toMatch(/fontFamily:\s*['"]Inter/);
  });

  it('exposes Warm Coral B+ Pro platform tokens in config and Tailwind preset', () => {
    expect(tricolorCss).toContain('--canvas-rgb');
    expect(tricolorCss).toContain('250 247 244');
    expect(tricolorCss).toContain('--forest-rgb');
    expect(tricolorCss).toContain('--mint-band-rgb');
    expect(tailwindBase).toContain('canvas:');
    expect(tailwindBase).toContain('muted:');
    expect(tailwindBase).toContain('platform-gradient');
  });

  it('ships shared UI primitives and Storybook tenant theme toolbar', () => {
    expect(uiIndex).toContain("from './components/Button'");
    expect(uiIndex).toContain("from './components/Card'");
    expect(uiIndex).toContain("from './components/PageHeader'");
    expect(storyPreview).toContain('applyTenantTheme');
    expect(storyPreview).toContain("value: 'kmc'");
    expect(storyPreview).toContain("value: 'hmc'");
    expect(storyPreview).toContain("value: 'cmc'");
  });

  it('wires Tricolor Calm CSS into citizen globals', () => {
    expect(citizenGlobals).toContain('@enagar/config/styles/tricolor-calm.css');
    expect(citizenGlobals).toContain('--canvas-rgb');
  });

  it('documents Phase UX programme and 6.14 scope in runbooks', () => {
    expect(sprintPlan).toContain('Tricolor Calm');
    expect(sprintPlan).toContain('@enagar/ui');
    expect(sprintPlan).toContain('Storybook');
    expect(designSystem).toContain('Phase UX (Sprints 6.14–6.19)');
    expect(designSystem).toContain('Plus Jakarta Sans');
  });
});
