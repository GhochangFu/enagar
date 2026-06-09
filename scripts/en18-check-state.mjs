import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/api/src/generated/prisma/client.js';

const connectionString = 'postgresql://enagar:enagar_dev_pw_change_me@localhost:5432/enagarseba?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const invs = await prisma.leaseInvoice.findMany({
  where: { invoiceNo: { startsWith: 'en18-smoke-' } },
  include: { payments: true },
  orderBy: { dueDate: 'asc' },
});
for (const i of invs) {
  console.log(`${i.invoiceNo.padEnd(28)} status=${i.status.padEnd(8)} amt=${i.amountPaise} late=${i.lateFeePaise} payments=${i.payments.length}`);
  for (const p of i.payments) {
    console.log(`  PAY ${p.id} method=${p.method} amountPaise=${p.amountPaise} status=${p.status} ref=${p.providerReference ?? '-'}`);
  }
}
await prisma.$disconnect();
