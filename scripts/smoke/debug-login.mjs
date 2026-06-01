import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /continue/i }).first().click();
await page.getByRole('button', { name: /continue/i }).first().click();
await page.locator('#mobile').fill('9899998866');
await page.getByRole('button', { name: /send otp/i }).click();
await page.getByPlaceholder('12345').fill('12345');
await page.getByRole('button', { name: /verify and continue/i }).click();
await page.waitForTimeout(4000);
console.log('URL', page.url());
console.log('Body', (await page.locator('body').innerText()).slice(0, 1500));
await page.screenshot({ path: 'debug-5-after-otp.png', fullPage: true });
await browser.close();
