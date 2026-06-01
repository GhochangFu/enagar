import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD = join(__dirname, 'fixtures', 'smoke-upload.pdf');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /continue/i }).first().click();
await page.getByRole('button', { name: /continue/i }).first().click();
await page.locator('#mobile').fill(`98${Date.now().toString().slice(-8)}`);
await page.getByRole('button', { name: /send otp/i }).click();
await page.getByPlaceholder('12345').fill('12345');
await page.getByRole('button', { name: /verify and continue/i }).click();
await page.waitForTimeout(3000);
if (await page.getByRole('button', { name: 'Continue to hub' }).isVisible()) {
  await page.locator('button').filter({ hasText: 'KMC' }).filter({ hasText: 'Kolkata' }).first().click();
  await page.getByRole('button', { name: 'Continue to hub' }).click();
  await page.waitForTimeout(2000);
}
await page.getByLabel('Citizen hub navigation').getByRole('button', { name: 'Apply', exact: true }).click();
await page.locator('button').filter({ hasText: 'KMC' }).filter({ hasText: 'Enter workspace' }).first().click();
await page.waitForTimeout(2000);
await page.getByLabel('Municipality workspace navigation').getByRole('button', { name: 'Services', exact: true }).click();
await page.waitForTimeout(1000);
const card = page.locator('section.grid div').filter({ has: page.getByRole('heading', { name: /Birth Certificate/i }) }).first();
await card.locator('button.mt-5.w-full').click();
await page.waitForTimeout(2000);
console.log('URL', page.url());
console.log('Labels', await page.locator('label').allTextContents());
console.log('Inputs', await page.locator('input, textarea').evaluateAll((els) => els.map((e) => ({ id: e.id, type: e.type, name: e.getAttribute('name') }))));
await page.screenshot({ path: join(__dirname, 'debug-birth-form.png'), fullPage: true });
await browser.close();
