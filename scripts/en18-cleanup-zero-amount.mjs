// Cleanup any 0-amount invoices the scheduler created on Stall 13 (regression).
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

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://enagar:enagar_dev_pw_change_me@localhost:5432/enagarseba?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const orphans = await prisma.leaseInvoice.findMany({
  where: { amountPaise: 0 },
  select: { id: true, invoiceNo: true, amountPaise: true, status: true, agreementId: true, createdAt: true },
});
console.log('found', orphans.length, 'zero-amount invoices');
for (const inv of orphans) {
  await prisma.receipt.deleteMany({ where: { leaseInvoiceId: inv.id } });
  await prisma.payment.deleteMany({ where: { leaseInvoiceId: inv.id } });
  await prisma.leaseInvoice.delete({ where: { id: inv.id } });
  console.log('deleted', inv.invoiceNo, '(created', inv.createdAt.toISOString(), ')');
}
await prisma.$disconnect();
