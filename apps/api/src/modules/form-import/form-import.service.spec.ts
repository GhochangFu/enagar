import { NotImplementedException } from '@nestjs/common';

import { FormImportService } from './form-import.service';

import type { FormImportUploadedFile } from './dto/form-import.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

describe('FormImportService (EN-28 contract stubs)', () => {
  const service = new FormImportService();
  const upload = {
    originalname: 'sample.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 12,
    buffer: Buffer.from(''),
  } satisfies FormImportUploadedFile;

  const tenantStaff: AuthenticatedPrincipal = {
    subject: 'staff-1',
    tenantId: '00000000-0000-4000-a000-000000000002',
    tenantCode: 'KMC',
    roles: ['tenant_admin'],
    expiresAt: new Date(Date.now() + 60_000),
  };

  const stateAdmin: AuthenticatedPrincipal = {
    subject: 'state-1',
    tenantId: '00000000-0000-4000-a000-000000000001',
    roles: ['state_admin'],
    expiresAt: new Date(Date.now() + 60_000),
  };

  it('requires tenant staff before tenant import stub', () => {
    expect(() =>
      service.createTenantImportJob({ ...tenantStaff, roles: ['citizen'] }, 'svc-1', upload),
    ).toThrow();
  });

  it('returns NotImplemented for tenant import (EN-32 follow-up)', () => {
    expect(() => service.createTenantImportJob(tenantStaff, 'svc-1', upload)).toThrow(
      NotImplementedException,
    );
  });

  it('returns NotImplemented for state import (EN-32 follow-up)', () => {
    expect(() => service.createStateImportJob(stateAdmin, 'birth-certificate', upload)).toThrow(
      NotImplementedException,
    );
  });
});
