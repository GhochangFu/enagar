/**
 * Citizen PWA smoke test — applies every published service for every operational tenant.
 * Run: node scripts/smoke/citizen-services-smoke.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PWA = process.env.SMOKE_PWA_URL ?? 'http://localhost:3000';
const API = process.env.SMOKE_API_URL ?? 'http://localhost:3001/api';
const OTP = process.env.DEV_OTP_CODE ?? '12345';
const UPLOAD = join(__dirname, 'fixtures', 'smoke-upload.pdf');

const TENANTS = ['KMC', 'HMC', 'CMC', 'BMC', 'SMC', 'AMC', 'DMC', 'SDDM'];

const CHOICE_LABELS = {
  parent: 'Parent',
  guardian: 'Guardian',
  food: 'Food',
  retail: 'Retail',
  industrial: 'Industrial',
  owner: 'Owner',
  tenant: 'Tenant',
  yes: 'Yes',
  no: 'No',
};

const SERVICE_FORMS = {
  'birth-cert': {
    text: {
      applicant_name: 'Smoke Citizen',
      mobile: '9876543210',
      child_name: 'Smoke Child',
      date_of_birth: '2020-06-15',
    },
    choices: { relationship: 'parent' },
    files: ['hospital_discharge'],
  },
  'trade-licence': {
    text: {
      applicant_name: 'Smoke Citizen',
      business_name: 'Smoke Business LLP',
    },
    choices: { trade_type: 'retail' },
    files: ['premises_proof'],
  },
  'prop-tax': {
    text: { holding_number: 'KMC-064-PARK-12B' },
    choices: { payer_type: 'owner' },
    files: [],
  },
  'community-hall': {
    text: {
      applicant_name: 'Smoke Citizen',
      event_date: '2026-12-15',
      guest_count: '75',
      event_details:
        'Smoke test community hall booking for municipal services QA validation run.',
    },
    choices: {},
    files: [],
  },
  rti: {
    text: {
      applicant_name: 'Smoke Citizen',
      information_requested:
        'Under RTI please provide all municipal records related to this smoke test filing for QA validation purposes only.',
    },
    choices: { bpl_applicant: 'no' },
    files: [],
  },
};

async function fetchServices(tenantCode) {
  const res = await fetch(`${API}/services/tenants/${tenantCode}`);
  if (!res.ok) {
    throw new Error(`services ${tenantCode}: ${res.status}`);
  }
  return res.json();
}

async function loginCitizen(page, mobile) {
  await page.goto(PWA, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /continue/i }).first().click();
  await page.getByRole('button', { name: /continue/i }).first().click();
  await page.locator('#mobile').fill(mobile);
  await page.getByRole('button', { name: /send otp/i }).click();
  await page.getByPlaceholder('12345').fill(OTP);
  await page.getByRole('button', { name: /verify and continue/i }).click();
  await page.waitForTimeout(3000);

  const pinsVisible = await page.getByRole('button', { name: 'Continue to hub' }).isVisible().catch(() => false);
  if (pinsVisible) {
    await page.locator('button').filter({ hasText: 'KMC' }).filter({ hasText: 'Pin' }).first().click();
    await page.getByRole('button', { name: 'Continue to hub' }).click();
    await page.waitForTimeout(2000);
  }

  await page.getByText('Citizen hub').waitFor({ timeout: 20000 });
}

async function enterTenantWorkspace(page, tenantCode) {
  await page.getByLabel('Citizen hub navigation').getByRole('button', { name: 'Apply', exact: true }).click();
  await page.waitForTimeout(800);
  const card = page.locator('button').filter({ hasText: tenantCode }).filter({ hasText: 'Enter workspace' });
  await card.first().click();
  await page.waitForTimeout(2000);
  await page.getByText(`${tenantCode} selected`).waitFor({ timeout: 15000 }).catch(() => {});
}

const FIELD_LABELS = {
  applicant_name: 'Applicant name',
  mobile: 'Mobile number',
  child_name: 'Child name',
  date_of_birth: 'Date of birth',
  business_name: 'Business name',
  holding_number: 'Holding number',
  event_date: 'Event date',
  guest_count: 'Guest count',
  event_details: 'Event details',
  information_requested: 'Information requested',
};

async function fillServiceForm(page, serviceCode) {
  const spec = SERVICE_FORMS[serviceCode];
  if (!spec) {
    throw new Error(`No smoke form spec for ${serviceCode}`);
  }

  for (const [fieldId, value] of Object.entries(spec.text)) {
    const label = FIELD_LABELS[fieldId];
    if (!label) {
      continue;
    }
    const control = page.getByLabel(label, { exact: false }).first();
    await control.waitFor({ state: 'visible', timeout: 8000 });
    await control.fill(String(value));
  }

  for (const [, choiceValue] of Object.entries(spec.choices)) {
    const label = CHOICE_LABELS[choiceValue] ?? choiceValue;
    await page.getByRole('button', { name: label, exact: true }).first().click();
  }

  for (const _fileField of spec.files) {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(UPLOAD);
    await page.getByText(/Selected:/i).waitFor({ timeout: 8000 });
  }
}

async function applyService(page, serviceCode, serviceName) {
  await page
    .getByLabel('Municipality workspace navigation')
    .getByRole('button', { name: 'Services', exact: true })
    .click();
  await page.waitForTimeout(1200);

  const servicesGrid = page.locator('section.grid');
  const card = servicesGrid
    .locator('div')
    .filter({
      has: page.getByRole('heading', {
        name: new RegExp(serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      }),
    })
    .filter({ has: page.locator('button.mt-5.w-full') })
    .first();
  await card.locator('button.mt-5.w-full').click();
  await page.waitForTimeout(1500);
}

function readStatus(page) {
  return page.locator('header span[title]').getAttribute('title').catch(() => '');
}

async function submitAndCapture(page) {
  const urlBefore = page.url();
  await page.getByRole('button', { name: 'Submit Application' }).click();

  let status = '';
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    status = (await readStatus(page)) ?? '';
    if (/Submitted\s+[A-Z0-9-]+/i.test(status)) {
      const docket = status.match(/Submitted\s+([A-Z0-9-]+)/i)?.[1] ?? null;
      return { ok: true, status, docket, refreshed: page.url() !== urlBefore };
    }
    if (/failed|Fix form issues|upload failed|Unable/i.test(status)) {
      return { ok: false, status, docket: null, refreshed: page.url() !== urlBefore };
    }
  }
  return { ok: false, status: status || 'timeout waiting for submit result', docket: null, refreshed: page.url() !== urlBefore };
}

async function backToHub(page) {
  await page.getByRole('button', { name: /Back to hub/i }).click();
  await page.waitForTimeout(1500);
  await page.getByText('Citizen hub').waitFor({ timeout: 10000 });
}

async function main() {
  const mobile = `98${String(Date.now()).slice(-8)}`;
  const servicesByTenant = {};
  for (const tenant of TENANTS) {
    servicesByTenant[tenant] = await fetchServices(tenant);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const results = [];
  const anomalies = [];

  page.on('pageerror', (err) => anomalies.push({ type: 'pageerror', message: err.message }));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      anomalies.push({ type: 'console.error', message: msg.text() });
    }
  });

  try {
    await loginCitizen(page, mobile);

    for (const tenant of TENANTS) {
      const services = servicesByTenant[tenant];
      await enterTenantWorkspace(page, tenant);

      for (const service of services) {
        const serviceCode = service.code;
        const serviceName = service.name?.en ?? serviceCode;
        const entry = {
          tenant,
          serviceCode,
          serviceName,
          ok: false,
          docket: null,
          status: '',
          pageRefresh: false,
          error: null,
        };

        try {
          await applyService(page, serviceCode, serviceName);
          await fillServiceForm(page, serviceCode);
          const outcome = await submitAndCapture(page);
          entry.ok = outcome.ok;
          entry.docket = outcome.docket;
          entry.status = outcome.status;
          entry.pageRefresh = outcome.refreshed;
          if (entry.pageRefresh) {
            anomalies.push({
              type: 'unexpected-navigation',
              tenant,
              serviceCode,
              detail: 'URL changed during submit wait',
            });
          }
          if (!outcome.ok) {
            anomalies.push({
              type: 'submit-failed',
              tenant,
              serviceCode,
              status: outcome.status,
            });
          }
        } catch (err) {
          entry.error = err instanceof Error ? err.message : String(err);
          anomalies.push({ type: 'exception', tenant, serviceCode, message: entry.error });
        }

        results.push(entry);
        await page.getByRole('button', { name: 'Services', exact: true }).click().catch(() => {});
        await page.waitForTimeout(600);
      }

      await backToHub(page);
    }
  } finally {
    await browser.close();
  }

  const report = {
    ranAt: new Date().toISOString(),
    mobile,
    totalAttempts: results.length,
    successCount: results.filter((r) => r.ok).length,
    failCount: results.filter((r) => !r.ok).length,
    results,
    anomalies: dedupeAnomalies(anomalies),
  };

  const outPath = join(__dirname, 'citizen-services-smoke-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${outPath}`);
}

function dedupeAnomalies(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
