/**
 * Unified Portal Option A — shared CORS origin lists (Phase 3 / Phase 5).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));

/** Local dev + Expo web — matches apps/api/src/main.ts defaults. */
export const LOCAL_DEV_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:8081',
];

/** @returns {import('./demo-hosts.json')} */
export function loadDemoHosts() {
  const path = join(moduleDir, 'demo-hosts.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** @param {string | undefined} value */
export function parseOriginList(value) {
  if (!value?.trim()) {
    return [];
  }
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

/**
 * MinIO global (compose) + bucket CORS origins.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveMinioCorsOrigins(env = process.env) {
  const fromEnv = parseOriginList(env.MINIO_API_CORS_ALLOW_ORIGIN);
  if (fromEnv.length > 0) {
    return fromEnv;
  }
  const demo = loadDemoHosts();
  return [...LOCAL_DEV_CORS_ORIGINS, demo.citizenOrigin];
}

/**
 * Comma-separated value for docker-compose / .env files (local default).
 */
export function localMinioCorsAllowOriginValue() {
  return LOCAL_DEV_CORS_ORIGINS.join(',');
}

/**
 * Comma-separated demo VM MinIO CORS (all portal HTTPS origins).
 */
export function demoMinioCorsAllowOriginValue() {
  return loadDemoHosts().corsOrigins.join(',');
}
