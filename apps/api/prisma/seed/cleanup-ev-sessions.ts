import { PrismaClient } from '../../src/generated/prisma';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const kmc = await prisma.tenant.findUnique({ where: { code: 'KMC' }, select: { id: true } });
  if (!kmc) return;
  const result = await prisma.evSession.updateMany({
    where: { tenantId: kmc.id, status: { in: ['HELD', 'CHARGING'] } },
    data: { status: 'CANCELLED' },
  });
  console.info(`Cancelled ${result.count} stale EV sessions for KMC`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
