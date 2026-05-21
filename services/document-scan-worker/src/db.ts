import pg from 'pg';

export type ApplicationDocumentRow = {
  id: string;
  tenant_id: string;
  application_id: string;
  object_key: string;
  upload_status: string;
  scan_status: string;
};

export function createPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for document-scan-worker');
  }
  return new pg.Pool({ connectionString });
}

export async function loadDocument(
  pool: pg.Pool,
  documentId: string,
): Promise<ApplicationDocumentRow | null> {
  const result = await pool.query<ApplicationDocumentRow>(
    `SELECT id, tenant_id, application_id, object_key, upload_status, scan_status
     FROM application_documents
     WHERE id = $1`,
    [documentId],
  );
  return result.rows[0] ?? null;
}

export async function markProcessing(pool: pg.Pool, documentId: string): Promise<void> {
  await pool.query(
    `UPDATE application_documents
     SET scan_status = 'processing', updated_at = NOW()
     WHERE id = $1 AND scan_status IN ('pending', 'processing')`,
    [documentId],
  );
}

export async function applyScanVerdict(
  pool: pg.Pool,
  documentId: string,
  verdict: 'clean' | 'infected' | 'failed',
  provider: string,
  signature: string | null,
): Promise<void> {
  const uploadStatus = verdict === 'failed' ? 'rejected' : 'uploaded';
  await pool.query(
    `UPDATE application_documents
     SET scan_status = $2,
         upload_status = $3,
         scan_provider = $4,
         scan_signature = $5,
         scan_completed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [documentId, verdict, uploadStatus, provider, signature],
  );
}
