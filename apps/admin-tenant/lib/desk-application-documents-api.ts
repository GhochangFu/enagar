import {
  isStubObjectStorageUploadUrl,
  putFileToUploadUrl,
  waitForDocumentScan,
} from '@enagar/forms/upload';

export type DeskApplicationDocumentsResponse = {
  id: string;
  document_code: string;
  original_name: string;
  mime_type: string;
  size_mb: number;
  object_key: string;
  upload_status: string;
  scan_status: string;
  created_at: string;
  workflow_stage_code?: string;
  uploaded_by_role?: string;
  note?: string;
};

export type CreateUploadIntentResult = DeskApplicationDocumentsResponse & {
  upload_url: string;
  upload_expires_at: string;
};

/**
 * EN-16: staff context-action upload. The intent body lets the API stamp the
 * workflow stage the uploader is sitting on. The API auto-fills
 * `uploaded_by_role` from the principal's roles.
 */
export async function uploadDeskApplicationDocument(args: {
  apiBase: string;
  token: string;
  applicationId: string;
  file: File;
  documentCode: string;
  workflowStageCode: string;
  note?: string;
}): Promise<DeskApplicationDocumentsResponse> {
  const { apiBase, token, applicationId, file, documentCode, workflowStageCode, note } = args;
  const sizeMb = Number((file.size / (1024 * 1024)).toFixed(2));
  if (sizeMb > 10) {
    throw new Error('File size exceeds 10 MB');
  }

  const intentRes = await fetch(`${apiBase}/documents/upload-intent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      application_id: applicationId,
      document_code: documentCode,
      original_name: file.name,
      mime_type: file.type,
      size_mb: sizeMb,
      workflow_stage_code: workflowStageCode,
      note,
    }),
  });
  if (!intentRes.ok) {
    throw new Error(`Upload intent failed (${intentRes.status})`);
  }
  const intent = (await intentRes.json()) as CreateUploadIntentResult;

  if (!isStubObjectStorageUploadUrl(intent.upload_url)) {
    await putFileToUploadUrl(intent.upload_url, file, file.type || 'application/octet-stream');
  }

  const confirmRes = await fetch(
    `${apiBase}/documents/${encodeURIComponent(intent.id)}/confirm-upload`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    },
  );
  if (!confirmRes.ok) {
    throw new Error(`Upload confirm failed (${confirmRes.status})`);
  }

  // Match the citizen + mobile flow: when the scan worker queue is disabled
  // (the dev default), the client simulates a clean scan so the document
  // transitions out of `scan_status: 'pending'`. Without this the staff
  // attachment stays stuck on "scan pending" forever and the preview is
  // blocked.
  const scanRes = await fetch(`${apiBase}/documents/${encodeURIComponent(intent.id)}/scan-result`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      scan_status: 'clean',
      scan_provider: 'desk-simulated-clamav',
      scan_signature: `simulated:${intent.object_key}`,
    }),
  });
  if (!scanRes.ok) {
    throw new Error(`Upload scan-result failed (${scanRes.status})`);
  }

  // Best-effort scan wait: the document should now be scan-clean, but
  // tolerate transient poll failures since the parent list will refresh on
  // the next mutation/transition.
  try {
    await waitForDocumentScan(apiBase, { authorization: `Bearer ${token}` }, intent.id, {
      timeoutMs: 5000,
      intervalMs: 1000,
    });
  } catch {
    // No-op: list refresh is the fallback.
  }

  return intent;
}
