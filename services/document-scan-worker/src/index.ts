import { Worker } from 'bullmq';
import IORedis from 'ioredis';

import { applyScanVerdict, createPool, loadDocument, markProcessing } from './db.js';
import { scanObjectBytes } from './scan-logic.js';
import { fetchObjectBytes, loadObjectStorageEnv } from './storage.js';

const DOCUMENT_SCAN_QUEUE_NAME = 'document-scan';

function loadInfraEnv(): void {
  // Worker is started from repo root or services/document-scan-worker; infra/.env is merged by callers via dotenv in dev script.
}

async function processScan(documentId: string): Promise<void> {
  const pool = createPool();
  const storage = loadObjectStorageEnv();
  const stubMode = process.env.DOCUMENT_SCAN_STUB ?? 'clean';
  const provider =
    process.env.CLAMAV_ENABLED === 'true' ? 'clamav-worker-stub' : 'document-scan-stub';

  try {
    const row = await loadDocument(pool, documentId);
    if (!row) {
      console.warn(`[document-scan] skip missing document ${documentId}`);
      return;
    }
    if (row.upload_status !== 'uploaded') {
      console.warn(`[document-scan] skip document ${documentId} — not uploaded`);
      return;
    }
    if (row.scan_status === 'clean' || row.scan_status === 'infected') {
      return;
    }

    await markProcessing(pool, documentId);
    const bytes = await fetchObjectBytes(storage, row.object_key);
    if (!bytes || bytes.length === 0) {
      await applyScanVerdict(pool, documentId, 'failed', provider, 'object-missing');
      return;
    }

    const verdict = scanObjectBytes(bytes, stubMode);
    const signature =
      verdict === 'clean'
        ? `sha256:${bytes.length}`
        : verdict === 'infected'
          ? 'eicar-or-stub-infected'
          : 'scan-failed';

    await applyScanVerdict(pool, documentId, verdict, provider, signature);
    console.info(`[document-scan] ${documentId} → ${verdict}`);
  } finally {
    await pool.end();
  }
}

function main(): void {
  loadInfraEnv();
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    console.error('[document-scan] REDIS_URL is required');
    process.exit(1);
  }

  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const worker = new Worker<{ documentId: string }>(
    DOCUMENT_SCAN_QUEUE_NAME,
    async (job) => {
      await processScan(job.data.documentId);
    },
    { connection, concurrency: 2 },
  );

  worker.on('failed', (job, error) => {
    console.error(`[document-scan] job ${job?.id} failed`, error);
  });

  console.info('[document-scan] worker listening on queue', DOCUMENT_SCAN_QUEUE_NAME);
}

main();
