/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Phase-7 will add `output: 'standalone'` for the on-prem container build.
  experimental: {
    // App Router is GA in 14, but we keep typed routes for safety.
    typedRoutes: true,
  },
  transpilePackages: ['@enagar/i18n', '@enagar/tenant-theme', '@enagar/types'],
};

export default nextConfig;
