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
const rows = await prisma.leaseInvoice.findMany({
  orderBy: { createdAt: 'desc' },
  take: 6,
  include: { agreement: { include: { asset: { select: { name: true, baseLeaseRatePaise: true } } } } },
});
for (const r of rows) {
  console.log(
    r.invoiceNo.padEnd(28),
    r.status.padEnd(8),
    'amount=₹' + (r.amountPaise / 100).toFixed(2).padStart(8),
    'asset=' + ((r.agreement.asset.name?.en ?? '?') + ' (base=₹' + (r.agreement.asset.baseLeaseRatePaise / 100) + ')'),
  );
}
await prisma.$disconnect();
