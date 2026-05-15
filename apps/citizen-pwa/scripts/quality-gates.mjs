#!/usr/bin/env node
/**
 * Headless Lighthouse smoke for the citizen PWA (Master Sprint 5.4).
 * Expects `next start` (or equivalent) already listening — see CI workflow.
 */
import process from 'node:process';

import { launch as launchChrome } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const url = process.env.PWA_QUALITY_URL ?? 'http://127.0.0.1:3000';
const minA11y = Number(process.env.PWA_MIN_A11Y_SCORE ?? 0.88);
const minPerf = Number(process.env.PWA_MIN_PERF_SCORE ?? 0.55);
const minBp = Number(process.env.PWA_MIN_BP_SCORE ?? 0.85);

const chrome = await launchChrome({
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--window-size=1280,720'],
});

try {
  const runner = await lighthouse(url, {
    logLevel: 'error',
    output: 'json',
    port: chrome.port,
    onlyCategories: ['performance', 'accessibility', 'best-practices'],
  });

  const lhr = runner.lhr;
  const a11y = lhr.categories.accessibility?.score ?? 0;
  const perf = lhr.categories.performance?.score ?? 0;
  const bp = lhr.categories['best-practices']?.score ?? 0;

  // eslint-disable-next-line no-console -- CI artifact
  console.log(
    JSON.stringify({ url, accessibility: a11y, performance: perf, bestPractices: bp }, null, 2),
  );

  const failures = [];
  if (a11y < minA11y) failures.push(`accessibility ${a11y} < ${minA11y}`);
  if (perf < minPerf) failures.push(`performance ${perf} < ${minPerf}`);
  if (bp < minBp) failures.push(`best-practices ${bp} < ${minBp}`);

  if (failures.length > 0) {
    console.error('Citizen PWA quality gate failed:', failures.join('; '));
    process.exit(1);
  }
} finally {
  await chrome.kill();
}
