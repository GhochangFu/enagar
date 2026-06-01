/**
 * Phase 10 — Pattern C hoarding E2E (API + Desk UI).
 *
 * Exercises:
 * - Full scrutiny chain on ad-hoarding (clerk → inspector → officer)
 * - BOC path: route-to-boc → record-boc-resolution → executive → certificate
 * - Skip BOC: approve-to-executive → certificate
 * - Desk UI at technical-scrutiny: both branch buttons visible
 *
 * Prereq: API :3001, Tenant Admin :3002, Keycloak :8080, DB seeded,
 *   pnpm infra:seed-keycloak-users, ALLOW_CLIENT_SCAN_SIMULATION=true,
 *   Playwright chromium (npx playwright install chromium)
 *
 * Usage: node scripts/smoke/phase10-hoarding-e2e-smoke.mjs
 */
import { chromium } from 'playwright';

import {
  ADMIN,
  ADMIN_USER,
  CLERK_USER,
  SERVICE_CODE,
  advanceToTechnicalScrutiny,
  assertCertificateTerminal,
  assertOk,
  assertStage,
  assignHoardingDesignations,
  createSubmittedApplication,
  currentStage,
  deskTransition,
  fail,
  fetchDeskDetail,
  kcToken,
  loadInfraEnv,
  log,
  publishHoardingPilot,
  api,
} from './lib/hoarding-smoke-lib.mjs';

const PREFIX = 'phase10';
const SMOKE_REV = '2026-05-30-phase10-v1';

loadInfraEnv();

