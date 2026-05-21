/**
 * Client helpers for application document upload-intent → PUT → confirm-upload.
 */

export function isStubObjectStorageUploadUrl(uploadUrl: string): boolean {
  return uploadUrl.startsWith('minio://');
}

export async function putFileToUploadUrl(
  uploadUrl: string,
  file: Blob,
  mimeType: string,
): Promise<void> {
  if (isStubObjectStorageUploadUrl(uploadUrl)) {
    return;
  }
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': mimeType },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Document upload failed (${response.status})`);
  }
}

export type UploadIntentLike = {
  id: string;
  upload_url: string;
  mime_type: string;
};

export async function confirmDocumentUpload(
  apiBaseUrl: string,
  headers: Record<string, string>,
  intentId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl}/documents/${encodeURIComponent(intentId)}/confirm-upload`,
    {
      method: 'POST',
      headers,
    },
  );
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export type DocumentScanPollStatus = 'clean' | 'infected' | 'failed' | 'pending' | 'processing';

export async function fetchDocumentStatus(
  apiBaseUrl: string,
  headers: Record<string, string>,
  documentId: string,
): Promise<DocumentScanPollStatus> {
  const response = await fetch(`${apiBaseUrl}/documents/${encodeURIComponent(documentId)}`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const body = (await response.json()) as { scan_status: DocumentScanPollStatus };
  return body.scan_status;
}

/** Poll until worker (or simulation) finishes scanning. */
export async function waitForDocumentScan(
  apiBaseUrl: string,
  headers: Record<string, string>,
  documentId: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<'clean' | 'infected' | 'failed'> {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const intervalMs = options.intervalMs ?? 1500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const status = await fetchDocumentStatus(apiBaseUrl, headers, documentId);
    if (status === 'clean' || status === 'infected' || status === 'failed') {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Document scan timed out');
}

export function allowsClientScanSimulationFromEnv(
  flag: string | undefined = process.env.NEXT_PUBLIC_ALLOW_CLIENT_SCAN_SIMULATION,
): boolean {
  return flag === 'true';
}
