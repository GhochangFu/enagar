import {
  buildStateFormImportObjectKey,
  buildTenantFormImportObjectKey,
} from './form-import-storage';

describe('form-import-storage (EN-43)', () => {
  it('builds tenant-scoped keys', () => {
    const key = buildTenantFormImportObjectKey(
      'KMC',
      'svc-uuid',
      'birth-cert template.xlsx',
      '00000000-0000-4000-a000-000000000001',
    );
    expect(key).toBe(
      'tenants/kmc/form-import/svc-uuid/00000000-0000-4000-a000-000000000001/birth-cert template.xlsx',
    );
  });

  it('builds state-scoped keys', () => {
    const key = buildStateFormImportObjectKey(
      'birth-certificate',
      'template.docx',
      '00000000-0000-4000-a000-000000000002',
    );
    expect(key).toBe(
      'state/form-import/birth-certificate/00000000-0000-4000-a000-000000000002/template.docx',
    );
  });
});
