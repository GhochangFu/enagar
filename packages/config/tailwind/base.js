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
        surface: {
          DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised-rgb) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'rgb(var(--sidebar-rgb) / <alpha-value>)',
          muted: 'rgb(var(--sidebar-muted-rgb) / <alpha-value>)',
          border: 'rgb(var(--sidebar-border-rgb) / <alpha-value>)',
        },
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
          band: 'rgb(var(--platform-band-rgb) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          fg: 'rgb(var(--brand-fg-rgb) / <alpha-value>)',
          muted: 'rgb(var(--brand-muted-rgb) / <alpha-value>)',
          surface: 'rgb(var(--brand-surface-rgb) / <alpha-value>)',
          hover: 'rgb(var(--brand-hover-rgb) / <alpha-value>)',
        },
        ink: {
          primary: 'rgb(var(--text-primary-rgb) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
          muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
          onDark: 'rgb(var(--ink-on-dark-rgb) / <alpha-value>)',
          onDarkMuted: 'rgb(var(--ink-on-dark-muted-rgb) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success-rgb) / <alpha-value>)',
          bg: 'rgb(var(--success-bg-rgb) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning-rgb) / <alpha-value>)',
          bg: 'rgb(var(--warning-bg-rgb) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger-rgb) / <alpha-value>)',
          bg: 'rgb(var(--danger-bg-rgb) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info-rgb) / <alpha-value>)',
          bg: 'rgb(var(--info-bg-rgb) / <alpha-value>)',
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
