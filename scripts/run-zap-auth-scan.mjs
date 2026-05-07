import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const reportDir = join(process.cwd(), 'docs', 'security', 'zap');
mkdirSync(reportDir, { recursive: true });

const target = process.env.ZAP_TARGET ?? 'http://host.docker.internal:3001/docs-json';
const args = [
  'run',
  '--rm',
  '-t',
  '-v',
  `${reportDir}:/zap/wrk`,
  'ghcr.io/zaproxy/zaproxy:stable',
  'zap-api-scan.py',
  '-t',
  target,
  '-f',
  'openapi',
  '-r',
  'phase-1-auth-zap.html',
  '-J',
  'phase-1-auth-zap.json',
];

const result = spawnSync('docker', args, { stdio: 'inherit', shell: process.platform === 'win32' });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
