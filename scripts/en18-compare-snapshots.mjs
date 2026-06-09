import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/api/src/generated/prisma/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const infraEnv = resolve(repoRoot, 'infrastructure/.env');
if (existsSync(infraEnv)) {
  for (const line of readFileSync(infraEnv, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!k || k in process.env) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const visible = await prisma.application.findFirst({ where: { docketNo: 'WBM/KMC/community-hall/2026/00001' } });
const hidden = await prisma.application.findFirst({ where: { docketNo: 'WBM/KMC/birth-cert/2026/00018' } });

console.log('=== VISIBLE (00001) ===');
console.log('citizenId:', visible.citizenId);
console.log('citizen_subject:', JSON.stringify(visible.runtimeSnapshot?.citizen_subject));
console.log('tenant_code:', JSON.stringify(visible.runtimeSnapshot?.tenant_code));
console.log('keys:', Object.keys(visible.runtimeSnapshot ?? {}).sort());

console.log();
console.log('=== HIDDEN (00018) ===');
console.log('citizenId:', hidden.citizenId);
console.log('citizen_subject:', JSON.stringify(hidden.runtimeSnapshot?.citizen_subject));
console.log('tenant_code:', JSON.stringify(hidden.runtimeSnapshot?.tenant_code));
console.log('keys:', Object.keys(hidden.runtimeSnapshot ?? {}).sort());
console.log('raw snapshot first 800 chars:', JSON.stringify(hidden.runtimeSnapshot).slice(0, 800));

// Also fetch one of each status to be sure
const allApps = await prisma.application.findMany({
  where: { citizenId: visible.citizenId },
  take: 50,
  orderBy: { submittedAt: 'desc' },
});
let withSubj = 0, withoutSubj = 0;
for (const a of allApps) {
  if (a.runtimeSnapshot && 'citizen_subject' in a.runtimeSnapshot) withSubj++;
  else withoutSubj++;
}
console.log('\n=== Distribution ===');
console.log('apps with citizen_subject in snapshot:', withSubj);
console.log('apps WITHOUT citizen_subject in snapshot:', withoutSubj);

await prisma.$disconnect();
