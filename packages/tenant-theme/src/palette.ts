/** RGB triple as space-separated string, e.g. `15 76 117`. */
export type RgbTriple = `${number} ${number} ${number}`;

export type TenantPalette = {
  brandRgb: RgbTriple;
  brandFgRgb: RgbTriple;
  brandMutedRgb: RgbTriple;
  brandSurfaceRgb: RgbTriple;
};

const PLATFORM_DEFAULT_HEX = '#0F4C75';

export function parseRgbTriple(value: string): [number, number, number] {
  const parts = value
    .trim()
    .split(/\s+/)
    .map((part) => Number(part));
  if (parts.length !== 3 || parts.some((channel) => Number.isNaN(channel))) {
    return [15, 76, 117];
  }
  return [parts[0]!, parts[1]!, parts[2]!];
}

export function rgbTriple([red, green, blue]: [number, number, number]): RgbTriple {
  const clamp = (channel: number) => Math.max(0, Math.min(255, Math.round(channel)));
  return `${clamp(red)} ${clamp(green)} ${clamp(blue)}`;
}

/** Mix brand toward white (amount 0 = brand, 1 = white). */
export function mixWithWhite(brandRgb: RgbTriple, amount: number): RgbTriple {
  const [r, g, b] = parseRgbTriple(brandRgb);
  const t = Math.max(0, Math.min(1, amount));
  return rgbTriple([r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t]);
}

export function hexToRgb(hex: string): RgbTriple {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : PLATFORM_DEFAULT_HEX.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return rgbTriple([red, green, blue]);
}

export function readableForegroundRgb(hex: string): RgbTriple {
  const brand = hexToRgb(hex);
  const [red, green, blue] = parseRgbTriple(brand);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.55 ? '15 23 42' : '255 255 255';
}

/** Derive brand, foreground, muted fill, and surface wash from a tenant hex colour. */
export function createTenantPalette(themeColorHex: string): TenantPalette {
  const brandRgb = hexToRgb(themeColorHex);
  return {
    brandRgb,
    brandFgRgb: readableForegroundRgb(themeColorHex),
    brandMutedRgb: mixWithWhite(brandRgb, 0.88),
    brandSurfaceRgb: mixWithWhite(brandRgb, 0.92),
  };
}

/** WCAG relative luminance for contrast checks (sRGB). */
export function relativeLuminance(rgb: RgbTriple): number {
  const channels = parseRgbTriple(rgb).map((value) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function contrastRatio(foreground: RgbTriple, background: RgbTriple): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
