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
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        bn: ['"Noto Sans Bengali"', '"Plus Jakarta Sans"', 'sans-serif'],
        hi: ['"Noto Sans Devanagari"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        canvas: 'rgb(var(--canvas-rgb) / <alpha-value>)',
        saffron: {
          wash: 'rgb(var(--saffron-wash-rgb) / <alpha-value>)',
        },
        green: {
          wash: 'rgb(var(--green-wash-rgb) / <alpha-value>)',
        },
        platform: {
          accent: 'rgb(var(--platform-accent-rgb) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          fg: 'rgb(var(--brand-fg-rgb) / <alpha-value>)',
          muted: 'rgb(var(--brand-muted-rgb) / <alpha-value>)',
          surface: 'rgb(var(--brand-surface-rgb) / <alpha-value>)',
        },
        ink: {
          primary: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        },
        warm: {
          border: 'rgb(var(--border-warm-rgb) / <alpha-value>)',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backgroundImage: {
        'platform-gradient':
          'linear-gradient(135deg, rgb(var(--saffron-wash-rgb)) 0%, rgb(var(--canvas-rgb)) 45%, rgb(var(--green-wash-rgb)) 100%)',
      },
    },
  },
  plugins: [],
};
