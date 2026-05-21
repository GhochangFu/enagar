import { isStubObjectStorageUploadUrl } from '@enagar/forms/upload';

export const MAX_GRIEVANCE_EVIDENCE_FILES = 3;

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

export type PendingGrievanceEvidence = {
  id: string;
  file: File;
  previewUrl: string | null;
  mimeType: string;
  label: string;
};

export function validateGrievanceEvidenceFile(file: File): string | null {
  if (!IMAGE_MIME.has(file.type) && !VIDEO_MIME.has(file.type)) {
    return 'Use a JPEG/PNG/WebP photo or a short MP4/WebM video.';
  }
  if (IMAGE_MIME.has(file.type) && file.size > MAX_IMAGE_BYTES) {
    return 'Photos must be 8 MB or smaller.';
  }
  if (VIDEO_MIME.has(file.type) && file.size > MAX_VIDEO_BYTES) {
    return 'Videos must be 25 MB or smaller (short clip).';
  }
  return null;
}

export function isVideoEvidenceMime(mimeType: string): boolean {
  return VIDEO_MIME.has(mimeType);
}

type UploadIntentResponse = {
  storage_key: string;
  upload_url: string;
  upload_expires_at: string;
};

async function createEvidenceUploadIntent(
  apiBaseUrl: string,
  headers: Record<string, string>,
  file: File,
): Promise<UploadIntentResponse> {
  const response = await fetch(`${apiBaseUrl}/grievances/evidence/upload-intent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      original_name: file.name,
      mime_type: file.type,
      size_mb: Math.max(0.01, file.size / (1024 * 1024)),
    }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as UploadIntentResponse;
}

async function putEvidenceBinary(uploadUrl: string, file: File): Promise<void> {
  if (isStubObjectStorageUploadUrl(uploadUrl)) {
    return;
  }
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Evidence upload failed (${response.status})`);
  }
}

export async function uploadGrievanceEvidenceFile(
  apiBaseUrl: string,
  headers: Record<string, string>,
  file: File,
): Promise<string> {
  const intent = await createEvidenceUploadIntent(apiBaseUrl, headers, file);
  await putEvidenceBinary(intent.upload_url, file);
  return intent.storage_key;
}

export async function registerGrievanceEvidence(
  apiBaseUrl: string,
  headers: Record<string, string>,
  grievanceId: string,
  storageKey: string,
  contentType: string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl}/grievances/${encodeURIComponent(grievanceId)}/attachments/register`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        storage_key: storageKey,
        content_type: contentType,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function attachPendingEvidenceToGrievance(
  apiBaseUrl: string,
  headers: Record<string, string>,
  grievanceId: string,
  files: readonly File[],
): Promise<void> {
  for (const file of files) {
    const storageKey = await uploadGrievanceEvidenceFile(apiBaseUrl, headers, file);
    await registerGrievanceEvidence(apiBaseUrl, headers, grievanceId, storageKey, file.type);
  }
}
