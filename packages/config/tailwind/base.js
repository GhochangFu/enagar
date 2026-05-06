// Shared Tailwind preset. Apps extend with their own `content` globs.
//
// Tenant-theme colours are NOT hard-coded here — they're set as CSS
// variables at runtime by `@enagar/tenant-theme`. The tokens below are
// the *base* design system; tenants override only the brand hue.

/** @type {Partial<import('tailwindcss').Config>} */
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        // Tenant-agnostic fonts; per-language families resolved at runtime.
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        bn: ['"Noto Sans Bengali"', '"Plus Jakarta Sans"', 'sans-serif'],
        hi: ['"Noto Sans Devanagari"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        // Brand uses CSS vars so a tenant can re-skin without rebuilds.
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          fg: 'rgb(var(--brand-fg-rgb) / <alpha-value>)',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
