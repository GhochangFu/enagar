import { mapFormImportJobRow } from './form-import.mapper';

describe('form-import.mapper (EN-47)', () => {
  it('maps extraction_mode from stored proposal JSON', () => {
    const row = {
      id: 'job-1',
      scope: 'tenant',
      tenantId: 'tenant-1',
      serviceId: 'svc-1',
      serviceCode: 'birth-certificate',
      status: 'completed',
      sourceFilename: 'layout.xlsx',
      sourceKind: 'excel',
      sourceStorageKey: 'tenants/kmc/form-import/svc-1/job-1/layout.xlsx',
      overallConfidence: 0.72,
      proposalJson: {
        source_kind: 'excel',
        source_filename: 'layout.xlsx',
        service_code: 'birth-certificate',
        overall_confidence: 0.72,
        extraction_mode: 'layout',
        fields: [],
      },
      proposedSchemaJson: null,
      rejectionReason: null,
      errorMessage: null,
      createdAt: new Date('2026-06-21T12:00:00.000Z'),
      updatedAt: new Date('2026-06-21T12:00:00.000Z'),
    };

    const mapped = mapFormImportJobRow(row as never);

    expect(mapped.extraction_mode).toBe('layout');
    expect(mapped.proposal?.extraction_mode).toBe('layout');
    expect(mapped.job_id).toBe('job-1');
  });
});
