import './load-infra-env.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Lint runs in CI (`pnpm lint`); skip during VM/prod build if native ESLint resolver is missing.
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_ALLOW_CLIENT_SCAN_SIMULATION:
      process.env.NEXT_PUBLIC_ALLOW_CLIENT_SCAN_SIMULATION ?? 'false',
  },
  // Phase-7 will add `output: 'standalone'` for the on-prem container build.
  experimental: {
    // App Router is GA in 14, but we keep typed routes for safety.
    typedRoutes: true,
  },
  transpilePackages: [
    '@enagar/forms',
    '@enagar/i18n',
    '@enagar/tenant-theme',
    '@enagar/types',
    '@enagar/ui',
  ],
  webpack(config) {
    // Workspace packages use TypeScript ESM `.js` import specifiers; map to `.ts` sources.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
