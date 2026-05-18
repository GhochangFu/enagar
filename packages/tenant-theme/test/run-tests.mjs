import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyPlatformTheme, createTenantTheme } from '../dist/index.js';
import {
  contrastRatio,
  createTenantPalette,
  hexToRgb,
  mixWithWhite,
  readableForegroundRgb,
} from '../dist/palette.js';

test('hexToRgb normalizes valid hex', () => {
  assert.equal(hexToRgb('#0F4C75'), '15 76 117');
});

test('hexToRgb falls back for invalid hex', () => {
  assert.equal(hexToRgb('not-a-color'), '15 76 117');
});

test('createTenantPalette derives muted and surface tints', () => {
  const kmc = createTenantPalette('#0F4C75');
  assert.equal(kmc.brandRgb, '15 76 117');
  assert.notEqual(kmc.brandMutedRgb, kmc.brandRgb);
  assert.notEqual(kmc.brandSurfaceRgb, kmc.brandRgb);
  assert.ok(kmc.brandMutedRgb.startsWith('2'));
});

test('readableForegroundRgb picks dark text on light brand', () => {
  assert.equal(readableForegroundRgb('#FDE68A'), '15 23 42');
  assert.equal(readableForegroundRgb('#0F4C75'), '255 255 255');
});

test('brand foreground on solid brand meets AA contrast for KMC sample', () => {
  const palette = createTenantPalette('#0F4C75');
  const ratio = contrastRatio(palette.brandFgRgb, palette.brandRgb);
  assert.ok(ratio >= 4.5, `expected >= 4.5, got ${ratio}`);
});

test('ink primary on muted wash meets AA contrast for badge labels', () => {
  const palette = createTenantPalette('#0F4C75');
  const ratio = contrastRatio('28 25 23', palette.brandMutedRgb);
  assert.ok(ratio >= 4.5, `expected >= 4.5, got ${ratio}`);
});

test('mixWithWhite approaches white', () => {
  assert.equal(mixWithWhite('15 76 117', 1), '255 255 255');
});

test('createTenantTheme uses Plus Jakarta for English', () => {
  const theme = createTenantTheme({
    theme_color: '#1B5E20',
    logo_url: null,
    languages_enabled: ['en'],
  });
  assert.match(theme.fontFamily, /Plus Jakarta Sans/);
  assert.doesNotMatch(theme.fontFamily, /^Inter/);
});

test('applyPlatformTheme tokens match default KMC palette', () => {
  const mockRoot = { props: {}, style: new Map() };
  mockRoot.style.setProperty = (name, value) => mockRoot.style.set(name, value);
  mockRoot.style.removeProperty = (name) => mockRoot.style.delete(name);

  const tokens = applyPlatformTheme(mockRoot);
  assert.equal(mockRoot.style.get('--brand-muted-rgb'), tokens.brandMutedRgb);
  assert.equal(mockRoot.style.get('--brand-surface-rgb'), tokens.brandSurfaceRgb);
});
