import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NotFoundException } from '@nestjs/common';

import { FormImportService } from './form-import.service';

import type { FormImportUploadedFile } from './dto/form-import.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

const excelFixturePath = join(
  __dirname,
  '../../../test/fixtures/form-import/birth-certificate-template.xlsx',
);
const wordFixturePath = join(
  __dirname,
  '../../../test/fixtures/form-import/birth-certificate-template.docx',
);

describe('FormImportService (EN-32 sync import API)', () => {
  const excelUpload: FormImportUploadedFile = {
    originalname: 'birth-certificate-template.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 1,
    buffer: readFileSync(excelFixturePath),
  };

  const wordUpload: FormImportUploadedFile = {
    originalname: 'birth-certificate-template.docx',
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 1,
    buffer: readFileSync(wordFixturePath),
  };

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

  it('creates a completed tenant import job from Excel', async () => {
    const prisma = {
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', code: 'birth-certificate' }),
      },
    };
    const service = new FormImportService(prisma as never);
    const job = await service.createTenantImportJob(tenantStaff, 'svc-1', excelUpload);

    expect(job.status).toBe('completed');
    expect(job.proposal?.fields.length).toBeGreaterThan(0);
    expect(job.proposed_schema?.fields.length).toBeGreaterThan(0);

    const fetched = await service.getTenantImportJob(tenantStaff, 'svc-1', job.job_id);
    expect(fetched.job_id).toBe(job.job_id);
  });

  it('creates a completed state import job from Excel', async () => {
    const prisma = {
      globalService: {
        findUnique: jest.fn().mockResolvedValue({ code: 'birth-certificate' }),
      },
    };
    const service = new FormImportService(prisma as never);
    const job = await service.createStateImportJob(stateAdmin, 'birth-certificate', excelUpload);

    expect(job.status).toBe('completed');
    expect(job.scope).toBe('state');
  });

  it('creates a completed tenant import job from Word', async () => {
    const prisma = {
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', code: 'birth-certificate' }),
      },
    };
    const service = new FormImportService(prisma as never);
    const job = await service.createTenantImportJob(tenantStaff, 'svc-1', wordUpload);

    expect(job.status).toBe('completed');
    expect(job.source_kind).toBe('word');
    expect(job.proposal?.source_kind).toBe('word');
  });

  it('denies cross-tenant job lookup', async () => {
    const prisma = {
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', code: 'birth-certificate' }),
      },
    };
    const service = new FormImportService(prisma as never);
    const job = await service.createTenantImportJob(tenantStaff, 'svc-1', excelUpload);

    await expect(
      service.getTenantImportJob(
        { ...tenantStaff, tenantId: '00000000-0000-4000-a000-000000099999' },
        'svc-1',
        job.job_id,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
