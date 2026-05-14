import { citizenTenantFetch } from './citizenTenantHttp';

import type { ApplicationDetail, ApplicationSummary } from '../types/dossier';
import type { FormSubmission } from '@enagar/forms';

export async function fetchApplicationList(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
): Promise<ApplicationSummary[]> {
  const response = await citizenTenantFetch(
    'GET',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    '/applications',
  );
  if (!response.ok) {
    throw new Error(`GET /applications failed (${response.status})`);
  }
  return (await response.json()) as ApplicationSummary[];
}

export async function fetchApplicationByDocket(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  docketNo: string,
): Promise<ApplicationDetail> {
  const response = await citizenTenantFetch(
    'GET',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    `/applications/${encodeURIComponent(docketNo)}`,
  );
  if (!response.ok) {
    throw new Error(`GET /applications/:docket failed (${response.status})`);
  }
  return (await response.json()) as ApplicationDetail;
}

export async function createApplicationDraft(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  body: { service_code: string; form_data: FormSubmission },
): Promise<ApplicationDetail> {
  const response = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    '/applications/drafts',
    { body },
  );
  if (!response.ok) {
    throw new Error(`POST /applications/drafts failed (${response.status})`);
  }
  return (await response.json()) as ApplicationDetail;
}

export async function submitDraft(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  applicationId: string,
): Promise<ApplicationDetail> {
  const response = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    `/applications/${encodeURIComponent(applicationId)}/submit`,
  );
  if (!response.ok) {
    throw new Error(`POST /applications/:id/submit failed (${response.status})`);
  }
  return (await response.json()) as ApplicationDetail;
}

export async function postApplicationComment(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string | null | undefined,
  applicationId: string,
  bodyText: string,
): Promise<ApplicationDetail> {
  const response = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    `/applications/${encodeURIComponent(applicationId)}/comment`,
    { body: { body: bodyText } },
  );
  if (!response.ok) {
    throw new Error(`POST /applications/:id/comment failed (${response.status})`);
  }
  return (await response.json()) as ApplicationDetail;
}
