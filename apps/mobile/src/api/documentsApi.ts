import { citizenTenantFetch } from './citizenTenantHttp';

import type { EnagarFormSchema, FormSubmission } from '@enagar/forms';

import type { UploadIntentResponse } from '../types/dossier';

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

/**
 * Mirrors PWA document pipeline: intents + deterministic clean scan per file field filled in `formValues`.
 */
export async function finalizeDraftDocumentsMobile(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  applicationId: string,
  schema: EnagarFormSchema,
  formValues: FormSubmission,
): Promise<boolean> {
  const fileFields = schema.fields.filter((field) => field.type === 'file');

  for (const field of fileFields) {
    const raw = formValues[field.id];
    const file =
      raw && typeof raw === 'object' && !Array.isArray(raw) && 'name' in raw
        ? (raw as { name: string; mime_type: string; size_mb: number })
        : null;
    if (!file?.name) {
      continue;
    }

    const intent = await createUploadIntent(apiRoot, accessToken, municipalityTenantCode, {
      application_id: applicationId,
      document_code: field.id,
      original_name: file.name,
      mime_type: file.mime_type,
      size_mb: file.size_mb,
    });

    const scanOk = await postSimulatedCleanScan(
      apiRoot,
      accessToken,
      municipalityTenantCode,
      intent.id,
      intent.object_key,
    );
    if (!scanOk) {
      return false;
    }
  }

  return true;
}
