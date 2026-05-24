/**
 * Portal hub — apply link targets and optional maintenance banner.
 */
(function initPortalHub() {
  const links = window.PORTAL_LINKS;
  if (!links) return;

  const envPill = document.getElementById('env-pill');
  if (envPill) {
    envPill.textContent = links.env === 'local' ? 'Local dev' : 'Demo';
    envPill.dataset.env = links.env;
  }

  const linkMap = {
    citizen: links.citizen,
    tenant: links.tenant,
    state: links.state,
  };

  for (const [key, href] of Object.entries(linkMap)) {
    const anchor = document.querySelector(`[data-portal-link="${key}"]`);
    if (anchor instanceof HTMLAnchorElement) {
      anchor.href = href;
    }
  }

  loadMaintenanceBanner();
})();

async function loadMaintenanceBanner() {
  const banner = document.getElementById('maintenance-banner');
  if (!(banner instanceof HTMLElement)) return;

  try {
    const response = await fetch('./maintenance.json', { cache: 'no-store' });
    if (!response.ok) return;

    const data = await response.json();
    if (!data?.enabled) return;

    const titleEl = banner.querySelector('.maintenance-banner__title');
    const messageEl = banner.querySelector('.maintenance-banner__message');
    const inner = banner.querySelector('.maintenance-banner__inner');

    if (titleEl instanceof HTMLElement && data.title) {
      titleEl.textContent = data.title;
    }
    if (messageEl instanceof HTMLElement && data.message) {
      messageEl.textContent = data.message;
    }
    if (inner instanceof HTMLElement && data.severity) {
      inner.dataset.severity = data.severity;
    }

    banner.classList.add('is-visible');
    banner.setAttribute('role', 'status');
  } catch {
    /* file:// or offline — banner stays hidden */
  }
}
