// Phase-0 placeholder. Phase 1 (after `tenants` table lands) implements
// `applyTenantTheme(tenant)` which sets `--brand-rgb`, `--brand-fg-rgb`,
// swaps the logo, and toggles font preference based on tenant.languages_enabled.
//
// Helper preview (final API may differ):
//   import { applyTenantTheme } from '@enagar/tenant-theme';
//   applyTenantTheme(tenant); // mutates document.documentElement.style

export type ThemeTokens = {
  brandRgb: string; // 'r g b'
  brandFgRgb: string;
  logoUrl: string | null;
};

export const DEFAULT_THEME: ThemeTokens = {
  brandRgb: '15 76 117',
  brandFgRgb: '255 255 255',
  logoUrl: null,
};
