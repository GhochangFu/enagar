import { Worker } from 'bullmq';
import IORedis from 'ioredis';

import { createPool } from './db.js';
import { processFormImportJob } from './process-job.js';

const FORM_IMPORT_QUEUE_NAME = 'form-import';

function main(): void {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    console.error('[form-import] REDIS_URL is required');
    process.exit(1);
  }

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const worker = new Worker<{ jobId: string }>(
    FORM_IMPORT_QUEUE_NAME,
    async (job) => {
      const pool = createPool();
      try {
        await processFormImportJob(pool, job.data.jobId);
      } finally {
        await pool.end();
      }
    },
    { connection, concurrency: 2 },
  );

  worker.on('failed', (job, error) => {
    console.error(`[form-import] job ${job?.id} failed`, error);
  });

  console.info('[form-import] worker listening on queue', FORM_IMPORT_QUEUE_NAME);
}

main();
