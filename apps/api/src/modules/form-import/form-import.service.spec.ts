import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { FormImportService } from './form-import.service';

import type { FormImportUploadedFile } from './dto/form-import.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { FormImportQueueService } from '../../common/form-import/form-import.queue';
import type { ObjectStorageService } from '../../common/object-storage/object-storage.service';

const excelFixturePath = join(
  __dirname,
  '../../../test/fixtures/form-import/birth-certificate-template.xlsx',
);
const wordFixturePath = join(
  __dirname,
  '../../../test/fixtures/form-import/birth-certificate-template.docx',
);
const pdfFixturePath = join(
  __dirname,
  '../../../test/fixtures/form-import/birth-certificate-acroform.pdf',
);

describe('FormImportService (EN-26 async import)', () => {
  const envSnapshot = {
    redis: process.env.REDIS_URL,
    storage: process.env.OBJECT_STORAGE_DISABLED,
  };

  afterEach(() => {
    if (envSnapshot.redis === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = envSnapshot.redis;
    }
    if (envSnapshot.storage === undefined) {
      delete process.env.OBJECT_STORAGE_DISABLED;
    } else {
      process.env.OBJECT_STORAGE_DISABLED = envSnapshot.storage;
    }
  });

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

  const pdfUpload: FormImportUploadedFile = {
    originalname: 'birth-certificate-acroform.pdf',
    mimetype: 'application/pdf',
    size: 1,
    buffer: readFileSync(pdfFixturePath),
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

  function createService(
    prisma: Record<string, unknown>,
    overrides?: {
      objectStorage?: Partial<ObjectStorageService>;
      queue?: Partial<FormImportQueueService>;
    },
  ): FormImportService {
    const objectStorage = {
      assertTenantObjectKey: jest.fn(),
      assertSafeObjectKey: jest.fn(),
      putObject: jest.fn().mockResolvedValue(undefined),
      ...overrides?.objectStorage,
    };
    const formImportQueue = {
      enqueueImport: jest.fn().mockResolvedValue(undefined),
      ...overrides?.queue,
    };
    return new FormImportService(prisma as never, objectStorage as never, formImportQueue as never);
  }

  function mockJobStore() {
    const jobs = new Map<string, Record<string, unknown>>();
    return {
      jobs,
      formImportJob: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = {
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            proposalJson: data.proposalJson ?? null,
            proposedSchemaJson: data.proposedSchemaJson ?? null,
            sourceKind: data.sourceKind ?? null,
            overallConfidence: data.overallConfidence ?? null,
            rejectionReason: data.rejectionReason ?? null,
            errorMessage: data.errorMessage ?? null,
          };
          jobs.set(String(data.id), row);
          return row;
        }),
        findUnique: jest.fn(
          async ({ where }: { where: { id: string } }) => jobs.get(where.id) ?? null,
        ),
        update: jest.fn(
          async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const existing = jobs.get(where.id);
            if (!existing) {
              throw new Error('not found');
            }
            const row = { ...existing, ...data, updatedAt: new Date() };
            jobs.set(where.id, row);
            return row;
          },
        ),
        delete: jest.fn(async ({ where }: { where: { id: string } }) => {
          jobs.delete(where.id);
        }),
      },
    };
  }

  it('creates a completed tenant import job from Excel (inline processing)', async () => {
    const store = mockJobStore();
    const prisma = {
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', code: 'birth-certificate' }),
      },
      ...store,
    };
    const service = createService(prisma);
    const job = await service.createTenantImportJob(tenantStaff, 'svc-1', excelUpload);

    expect(job.status).toBe('completed');
    expect(job.proposal?.fields.length).toBeGreaterThan(0);
    expect(job.proposed_schema?.fields.length).toBeGreaterThan(0);
    expect(job.source_storage_key).toContain('tenants/kmc/form-import/svc-1/');

    const fetched = await service.getTenantImportJob(tenantStaff, 'svc-1', job.job_id);
    expect(fetched.job_id).toBe(job.job_id);
  });

  it('creates a completed state import job from Excel', async () => {
    const store = mockJobStore();
    const prisma = {
      globalService: {
        findUnique: jest.fn().mockResolvedValue({ code: 'birth-certificate' }),
      },
      ...store,
    };
    const service = createService(prisma);
    const job = await service.createStateImportJob(stateAdmin, 'birth-certificate', excelUpload);

    expect(job.status).toBe('completed');
    expect(job.scope).toBe('state');
    expect(job.source_storage_key).toContain('state/form-import/birth-certificate/');
  });

  it('creates a completed tenant import job from Word', async () => {
    const store = mockJobStore();
    const prisma = {
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', code: 'birth-certificate' }),
      },
      ...store,
    };
    const service = createService(prisma);
    const job = await service.createTenantImportJob(tenantStaff, 'svc-1', wordUpload);

    expect(job.status).toBe('completed');
    expect(job.source_kind).toBe('word');
    expect(job.proposal?.source_kind).toBe('word');
  });

  it('creates a completed tenant import job from PDF AcroForm', async () => {
    const store = mockJobStore();
    const prisma = {
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', code: 'birth-certificate' }),
      },
      ...store,
    };
    const service = createService(prisma);
    const job = await service.createTenantImportJob(tenantStaff, 'svc-1', pdfUpload);

    expect(job.status).toBe('completed');
    expect(job.source_kind).toBe('pdf_acroform');
  });

  it('returns pending when async queue is enabled', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.OBJECT_STORAGE_DISABLED = 'false';

    const store = mockJobStore();
    const prisma = {
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', code: 'birth-certificate' }),
      },
      ...store,
    };
    const enqueueImport = jest.fn().mockResolvedValue(undefined);
    const service = createService(prisma, { queue: { enqueueImport } });
    const job = await service.createTenantImportJob(tenantStaff, 'svc-1', excelUpload);

    expect(job.status).toBe('pending');
    expect(enqueueImport).toHaveBeenCalledWith(job.job_id);
  });

  it('denies cross-tenant job lookup', async () => {
    const store = mockJobStore();
    const prisma = {
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', code: 'birth-certificate' }),
      },
      ...store,
    };
    const service = createService(prisma);
    const job = await service.createTenantImportJob(tenantStaff, 'svc-1', excelUpload);

    await expect(
      service.getTenantImportJob(
        { ...tenantStaff, tenantId: '00000000-0000-4000-a000-000000099999' },
        'svc-1',
        job.job_id,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects empty uploads', async () => {
    const prisma = {
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', code: 'birth-certificate' }),
      },
      formImportJob: { create: jest.fn() },
    };
    const service = createService(prisma);
    await expect(
      service.createTenantImportJob(tenantStaff, 'svc-1', {
        ...excelUpload,
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('denies cross-service tenant job lookup (EN-48)', async () => {
    const store = mockJobStore();
    const prisma = {
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', code: 'birth-certificate' }),
      },
      ...store,
    };
    const service = createService(prisma);
    const job = await service.createTenantImportJob(tenantStaff, 'svc-1', excelUpload);

    await expect(service.getTenantImportJob(tenantStaff, 'svc-other', job.job_id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('denies state job lookup for the wrong service code (EN-48)', async () => {
    const store = mockJobStore();
    const prisma = {
      globalService: {
        findUnique: jest.fn().mockResolvedValue({ code: 'birth-certificate' }),
      },
      ...store,
    };
    const service = createService(prisma);
    const job = await service.createStateImportJob(stateAdmin, 'birth-certificate', excelUpload);

    await expect(
      service.getStateImportJob(stateAdmin, 'trade-licence', job.job_id),
    ).rejects.toThrow(NotFoundException);
  });

  it('stores layout extraction_mode on Excel layout imports (EN-50 regression)', async () => {
    const layoutFixturePath = join(
      __dirname,
      '../../../test/fixtures/form-import/birth-certificate-layout-form.xlsx',
    );
    const store = mockJobStore();
    const prisma = {
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'svc-1', code: 'birth-certificate' }),
      },
      ...store,
    };
    const service = createService(prisma);
    const job = await service.createTenantImportJob(tenantStaff, 'svc-1', {
      ...excelUpload,
      originalname: 'birth-certificate-layout-form.xlsx',
      buffer: readFileSync(layoutFixturePath),
    });

    expect(job.extraction_mode).toBe('layout');
    expect(job.status).toBe('completed');
  });
});
