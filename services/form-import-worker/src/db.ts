import pg from 'pg';

export type FormImportJobRow = {
  id: string;
  scope: string;
  tenant_id: string | null;
  service_id: string | null;
  service_code: string;
  status: string;
  source_filename: string;
  source_mime_type: string;
  source_storage_key: string | null;
};

export function createPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for form-import-worker');
  }
  return new pg.Pool({ connectionString });
}

export async function loadFormImportJob(
  pool: pg.Pool,
  jobId: string,
): Promise<FormImportJobRow | null> {
  const result = await pool.query<FormImportJobRow>(
    `SELECT id, scope, tenant_id, service_id, service_code, status,
            source_filename, source_mime_type, source_storage_key
     FROM form_import_jobs
     WHERE id = $1`,
    [jobId],
  );
  return result.rows[0] ?? null;
}

export async function markFormImportProcessing(pool: pg.Pool, jobId: string): Promise<void> {
  await pool.query(
    `UPDATE form_import_jobs
     SET status = 'processing', updated_at = NOW()
     WHERE id = $1 AND status IN ('pending', 'processing')`,
    [jobId],
  );
}

export async function completeFormImportJob(
  pool: pg.Pool,
  jobId: string,
  data: {
    status: 'completed' | 'rejected' | 'failed';
    sourceKind?: string;
    overallConfidence?: number;
    proposalJson?: unknown;
    proposedSchemaJson?: unknown;
    rejectionReason?: string;
    errorMessage?: string;
  },
): Promise<void> {
  await pool.query(
    `UPDATE form_import_jobs
     SET status = $2,
         source_kind = COALESCE($3, source_kind),
         overall_confidence = $4,
         proposal_json = $5,
         proposed_schema_json = $6,
         rejection_reason = $7,
         error_message = $8,
         updated_at = NOW()
     WHERE id = $1`,
    [
      jobId,
      data.status,
      data.sourceKind ?? null,
      data.overallConfidence ?? null,
      data.proposalJson ? JSON.stringify(data.proposalJson) : null,
      data.proposedSchemaJson ? JSON.stringify(data.proposedSchemaJson) : null,
      data.rejectionReason ?? null,
      data.errorMessage ?? null,
    ],
  );
}
