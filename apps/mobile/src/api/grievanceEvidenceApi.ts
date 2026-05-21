import { isStubObjectStorageUploadUrl, putFileToUploadUrl } from '@enagar/forms/upload';

import { citizenTenantFetch } from './citizenTenantHttp';

export const MAX_MOBILE_GRIEVANCE_EVIDENCE = 3;

export type MobileGrievanceEvidenceAsset = {
  uri: string;
  name: string;
  mime_type: string;
  size_mb: number;
};

type UploadIntentResponse = {
  storage_key: string;
  upload_url: string;
};

async function createEvidenceUploadIntent(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string,
  asset: MobileGrievanceEvidenceAsset,
): Promise<UploadIntentResponse> {
  const response = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    '/grievances/evidence/upload-intent',
    {
      body: {
        original_name: asset.name,
        mime_type: asset.mime_type,
        size_mb: asset.size_mb,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`POST /grievances/evidence/upload-intent failed (${response.status})`);
  }
  return (await response.json()) as UploadIntentResponse;
}

async function registerEvidence(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string,
  grievanceId: string,
  storageKey: string,
  contentType: string,
): Promise<void> {
  const response = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    `/grievances/${encodeURIComponent(grievanceId)}/attachments/register`,
    {
      body: {
        storage_key: storageKey,
        content_type: contentType,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`POST attachments/register failed (${response.status})`);
  }
}

export async function uploadGrievanceEvidenceAssets(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string,
  grievanceId: string,
  assets: readonly MobileGrievanceEvidenceAsset[],
): Promise<void> {
  for (const asset of assets) {
    const intent = await createEvidenceUploadIntent(
      apiRoot,
      accessToken,
      municipalityTenantCode,
      asset,
    );
    if (!isStubObjectStorageUploadUrl(intent.upload_url)) {
      const blobResponse = await fetch(asset.uri);
      const blob = await blobResponse.blob();
      await putFileToUploadUrl(intent.upload_url, blob, asset.mime_type);
    }
    await registerEvidence(
      apiRoot,
      accessToken,
      municipalityTenantCode,
      grievanceId,
      intent.storage_key,
      asset.mime_type,
    );
  }
}
