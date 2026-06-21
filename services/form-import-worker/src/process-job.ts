import {
  completeFormImportFromProposal,
  extractFormImportFromUpload,
  isFormImportExtractionError,
} from '../../../apps/api/src/modules/form-import/form-import-job.processor.js';

import { completeFormImportJob, loadFormImportJob, markFormImportProcessing } from './db.js';
import { fetchObjectBytes, loadObjectStorageEnv } from './storage.js';

import type pg from 'pg';

export async function processFormImportJob(pool: pg.Pool, jobId: string): Promise<void> {
  const job = await loadFormImportJob(pool, jobId);
  if (!job) {
    console.warn(`[form-import] skip missing job ${jobId}`);
    return;
  }
  if (job.status === 'completed' || job.status === 'rejected' || job.status === 'failed') {
    return;
  }
  if (!job.source_storage_key) {
    await completeFormImportJob(pool, jobId, {
      status: 'failed',
      errorMessage: 'source_storage_key missing',
    });
    return;
  }

  await markFormImportProcessing(pool, jobId);
  const storage = loadObjectStorageEnv();
  const bytes = await fetchObjectBytes(storage, job.source_storage_key);
  if (!bytes || bytes.length === 0) {
    await completeFormImportJob(pool, jobId, {
      status: 'failed',
      errorMessage: 'source file missing in object storage',
    });
    return;
  }

  try {
    const extraction = await extractFormImportFromUpload(
      {
        originalname: job.source_filename,
        mimetype: job.source_mime_type,
        size: bytes.length,
        buffer: bytes,
      },
      job.service_code,
    );
    const completion = completeFormImportFromProposal(
      extraction.proposal,
      extraction.sourceKind,
      job.service_code,
    );

    await completeFormImportJob(pool, jobId, {
      status: completion.status,
      sourceKind: completion.sourceKind,
      overallConfidence: completion.overallConfidence,
      proposalJson: completion.proposal,
      proposedSchemaJson: completion.proposed_schema,
      rejectionReason: completion.rejectionReason,
    });
    console.info(`[form-import] ${jobId} → ${completion.status}`);
  } catch (error) {
    const message = isFormImportExtractionError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : 'Form import failed';
    await completeFormImportJob(pool, jobId, {
      status: 'failed',
      errorMessage: message,
    });
    console.error(`[form-import] ${jobId} failed:`, message);
  }
}
