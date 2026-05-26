import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/api/src/generated/prisma/index.js';

const url =
  process.env.DATABASE_URL ??
  'postgresql://enagar:enagar_dev_pw_change_me@localhost:5432/enagarseba?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

try {
  const total = await prisma.kbArticle.count();
  const sahayak = await prisma.kbArticle.count({ where: { tags: { has: 'sahayak' } } });
  const published = await prisma.kbArticle.count({
    where: { tags: { has: 'sahayak' }, status: 'published' },
  });
  const byTenant = await prisma.$queryRaw`
    SELECT t.code, COUNT(*)::int AS articles
    FROM kb_articles a
    JOIN tenants t ON t.id = a.tenant_id
    WHERE 'sahayak' = ANY(a.tags)
    GROUP BY t.code
    ORDER BY t.code`;
  const sample = await prisma.kbArticle.findFirst({
    where: { slug: 'help-services-birth-cert', tenant: { code: 'KMC' } },
    select: {
      slug: true,
      status: true,
      tags: true,
      publishedAt: true,
      title: true,
      body: true,
    },
  });
  const indexJobs = await prisma.kbIndexJob.count({
    where: { requestedBy: 'seed:sahayak-service-help' },
  });

  console.log(
    JSON.stringify(
      {
        connected: true,
        total_kb_articles: total,
        sahayak_tagged: sahayak,
        sahayak_published: published,
        index_jobs_from_seed: indexJobs,
        by_tenant: byTenant,
        kmc_birth_cert: sample
          ? {
              slug: sample.slug,
              status: sample.status,
              tags: sample.tags,
              publishedAt: sample.publishedAt,
              title_en_preview: String(sample.title?.en ?? '').slice(0, 80),
              body_en_chars: String(sample.body?.en ?? '').length,
            }
          : null,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error('ERR:', error.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
