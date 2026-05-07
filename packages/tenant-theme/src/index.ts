import type { Tenant } from '@enagar/types';

export type ThemeTokens = {
  brandRgb: string; // 'r g b'
  brandFgRgb: string;
  logoUrl: string | null;
  fontFamily: string;
};

export type ThemeRoot = {
  style: {
    setProperty(name: string, value: string): void;
    removeProperty(name: string): void;
  };
};

export const DEFAULT_THEME: ThemeTokens = {
  brandRgb: '15 76 117',
  brandFgRgb: '255 255 255',
  logoUrl: null,
  fontFamily: 'Inter, system-ui, sans-serif',
};

export type ThemeableTenant = Pick<Tenant, 'theme_color' | 'logo_url' | 'languages_enabled'> & {
  code?: string;
};

export function createTenantTheme(tenant: ThemeableTenant | null | undefined): ThemeTokens {
  if (!tenant) {
    return DEFAULT_THEME;
  }

  return {
    brandRgb: hexToRgb(tenant.theme_color ?? '#0F4C75'),
    brandFgRgb: readableForegroundRgb(tenant.theme_color ?? '#0F4C75'),
    logoUrl: tenant.logo_url ?? null,
    fontFamily: resolveFontFamily(tenant.languages_enabled),
  };
}

export function applyTenantTheme(
  tenant: ThemeableTenant | null | undefined,
  root: ThemeRoot | undefined = getDocumentRoot(),
): ThemeTokens {
  const tokens = createTenantTheme(tenant);

  root?.style.setProperty('--brand-rgb', tokens.brandRgb);
  root?.style.setProperty('--brand-fg-rgb', tokens.brandFgRgb);
  root?.style.setProperty('--tenant-font-family', tokens.fontFamily);

  if (tokens.logoUrl) {
    root?.style.setProperty('--tenant-logo-url', `url("${tokens.logoUrl}")`);
  } else {
    root?.style.removeProperty('--tenant-logo-url');
  }

  return tokens;
}

export function hexToRgb(hex: string): string {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '0F4C75';
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `${red} ${green} ${blue}`;
}

function readableForegroundRgb(hex: string): string {
  const [red = 15, green = 76, blue = 117] = hexToRgb(hex).split(' ').map(Number);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

  return luminance > 0.55 ? '15 23 42' : '255 255 255';
}

function resolveFontFamily(languages: readonly string[]): string {
  if (languages[0] === 'bn') {
    return '"Noto Sans Bengali", Inter, system-ui, sans-serif';
  }
  if (languages[0] === 'hi') {
    return '"Noto Sans Devanagari", Inter, system-ui, sans-serif';
  }
  return DEFAULT_THEME.fontFamily;
}

function getDocumentRoot(): ThemeRoot | undefined {
  const maybeDocument = (globalThis as { document?: { documentElement?: ThemeRoot } }).document;
  return maybeDocument?.documentElement;
}
