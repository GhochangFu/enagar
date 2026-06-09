// Inspect the citizen record + applications for phone 9836177767
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
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PHONE = '9836177767';
const PHONE_NORM = PHONE.replace(/^91/, '');

const citizens = await prisma.citizen.findMany({
  where: { mobile: { in: [PHONE, PHONE_NORM, `91${PHONE_NORM}`] } },
  select: { id: true, tenantId: true, keycloakSubject: true, mobile: true, name: true },
  orderBy: { updatedAt: 'desc' },
});
console.log('=== CITIZEN ROWS for', PHONE, '===');
for (const c of citizens) {
  console.log(' id=', c.id, ' mobile=', c.mobile, ' keycloakSubject=', c.keycloakSubject, ' name=', c.name, ' tenantId=', c.tenantId);
}

const citizenIds = citizens.map(c => c.id);
const subjects = [...new Set(citizens.map(c => c.keycloakSubject).filter(Boolean))];
console.log('unique subjects:', subjects);
const apps = await prisma.application.findMany({
  where: { OR: [{ citizenSubject: { in: subjects } }, { citizenId: { in: citizenIds } }] },
  orderBy: { submittedAt: 'desc' },
  take: 10,
  include: { tenant: { select: { code: true } } },
});
console.log('');
console.log('=== APPLICATIONS (by subject or citizenId) ===');
console.log('count:', apps.length);
for (const a of apps) {
  console.log(' docket=', a.docketNo.padEnd(20), ' status=', a.status.padEnd(10), ' tenant=', a.tenant?.code, ' citizenId=', a.citizenId, ' subject=', a.citizenSubject);
}

const allRecent = await prisma.application.findMany({
  orderBy: { submittedAt: 'desc' },
  take: 15,
  include: { tenant: { select: { code: true } } },
});
console.log('');
console.log('=== 15 MOST RECENT APPLICATIONS (regardless of phone) ===');
for (const a of allRecent) {
  console.log(' docket=', a.docketNo.padEnd(20), ' status=', a.status.padEnd(10), ' tenant=', a.tenant?.code, ' citizenId=', a.citizenId, ' subject=', a.citizenSubject, ' submittedAt=', a.submittedAt.toISOString());
}

await prisma.$disconnect();
