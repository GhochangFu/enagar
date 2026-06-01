import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
await page.getByRole('button', { name: /continue/i }).first().click();
await page.getByRole('button', { name: /continue/i }).first().click();
await page.locator('#mobile').fill('9898877665');
await page.getByRole('button', { name: /send otp/i }).click();
await page.getByPlaceholder('12345').fill('12345');
await page.getByRole('button', { name: /verify and continue/i }).click();
await page.waitForTimeout(5000);
console.log(await page.locator('body').innerText());
await page.screenshot({ path: 'debug-after-login.png', fullPage: true });
await browser.close();
