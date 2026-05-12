/** Hub catalogue slice used only to map `grievance.tenant_id` → ULB code for scoped reads/writes. */
export type GrievanceHubTenantSlice = Pick<{ id: string; code: string }, 'id' | 'code'>;

/**
 * Resolves `X-Enagar-Tenant-Code` for grievance detail GET and row-scoped mutations under a
 * **portal** JWT: explicit workspace ULB wins; in hub aggregate mode derive from catalogue.
 */
export function grievanceRowTenantScope(params: {
  workspaceTenantCode?: string | null;
  grievanceTenantId: string;
  hubCatalogue?: readonly GrievanceHubTenantSlice[] | null;
}): string | undefined {
  const trimmed = params.workspaceTenantCode?.trim();
  if (trimmed) {
    return trimmed;
  }
  return params.hubCatalogue?.find((row) => row.id === params.grievanceTenantId)?.code;
}

/**
 * Target ULB for `POST /grievances`: active workspace code, or hub-only filing pick.
 */
export function grievanceCreateWriteScope(params: {
  workspaceTenantCode?: string | null;
  filingTenantCode?: string | null;
}): string | undefined {
  const ws = params.workspaceTenantCode?.trim();
  if (ws) {
    return ws;
  }
  const filing = params.filingTenantCode?.trim();
  return filing || undefined;
}
