/** Citizen grievances — hub list omits `x-enagar-tenant-code`; workspace/detail use ULB scope. */

import { citizenTenantFetch } from './citizenTenantHttp';

export type GrievanceListItemDto = {
  id: string;
  tenant_id: string;
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
  grievance: GrievanceListItemDto & {
    citizen_id?: string;
    location?: unknown;
    photo_keys?: string[];
  };
  timeline: GrievanceTimelineEntryDto[];
};

export async function fetchGrievanceList(
  apiRoot: string,
  accessToken: string,
  municipalityTenantCode?: string | null,
): Promise<GrievanceListItemDto[]> {
  const response = await citizenTenantFetch(
    'GET',
    apiRoot,
    accessToken,
    municipalityTenantCode ?? undefined,
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
  const response = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityTenantCode,
    '/grievances',
    { body: dto },
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
  const response = await citizenTenantFetch(
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
