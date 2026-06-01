/**
 * Quick KMC birth-cert apply smoke — uses field ids from the live published form.
 */
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PWA = 'http://localhost:3000';
const OTP = '12345';
const UPLOAD = join(__dirname, 'fixtures', 'smoke-upload.pdf');
const mobile = `98${String(Date.now()).slice(-8)}`;

async function loginAndOpenKmcBirthCert(page) {
  await page.goto(PWA, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByRole('button', { name: /continue/i }).first().click();
  await page.getByRole('button', { name: /continue/i }).first().click();
  await page.locator('#mobile').fill(mobile);
  await page.getByRole('button', { name: /send otp/i }).click();
  await page.getByPlaceholder('12345').fill(OTP);
  await page.getByRole('button', { name: /verify and continue/i }).click();
  await page.waitForTimeout(3000);

  if (await page.getByRole('button', { name: 'Continue to hub' }).isVisible().catch(() => false)) {
    await page.locator('button').filter({ hasText: 'KMC' }).filter({ hasText: 'Kolkata' }).first().click();
    await page.getByRole('button', { name: 'Continue to hub' }).click();
    await page.waitForTimeout(2500);
  }

  await page.getByText('Citizen hub', { exact: false }).waitFor({ timeout: 30000 });
  await page.getByLabel('Citizen hub navigation').getByRole('button', { name: 'Apply', exact: true }).click();
  await page.locator('button').filter({ hasText: 'KMC' }).filter({ hasText: 'Enter workspace' }).first().click();
  await page.waitForTimeout(2000);
  await page.getByLabel('Municipality workspace navigation').getByRole('button', { name: 'Services', exact: true }).click();
  await page.waitForTimeout(1000);
  const card = page
    .locator('section.grid div')
    .filter({ has: page.getByRole('heading', { name: /Birth Certificate/i }) })
    .filter({ has: page.locator('button.mt-5.w-full') })
    .first();
  await card.locator('button.mt-5.w-full').click();
  await page.waitForTimeout(1500);
}

async function fillVisibleForm(page) {
  const fillIfPresent = async (id, value) => {
    const el = page.locator(`#${id}`);
    if (await el.count()) {
      await el.fill(value);
    }
  };

  await fillIfPresent('applicant_name', 'Smoke Retry Citizen');
  await fillIfPresent('child_name', 'Smoke Retry Child');
  await fillIfPresent('mobile', '9876543210');
  await fillIfPresent('applicant_no', '9876543210');
  await fillIfPresent('date_of_birth', '2020-06-15');
  await fillIfPresent('applicant_dob', '2020-06-15');

  if (await page.getByRole('button', { name: 'Parent', exact: true }).count()) {
    await page.getByRole('button', { name: 'Parent', exact: true }).click();
  }

  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count()) {
    await fileInput.setInputFiles(UPLOAD);
    await page.getByText(/Selected:/i).waitFor({ timeout: 8000 });
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await loginAndOpenKmcBirthCert(page);
  await fillVisibleForm(page);

  await page.getByRole('button', { name: 'Submit Application' }).click();

  let status = '';
  let docket = null;
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(500);
    status = (await page.locator('header span[title]').getAttribute('title')) ?? '';
    const match = status.match(/Submitted\s+(.+)/i);
    if (match) {
      docket = match[1].trim();
      break;
    }
    const alert = await page.locator('[role="alert"]').textContent().catch(() => null);
    if (alert?.includes('Could not submit')) {
      console.log(JSON.stringify({ ok: false, mobile, status, alert: alert.trim() }, null, 2));
      await page.screenshot({ path: join(__dirname, 'kmc-birth-cert-retry-fail.png'), fullPage: true });
      process.exit(1);
    }
  }

  if (!docket) {
    const alert = await page.locator('[role="alert"]').textContent().catch(() => null);
    console.log(JSON.stringify({ ok: false, mobile, status, alert }, null, 2));
    await page.screenshot({ path: join(__dirname, 'kmc-birth-cert-retry-fail.png'), fullPage: true });
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, mobile, docket, status }, null, 2));
  await page.screenshot({ path: join(__dirname, 'kmc-birth-cert-retry-success.png'), fullPage: true });
} finally {
  await browser.close();
}
