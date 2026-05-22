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
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        bn: ['"Noto Sans Bengali"', '"DM Sans"', 'sans-serif'],
        hi: ['"Noto Sans Devanagari"', '"DM Sans"', 'sans-serif'],
      },
      colors: {
        canvas: 'rgb(var(--canvas-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        peach: {
          accent: 'rgb(var(--peach-accent-rgb) / <alpha-value>)',
          soft: 'rgb(var(--peach-soft-rgb) / <alpha-value>)',
        },
        saffron: {
          wash: 'rgb(var(--saffron-wash-rgb) / <alpha-value>)',
        },
        mint: {
          band: 'rgb(var(--mint-band-rgb) / <alpha-value>)',
        },
        sage: 'rgb(var(--sage-rgb) / <alpha-value>)',
        forest: 'rgb(var(--forest-rgb) / <alpha-value>)',
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
          muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        },
        warm: {
          border: 'rgb(var(--border-warm-rgb) / <alpha-value>)',
        },
        link: 'rgb(var(--link-rgb) / <alpha-value>)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backgroundImage: {
        /* Solid canvas alias — use `bg-canvas` in new code; kept for compat */
        'platform-gradient': 'linear-gradient(rgb(var(--canvas-rgb)), rgb(var(--canvas-rgb)))',
      },
    },
  },
  plugins: [],
};
