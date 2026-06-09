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

const apps = await prisma.application.findMany({
  orderBy: { submittedAt: 'desc' },
  take: 15,
  include: { tenant: { select: { code: true } } },
});
for (const a of apps) {
  const snap = a.runtimeSnapshot ?? {};
  const sub = snap.citizen_subject ?? '<no citizen_subject in snapshot>';
  console.log(
    a.docketNo.padEnd(20),
    'status=', a.status.padEnd(10),
    'tenant=', a.tenant?.code,
    'citizenId=', a.citizenId,
    'subject=', sub,
  );
}
await prisma.$disconnect();