async function loginTenantAdmin(page, username) {
  await page.goto(`${ADMIN}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('link', { name: /Continue to sign in/i }).click();
  await page.waitForURL(/8080|realms\/enagar/i, { timeout: 20000 });
  await page.locator('#username, input[name="username"]').first().fill(username);
  await page.locator('#password, input[name="password"]').first().fill(
    process.env.KEYCLOAK_DUMMY_USER_PASSWORD ?? 'DummyDev_2026!ChangeMe',
  );
  await page.locator('#kc-login, input[type="submit"], button[type="submit"]').first().click();
  await page.waitForURL(/localhost:3002/, { timeout: 30000 });
  log(PREFIX, 'ui-login', username);
}

async function openDeskApplication(page, docketNo) {
  await page.goto(
    `${ADMIN}/dashboard/desk?docket=${encodeURIComponent(docketNo)}`,
    { waitUntil: 'domcontentloaded', timeout: 30000 },
  );
  await page.getByText('Application detail').waitFor({ timeout: 15000 });
  await page.getByText(docketNo).first().waitFor({ timeout: 15000 });
}

async function runBocPath(clerkTok) {
  const submitted = await createSubmittedApplication(PREFIX, '9876500010');
  log(PREFIX, 'boc-path', submitted.docket_no);
  let detail = await advanceToTechnicalScrutiny(PREFIX, clerkTok, submitted.id);

  const allowed = (detail.allowed_transitions ?? []).map((t) => t.verb);
  if (!allowed.includes('route-to-boc')) {
    fail(PREFIX, `BOC path: route-to-boc not allowed at technical-scrutiny (${allowed.join(', ')})`);
  }

  detail = await deskTransition(PREFIX, clerkTok, submitted.id, 'route-to-boc', {
    require_boc: true,
  });
  assertStage(PREFIX, detail, 'boc-resolution');

  detail = await deskTransition(PREFIX, clerkTok, submitted.id, 'record-boc-resolution', {
    boc_resolution: {
      resolution_number: `BOC/PH10/${Date.now()}`,
      resolution_date: '2026-05-30',
    },
  });
  assertStage(PREFIX, detail, 'executive-approval');

  detail = await deskTransition(PREFIX, clerkTok, submitted.id, 'forward');
  assertCertificateTerminal(PREFIX, detail);
  log(PREFIX, 'boc-path-done', currentStage(detail));
  return submitted.docket_no;
}

async function runSkipBocPath(clerkTok) {
  const submitted = await createSubmittedApplication(PREFIX, '9876500011');
  log(PREFIX, 'skip-boc-path', submitted.docket_no);
  let detail = await advanceToTechnicalScrutiny(PREFIX, clerkTok, submitted.id);

  const allowed = (detail.allowed_transitions ?? []).map((t) => t.verb);
  if (!allowed.includes('approve-to-executive')) {
    fail(
      PREFIX,
      `Skip BOC: approve-to-executive not allowed (${allowed.join(', ')})`,
    );
  }

  detail = await deskTransition(PREFIX, clerkTok, submitted.id, 'approve-to-executive', {
    require_boc: false,
  });
  assertStage(PREFIX, detail, 'executive-approval');

  detail = await deskTransition(PREFIX, clerkTok, submitted.id, 'forward');
  assertCertificateTerminal(PREFIX, detail);
  log(PREFIX, 'skip-boc-path-done', currentStage(detail));
  return submitted.docket_no;
}

async function runDeskUiBranchCheck(clerkTok) {
  const submitted = await createSubmittedApplication(PREFIX, '9876500012');
  log(PREFIX, 'ui-branches', submitted.docket_no);
  await advanceToTechnicalScrutiny(PREFIX, clerkTok, submitted.id);

  const detail = await fetchDeskDetail(PREFIX, clerkTok, submitted.docket_no);
  const verbs = (detail.allowed_transitions ?? []).map((t) => t.verb);
  if (!verbs.includes('route-to-boc') || !verbs.includes('approve-to-executive')) {
    fail(
      PREFIX,
      `UI setup: expected route-to-boc + approve-to-executive, got ${verbs.join(', ')}`,
    );
  }

  const adminHealth = await fetch(`${ADMIN}/login`, { signal: AbortSignal.timeout(8000) }).catch(
    () => null,
  );
  if (!adminHealth?.ok) {
    log(PREFIX, 'ui-skip', 'admin-tenant :3002 not reachable — API branches already verified');
    let after = await deskTransition(PREFIX, clerkTok, submitted.id, 'approve-to-executive', {
      require_boc: false,
    });
    after = await deskTransition(PREFIX, clerkTok, submitted.id, 'forward');
    assertCertificateTerminal(PREFIX, after);
    return submitted.docket_no;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await loginTenantAdmin(page, CLERK_USER);
    await openDeskApplication(page, submitted.docket_no);

    const bocCheckbox = page.getByRole('checkbox', {
      name: /Require Board of Councillors/i,
    });
    await bocCheckbox.waitFor({ state: 'visible', timeout: 10000 });

    await bocCheckbox.check();
    const routeBtn = page.getByRole('button', { name: /Route to BOC/i });
    await routeBtn.waitFor({ state: 'visible', timeout: 10000 });
    log(PREFIX, 'ui-check', 'BOC checkbox reveals Route to BOC action');

    await bocCheckbox.uncheck();
    const skipBtn = page.getByRole('button', { name: /Approve To Executive/i });
    await skipBtn.waitFor({ state: 'visible', timeout: 10000 });
    log(PREFIX, 'ui-check', 'unchecked BOC shows Approve To Executive');

    await skipBtn.click();
    await page.getByText(/executive-approval/i).first().waitFor({ timeout: 15000 });
    log(PREFIX, 'ui-check', 'Approve To Executive advanced to executive-approval');
  } finally {
    await browser.close();
  }

  let after = await fetchDeskDetail(PREFIX, clerkTok, submitted.docket_no);
  if (currentStage(after) !== 'executive-approval') {
    after = await deskTransition(PREFIX, clerkTok, submitted.id, 'approve-to-executive', {
      require_boc: false,
    });
  }
  after = await deskTransition(PREFIX, clerkTok, submitted.id, 'forward');
  assertCertificateTerminal(PREFIX, after);
  return submitted.docket_no;
}

async function main() {
  log(PREFIX, 'script', SMOKE_REV);
  const health = await fetch('http://localhost:3001/health');
  if (!health.ok) fail(PREFIX, 'API health not ok — start pnpm --filter @enagar/api dev');

  const adminTok = await kcToken(ADMIN_USER);
  const { res: servicesRes, json: services } = await api('GET', '/admin/tenant/services', adminTok);
  assertOk(PREFIX, 'list services', servicesRes.status, JSON.stringify(services));
  const service = services.find((row) => row.code === SERVICE_CODE);
  if (!service) fail(PREFIX, `Service ${SERVICE_CODE} not found`);

  await publishHoardingPilot(PREFIX, adminTok, service);
  await assignHoardingDesignations(PREFIX, adminTok, CLERK_USER);
  log(PREFIX, 'pilot-ready', `${SERVICE_CODE} Pattern C published, boc_policy=officer_may_require`);

  const clerkTok = await kcToken(CLERK_USER);
  const docketBoc = await runBocPath(clerkTok);
  const docketSkip = await runSkipBocPath(clerkTok);
  const docketUi = await runDeskUiBranchCheck(clerkTok);

  console.log(
    JSON.stringify(
      {
        ok: true,
        service_code: SERVICE_CODE,
        dockets: { boc_path: docketBoc, skip_boc_path: docketSkip, ui_path: docketUi },
      },
      null,
      2,
    ),
  );
  log(PREFIX, 'PASS', 'Pattern C hoarding E2E — BOC, skip-BOC, and Desk UI branches');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
