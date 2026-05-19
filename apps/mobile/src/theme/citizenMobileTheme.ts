import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { createTenantPalette, PLATFORM_BRAND_HEX } from '@enagar/tenant-theme';

/** Tricolor Calm — aligned with `packages/config/styles/tricolor-calm.css`. */
export const MOBILE_CANVAS_HEX = '#FAF7F4';
export const MOBILE_SURFACE_HEX = '#FFFFFF';
export const MOBILE_PEACH_SOFT_HEX = '#FFF0E6';
export const MOBILE_PEACH_ACCENT_HEX = '#FFCDAA';
export const MOBILE_MINT_BAND_HEX = '#E8F0E7';
export const MOBILE_SAGE_HEX = '#9CB898';

export const MOBILE_INK_PRIMARY = '#2B211F';
export const MOBILE_INK_SECONDARY = '#5C4A47';
export const MOBILE_INK_MUTED = '#7A6561';
export const MOBILE_WARM_BORDER = '#E8DDD6';
export const MOBILE_FOREST_HEX = '#4A6B47';
export const MOBILE_LINK_HEX = '#7A3A12';

export const MOBILE_ERROR_HEX = '#B91C1C';
export const MOBILE_SUCCESS_HEX = '#166534';
export const MOBILE_WARNING_HEX = '#B45309';

export const MOBILE_RADIUS_SM = 12;
export const MOBILE_RADIUS_MD = 16;
export const MOBILE_RADIUS_LG = 22;
export const MOBILE_RADIUS_PILL = 999;

export const MOBILE_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const MOBILE_MIN_TOUCH = 44;

/** Hub / picker / OTP before a ULB is selected. */
export function platformBrandHex(): string {
  return PLATFORM_BRAND_HEX;
}

/** ULB workspace brand from public tenant list `theme_color`. */
export function resolveTenantBrandHex(themeColor?: string | null): string {
  if (themeColor && /^#[0-9a-f]{6}$/i.test(themeColor)) {
    return themeColor;
  }
  return platformBrandHex();
}

export function readableOnBrandHex(brandHex: string): string {
  const palette = createTenantPalette(brandHex);
  const [red = 255, green = 255, blue = 255] = palette.brandFgRgb.split(' ').map(Number);
  return `rgb(${red}, ${green}, ${blue})`;
}

export const mobileShadowCard: ViewStyle = Platform.select({
  ios: {
    shadowColor: MOBILE_INK_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
  default: {},
}) as ViewStyle;

export const mobileTypography = {
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: MOBILE_INK_MUTED,
  } satisfies TextStyle,
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: MOBILE_INK_PRIMARY,
  } satisfies TextStyle,
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: MOBILE_INK_SECONDARY,
  } satisfies TextStyle,
  section: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: MOBILE_FOREST_HEX,
  } satisfies TextStyle,
  kpiValue: {
    fontSize: 28,
    fontWeight: '800',
    color: MOBILE_FOREST_HEX,
  } satisfies TextStyle,
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MOBILE_INK_SECONDARY,
  } satisfies TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: MOBILE_INK_SECONDARY,
  } satisfies TextStyle,
  caption: {
    fontSize: 12,
    fontWeight: '600',
    color: MOBILE_INK_MUTED,
  } satisfies TextStyle,
};

export const mobileLayout = {
  screenPaddingX: 16,
  screenPaddingTop: 8,
  screenPaddingBottom: 32,
  cardPadding: 16,
  gap: 12,
};
