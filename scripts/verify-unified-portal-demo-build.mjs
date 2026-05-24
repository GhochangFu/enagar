#!/usr/bin/env node
/**
 * Assert demo/staging hostnames are embedded in Next.js client bundles.
 * Run after scripts/build-unified-portal-demo.mjs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const hosts = JSON.parse(
  readFileSync(join(repoRoot, 'infrastructure/unified-portal/demo-hosts.json'), 'utf8'),
);

/** @param {string} dir */
function collectJsFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectJsFiles(full, acc);
    } else if (entry.endsWith('.js')) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * @param {string} appDir
 * @param {string[]} subdirs e.g. ['static', 'server']
 */
function readBundleText(appDir, subdirs) {
  const chunks = [];
  let fileCount = 0;
  for (const sub of subdirs) {
    const dir = join(repoRoot, appDir, '.next', sub);
    try {
      const files = collectJsFiles(dir);
      fileCount += files.length;
      chunks.push(...files.map((f) => readFileSync(f, 'utf8')));
    } catch {
      // subdir may be absent on partial builds
    }
  }
  return { text: chunks.join('\n'), fileCount };
}

/**
 * @param {string} appDir
 * @param {string[]} requiredSubstrings
 * @param {string[]} bundleSubdirs
 */
function assertDemoUrlsInBundles(appDir, requiredSubstrings, bundleSubdirs) {
  const { text, fileCount } = readBundleText(appDir, bundleSubdirs);
  if (fileCount === 0) {
    throw new Error(
      `${appDir}: no .next bundles found — run pnpm build:portal-demo first`,
    );
  }

  const missing = requiredSubstrings.filter((s) => !text.includes(s));
  if (missing.length > 0) {
    throw new Error(
      `${appDir}: demo build missing embedded URL(s): ${missing.join(', ')}\n` +
        `Checked ${fileCount} chunk file(s) under .next/{${bundleSubdirs.join(',')}}`,
    );
  }

  console.log(`OK ${appDir} — found ${requiredSubstrings.join(', ')} in bundles`);
}

assertDemoUrlsInBundles('apps/citizen-pwa', ['enagarapi.demosites.co.in'], ['static']);

assertDemoUrlsInBundles(
  'apps/admin-tenant',
  ['enagarapi.demosites.co.in', 'enagartenant.demosites.co.in', 'enagarauth.demosites.co.in'],
  ['static', 'server'],
);

assertDemoUrlsInBundles(
  'apps/admin-state',
  ['enagarapi.demosites.co.in', 'enagarstate.demosites.co.in', 'enagarauth.demosites.co.in'],
  ['static', 'server'],
);

/** Routing-critical localhost defaults must not remain as the only API/issuer values. */
const routingLocalhost = [
  'http://localhost:3001/api',
  'http://localhost:8080/realms/enagar',
  'http://localhost:3002',
  'http://localhost:3003',
];

for (const [appDir, subdirs] of [
  ['apps/citizen-pwa', ['static']],
  ['apps/admin-tenant', ['static', 'server']],
  ['apps/admin-state', ['static', 'server']],
]) {
  const { text } = readBundleText(appDir, subdirs);

  for (const bad of routingLocalhost) {
    if (text.includes(bad)) {
      console.warn(
        `WARN ${appDir}: bundle still contains "${bad}" (likely dev fallback text — verify prod URL is primary)`,
      );
    }
  }
}

console.log('\nDemo build verification passed.');
