import { createTenantPalette, type RgbTriple, type TenantPalette } from './palette.js';

import type { Tenant } from '@enagar/types';

export type { RgbTriple, TenantPalette };
export {
  contrastRatio,
  createTenantPalette,
  hexToRgb,
  mixWithWhite,
  parseRgbTriple,
  readableForegroundRgb,
  relativeLuminance,
} from './palette.js';

export type ThemeTokens = TenantPalette & {
  logoUrl: string | null;
  fontFamily: string;
};

export type ThemeRoot = {
  style: {
    setProperty(name: string, value: string): void;
    removeProperty(name: string): void;
  };
};

const PLUS_JAKARTA = '"Plus Jakarta Sans", system-ui, sans-serif';

export const DEFAULT_THEME: ThemeTokens = {
  ...createTenantPalette('#0F4C75'),
  logoUrl: null,
  fontFamily: PLUS_JAKARTA,
};

export type ThemeableTenant = Pick<Tenant, 'theme_color' | 'logo_url' | 'languages_enabled'> & {
  code?: string;
};

export function createTenantTheme(tenant: ThemeableTenant | null | undefined): ThemeTokens {
  if (!tenant) {
    return { ...DEFAULT_THEME };
  }

  const palette = createTenantPalette(tenant.theme_color ?? '#0F4C75');

  return {
    ...palette,
    logoUrl: tenant.logo_url ?? null,
    fontFamily: resolveFontFamily(tenant.languages_enabled),
  };
}

function applyPaletteToRoot(palette: TenantPalette, root: ThemeRoot | undefined): void {
  root?.style.setProperty('--brand-rgb', palette.brandRgb);
  root?.style.setProperty('--brand-fg-rgb', palette.brandFgRgb);
  root?.style.setProperty('--brand-muted-rgb', palette.brandMutedRgb);
  root?.style.setProperty('--brand-surface-rgb', palette.brandSurfaceRgb);
}

export function applyTenantTheme(
  tenant: ThemeableTenant | null | undefined,
  root: ThemeRoot | undefined = getDocumentRoot(),
): ThemeTokens {
  const tokens = createTenantTheme(tenant);
  applyPaletteToRoot(tokens, root);
  root?.style.setProperty('--tenant-font-family', tokens.fontFamily);

  if (tokens.logoUrl) {
    root?.style.setProperty('--tenant-logo-url', `url("${tokens.logoUrl}")`);
  } else {
    root?.style.removeProperty('--tenant-logo-url');
  }

  return tokens;
}

/** Hub / statewide shell — Tricolor Calm platform canvas without a selected ULB. */
export function applyPlatformTheme(root: ThemeRoot | undefined = getDocumentRoot()): ThemeTokens {
  const tokens = { ...DEFAULT_THEME, fontFamily: PLUS_JAKARTA };
  applyPaletteToRoot(tokens, root);
  root?.style.setProperty('--tenant-font-family', PLUS_JAKARTA);
  root?.style.removeProperty('--tenant-logo-url');
  return tokens;
}

function resolveFontFamily(languages: readonly string[]): string {
  if (languages[0] === 'bn') {
    return '"Noto Sans Bengali", "Plus Jakarta Sans", system-ui, sans-serif';
  }
  if (languages[0] === 'hi') {
    return '"Noto Sans Devanagari", "Plus Jakarta Sans", system-ui, sans-serif';
  }
  return PLUS_JAKARTA;
}

function getDocumentRoot(): ThemeRoot | undefined {
  const maybeDocument = (globalThis as { document?: { documentElement?: ThemeRoot } }).document;
  return maybeDocument?.documentElement;
}
