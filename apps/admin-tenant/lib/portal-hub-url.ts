const DEFAULT_DEMO_HUB = 'https://enagar.demosites.co.in';
const DEFAULT_LOCAL_HUB = 'http://localhost:5500';

/**
 * Unified portal hub URL (citizen / tenant / state landing).
 * Override with NEXT_PUBLIC_PORTAL_HUB_URL; localhost dev defaults to port 5500 hub.
 */
export function resolvePortalHubHomeUrl(hostname?: string): string {
  const explicit = process.env.NEXT_PUBLIC_PORTAL_HUB_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const host = hostname?.toLowerCase() ?? '';
  if (host === 'localhost' || host === '127.0.0.1' || host === '') {
    return DEFAULT_LOCAL_HUB;
  }
  if (host === 'enagar.local' || host.endsWith('.enagar.local')) {
    return 'http://enagar.enagar.local:5500';
  }
  return DEFAULT_DEMO_HUB;
}
