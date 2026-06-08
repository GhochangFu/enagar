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

  // Best-effort scan wait: if the scan queue is disabled, the intent stays
  // scan-clean and the document appears in the list immediately.
  try {
    await waitForDocumentScan(apiBase, { authorization: `Bearer ${token}` }, intent.id, {
      timeoutMs: 5000,
      intervalMs: 1000,
    });
  } catch {
    // Scan is best-effort: a timeout or transient failure does not block the
    // user. The list will refresh on the next mutation/transition.
  }

  return intent;
}
