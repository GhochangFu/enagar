/** Bearer + `x-enagar-tenant-code` client for citizen grievances. */

export type GrievanceListItemDto = {
  id: string;
  grievance_no: string;
  category: string;
  description: string;
  status: string;
  grievance_priority: string;
  sla_due_at: string | null;
  sla_breached_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GrievanceTimelineEntryDto = {
  id: string;
  event_type: string;
  actor_subject: string;
  body: string | null;
  metadata: unknown;
  occurred_at: string;
};

export type GrievanceDetailDto = {
  grievance: {
    id: string;
    grievance_no: string;
    category: string;
    description: string;
    status: string;
    grievance_priority: string;
    sla_due_at: string | null;
    sla_breached_at: string | null;
    created_at: string;
    updated_at: string;
  };
  timeline: GrievanceTimelineEntryDto[];
};

const TENANT_SCOPE_HEADER = 'x-enagar-tenant-code';

async function citizenFetch(
  method: string,
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const base = apiRoot.replace(/\/$/, '');
  return fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      [TENANT_SCOPE_HEADER]: municipalityTenantCode,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function fetchGrievanceList(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string,
): Promise<GrievanceListItemDto[]> {
  const response = await citizenFetch(
    'GET',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    '/grievances',
  );
  if (!response.ok) {
    throw new Error(`GET /grievances failed (${response.status})`);
  }
  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as GrievanceListItemDto[]) : [];
}

export async function createGrievance(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string,
  dto: {
    category: string;
    description: string;
    grievance_priority?: 'low' | 'medium' | 'high' | 'urgent';
    location?: { address?: string; ward_hint?: string };
  },
): Promise<{ id: string; grievance_no: string }> {
  const response = await citizenFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    '/grievances',
    dto,
  );
  if (!response.ok) {
    throw new Error(`POST /grievances failed (${response.status})`);
  }
  return (await response.json()) as { id: string; grievance_no: string };
}

export async function fetchGrievanceDetail(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode: string,
  grievanceId: string,
): Promise<GrievanceDetailDto> {
  const response = await citizenFetch(
    'GET',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    `/grievances/${encodeURIComponent(grievanceId)}`,
  );
  if (!response.ok) {
    throw new Error(`GET /grievances/:id failed (${response.status})`);
  }
  return (await response.json()) as GrievanceDetailDto;
}
