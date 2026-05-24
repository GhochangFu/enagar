/**
 * Portal hub link targets — auto-detected from hostname.
 * Local: open via localhost static server → localhost app ports.
 * Demo/prod: enagar.* host → demosites.co.in subdomains.
 */
(function initPortalConfig(global) {
  const hostname = global.location?.hostname ?? '';
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '' ||
    global.location?.protocol === 'file:';
  const isEnagarLocal =
    hostname === 'enagar.local' || hostname.endsWith('.enagar.local');

  /** @type {{ citizen: string; tenant: string; state: string; env: 'local' | 'demo' }} */
  const links = isLocalhost
    ? {
        env: 'local',
        citizen: 'http://localhost:3000',
        tenant: 'http://localhost:3002/login',
        state: 'http://localhost:3003/login',
      }
    : isEnagarLocal
      ? {
          env: 'local',
          citizen: 'http://enagarcitizen.enagar.local:3000',
          tenant: 'http://enagartenant.enagar.local:3002/login',
          state: 'http://enagarstate.enagar.local:3003/login',
        }
      : {
          env: 'demo',
          citizen: 'https://enagarcitizen.demosites.co.in',
          tenant: 'https://enagartenant.demosites.co.in/login',
          state: 'https://enagarstate.demosites.co.in/login',
        };

  global.PORTAL_LINKS = links;
})(typeof window !== 'undefined' ? window : globalThis);
