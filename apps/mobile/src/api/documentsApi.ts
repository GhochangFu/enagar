import {
  isStubObjectStorageUploadUrl,
  putFileToUploadUrl,
  waitForDocumentScan,
} from '@enagar/forms/upload';

import { citizenTenantFetch } from './citizenTenantHttp';

import type { EnagarFormSchema, FormSubmission } from '@enagar/forms';

import type { UploadIntentResponse } from '../types/dossier';

export type MobilePendingFile = {
  uri: string;
  name: string;
  mime_type: string;
  size_mb: number;
};

export async function createUploadIntent(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  body: {
    application_id: string;
    document_code: string;
    original_name: string;
    mime_type: string;
    size_mb: number;
  },
): Promise<UploadIntentResponse> {
  const response = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    '/documents/upload-intent',
    { body },
  );
  if (!response.ok) {
    throw new Error(`POST /documents/upload-intent failed (${response.status})`);
  }
  return (await response.json()) as UploadIntentResponse;
}

export async function postSimulatedCleanScan(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  intentId: string,
  objectKey: string,
): Promise<boolean> {
  const response = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    `/documents/${encodeURIComponent(intentId)}/scan-result`,
    {
      body: {
        scan_status: 'clean',
        scan_provider: 'mobile-simulated-clamav',
        scan_signature: `simulated:${objectKey}`,
      },
    },
  );
  return response.ok;
}

async function uploadPendingFile(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  intent: UploadIntentResponse,
  pending: MobilePendingFile,
): Promise<boolean> {
  if (!isStubObjectStorageUploadUrl(intent.upload_url)) {
    const blobResponse = await fetch(pending.uri);
    const blob = await blobResponse.blob();
    try {
      await putFileToUploadUrl(intent.upload_url, blob, pending.mime_type);
    } catch {
      return false;
    }
  }
  const confirmResponse = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    `/documents/${encodeURIComponent(intent.id)}/confirm-upload`,
  );
  return confirmResponse.ok;
}

const MOBILE_SCAN_SIMULATION = process.env.EXPO_PUBLIC_ALLOW_CLIENT_SCAN_SIMULATION === 'true';

async function waitForScanMobile(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  documentId: string,
): Promise<boolean> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  if (municipalityTenantCode?.trim()) {
    headers['X-Enagar-Tenant-Code'] = municipalityTenantCode.trim();
  }
  try {
    const verdict = await waitForDocumentScan(`${apiRoot}`, headers, documentId);
    return verdict === 'clean';
  } catch {
    return false;
  }
}

/**
 * Upload intents + PUT + confirm + scan (worker poll or simulated) per filled file field.
 */
export async function finalizeDraftDocumentsMobile(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  applicationId: string,
  schema: EnagarFormSchema,
  formValues: FormSubmission,
  pendingFiles: Record<string, MobilePendingFile>,
): Promise<boolean> {
  const fileFields = schema.fields.filter((field) => field.type === 'file');

  for (const field of fileFields) {
    const raw = formValues[field.id];
    const meta =
      raw && typeof raw === 'object' && !Array.isArray(raw) && 'name' in raw
        ? (raw as { name: string; mime_type: string; size_mb: number })
        : null;
    if (!meta?.name) {
      continue;
    }

    const pending = pendingFiles[field.id];
    const intent = await createUploadIntent(apiRoot, accessToken, municipalityTenantCode, {
      application_id: applicationId,
      document_code: field.id,
      original_name: meta.name,
      mime_type: meta.mime_type,
      size_mb: meta.size_mb,
    });

    if (pending) {
      const uploaded = await uploadPendingFile(
        apiRoot,
        accessToken,
        municipalityTenantCode,
        intent,
        pending,
      );
      if (!uploaded) {
        return false;
      }
    }

    const scanOk = MOBILE_SCAN_SIMULATION
      ? await postSimulatedCleanScan(
          apiRoot,
          accessToken,
          municipalityTenantCode,
          intent.id,
          intent.object_key,
        )
      : await waitForScanMobile(apiRoot, accessToken, municipalityTenantCode, intent.id);
    if (!scanOk) {
      return false;
    }
  }

  return true;
}
