import type { FormImportJob } from '../../generated/prisma';
import type { FormImportJobRecord, FormImportProposal } from '@enagar/forms/form-import';

export function mapFormImportJobRow(row: FormImportJob): FormImportJobRecord {
  const proposal = row.proposalJson
    ? (row.proposalJson as unknown as FormImportProposal)
    : undefined;

  return {
    job_id: row.id,
    scope: row.scope as FormImportJobRecord['scope'],
    service_code: row.serviceCode,
    service_id: row.serviceId ?? undefined,
    status: row.status as FormImportJobRecord['status'],
    source_filename: row.sourceFilename,
    source_kind: (row.sourceKind as FormImportJobRecord['source_kind']) ?? undefined,
    extraction_mode: proposal?.extraction_mode,
    source_storage_key: row.sourceStorageKey ?? undefined,
    overall_confidence: row.overallConfidence ?? undefined,
    proposal,
    proposed_schema: row.proposedSchemaJson
      ? (row.proposedSchemaJson as unknown as FormImportJobRecord['proposed_schema'])
      : undefined,
    rejection_reason: row.rejectionReason ?? row.errorMessage ?? undefined,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
