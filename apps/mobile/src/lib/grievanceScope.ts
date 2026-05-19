/** Maps grievance `tenant_id` → ULB code for hub-scoped reads (PWA parity). */

export type GrievanceHubTenantSlice = Pick<{ id: string; code: string }, 'id' | 'code'>;

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
