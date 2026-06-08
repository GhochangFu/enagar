import { randomUUID } from 'node:crypto';

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { DocumentScanQueueService } from '../../common/document-scan/document-scan.queue';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';
import { ApplicationsService } from '../applications/applications.service';
import { InMemoryApplicationStore } from '../applications/in-memory-application.store';
import { ServicesService } from '../services/services.service';
import { TenantsService } from '../tenants/tenants.service';

import { DocumentsService } from './documents.service';
import { createMockApplicationDocumentPrisma } from './testing/mock-application-document-prisma';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

const principal: AuthenticatedPrincipal = {
  subject: 'citizen-a',
  tenantId: '11111111-1111-4111-8111-111111111111',
  tenantCode: 'KMC',
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

const otherTenantPrincipal: AuthenticatedPrincipal = {
  subject: 'citizen-b',
  tenantId: '22222222-2222-4222-8222-222222222222',
  tenantCode: 'HMC',
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

const birthCertificateForm = {
  applicant_name: 'Citizen A',
  mobile: '9876543210',
  child_name: 'Child A',
  date_of_birth: '2026-01-01',
  relationship: 'parent',
  hospital_discharge: {
    name: 'birth-proof.pdf',
    mime_type: 'application/pdf',
    size_mb: 1,
  },
};

describe('DocumentsService', () => {
  let applications: ApplicationsService;
  let documents: DocumentsService;
  let prisma: PrismaService;

  const documentScanQueue = { enqueueScan: jest.fn().mockResolvedValue(undefined) } as Pick<
    DocumentScanQueueService,
    'enqueueScan'
  >;

  beforeEach(() => {
    process.env.ALLOW_CLIENT_SCAN_SIMULATION = 'true';
    prisma = createMockApplicationDocumentPrisma();
    applications = new ApplicationsService(
      new ServicesService(),
      new TenantsService(),
      new InMemoryApplicationStore(),
      prisma,
    );
    documents = new DocumentsService(
      applications,
      new ObjectStorageService(),
      prisma,
      documentScanQueue as DocumentScanQueueService,
    );
  });

  it('creates tenant-scoped upload intents and attaches metadata to applications', async () => {
    const application = await applications.createDraft(principal, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    const intent = await documents.createUploadIntent(principal, {
      application_id: application.id,
      document_code: 'hospital_discharge',
      original_name: 'Birth Proof.pdf',
      mime_type: 'application/pdf',
      size_mb: 1,
    });

    expect(intent.object_key).toContain(`tenants/kmc/applications/${application.id}/documents/`);
    expect(intent.upload_url).toContain('action=upload');
    await expect(
      applications.getByDocketNo(principal, application.docket_no),
    ).resolves.toMatchObject({
      documents: expect.arrayContaining([expect.objectContaining({ id: intent.id })]),
    });
  });

  it('blocks oversized uploads and scan-pending downloads', async () => {
    const application = await applications.createDraft(principal, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    await expect(
      documents.createUploadIntent(principal, {
        application_id: application.id,
        document_code: 'hospital_discharge',
        original_name: 'large.pdf',
        mime_type: 'application/pdf',
        size_mb: 11,
      }),
    ).rejects.toThrow(BadRequestException);

    const intent = await documents.createUploadIntent(principal, {
      application_id: application.id,
      document_code: 'hospital_discharge',
      original_name: 'clean.pdf',
      mime_type: 'application/pdf',
      size_mb: 1,
    });

    await expect(documents.createDownloadUrl(principal, intent.id)).rejects.toThrow(
      'Document is not scan-clean',
    );
  });

  it('marks upload_status uploaded on confirm-upload (stub storage)', async () => {
    const application = await applications.createDraft(principal, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });
    const intent = await documents.createUploadIntent(principal, {
      application_id: application.id,
      document_code: 'hospital_discharge',
      original_name: 'proof.pdf',
      mime_type: 'application/pdf',
      size_mb: 1,
    });

    const confirmed = await documents.confirmUpload(principal, intent.id);
    expect(confirmed.upload_status).toBe('uploaded');
  });

  it('allows download only after a clean scan result', async () => {
    const application = await applications.createDraft(principal, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });
    const intent = await documents.createUploadIntent(principal, {
      application_id: application.id,
      document_code: 'hospital_discharge',
      original_name: 'clean.pdf',
      mime_type: 'application/pdf',
      size_mb: 1,
    });

    await documents.updateScanResult(principal, intent.id, {
      scan_status: 'clean',
      scan_provider: 'clamav-local',
    });

    await expect(documents.createDownloadUrl(principal, intent.id)).resolves.toMatchObject({
      download_url: expect.stringContaining('action=download'),
    });
  });

  it('supports draft document upload before final application submission', async () => {
    const draft = await applications.createDraft(principal, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    await expect(applications.submitDraft(principal, draft.id)).rejects.toThrow(
      'Document hospital_discharge must be uploaded and scan-clean before submission',
    );

    const intent = await documents.createUploadIntent(principal, {
      application_id: draft.id,
      document_code: 'hospital_discharge',
      original_name: 'clean.pdf',
      mime_type: 'application/pdf',
      size_mb: 1,
    });
    await documents.updateScanResult(principal, intent.id, {
      scan_status: 'clean',
      scan_provider: 'clamav-local',
    });

    await applications.updateFeeLineSettlement(principal, draft.id, 'application', {
      status: 'paid',
      payment_id: randomUUID(),
      amount_paise: 5000,
    });

    const submitted = await applications.submitDraft(principal, draft.id);

    expect(submitted.status).toBe('submitted');
    expect(submitted.timeline.map((item) => item.verb)).toEqual([
      'draft-created',
      'submit',
      'sla-armed',
    ]);
  });

  it('rejects client scan-result when simulation is disabled', async () => {
    delete process.env.ALLOW_CLIENT_SCAN_SIMULATION;
    const application = await applications.createDraft(principal, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });
    const intent = await documents.createUploadIntent(principal, {
      application_id: application.id,
      document_code: 'hospital_discharge',
      original_name: 'clean.pdf',
      mime_type: 'application/pdf',
      size_mb: 1,
    });
    await expect(
      documents.updateScanResult(principal, intent.id, {
        scan_status: 'clean',
        scan_provider: 'test',
      }),
    ).rejects.toThrow('scan worker');
    process.env.ALLOW_CLIENT_SCAN_SIMULATION = 'true';
  });

  it('rejects cross-tenant scan and download attempts as not found', async () => {
    const application = await applications.createDraft(principal, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });
    const intent = await documents.createUploadIntent(principal, {
      application_id: application.id,
      document_code: 'hospital_discharge',
      original_name: 'clean.pdf',
      mime_type: 'application/pdf',
      size_mb: 1,
    });

    await expect(
      documents.updateScanResult(otherTenantPrincipal, intent.id, {
        scan_status: 'clean',
      }),
    ).rejects.toThrow(NotFoundException);
    await expect(documents.createDownloadUrl(otherTenantPrincipal, intent.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('EN-16 staff context-action attachments', () => {
    // The clerk is the workflow-assigned actor for the application; the in-memory
    // store keys access by `citizen_subject`, so we model the staff principal as
    // a non-citizen-portal user that shares the application's tenant. This is the
    // minimal shape the existing canAccess check accepts.
    const tenantClerk: AuthenticatedPrincipal = {
      subject: 'clerk-1',
      tenantId: '11111111-1111-4111-8111-111111111111',
      tenantCode: 'KMC',
      roles: ['tenant_clerk'],
      expiresAt: new Date('2026-05-08T00:00:00.000Z'),
    };

    const citizenPortalPrincipal: AuthenticatedPrincipal = {
      subject: 'citizen-a',
      tenantId: '00000000-0000-0000-0000-000000000000',
      tenantCode: 'WBPORTAL',
      roles: ['citizen'],
      expiresAt: new Date('2026-05-08T00:00:00.000Z'),
    };

    it("stamps staff uploads with the uploader's current stage and role", async () => {
      const application = await applications.createDraft(principal, {
        service_code: 'birth-cert',
        form_data: birthCertificateForm,
      });
      await applications.updateFeeLineSettlement(principal, application.id, 'application', {
        status: 'paid',
        payment_id: randomUUID(),
        amount_paise: 5000,
      });
      await applications.submitDraft(principal, application.id, {
        enforceCleanDocuments: false,
      });

      const intent = await documents.createUploadIntent(tenantClerk, {
        application_id: application.id,
        document_code: 'site_inspection',
        original_name: 'inspection.pdf',
        mime_type: 'application/pdf',
        size_mb: 0.5,
        workflow_stage_code: application.current_stage,
        note: 'Site visit report',
      });

      expect(intent.workflow_stage_code).toBe(application.current_stage);
      expect(intent.uploaded_by_role).toBe('tenant_clerk');
      expect(intent.note).toBe('Site visit report');
    });

    it("pins 'submission' for citizen-portal uploads and ignores workflow_stage_code", async () => {
      const application = await applications.createDraft(principal, {
        service_code: 'birth-cert',
        form_data: birthCertificateForm,
      });

      const intent = await documents.createUploadIntent(citizenPortalPrincipal, {
        application_id: application.id,
        document_code: 'hospital_discharge',
        original_name: 'proof.pdf',
        mime_type: 'application/pdf',
        size_mb: 1,
        workflow_stage_code: 'should_be_ignored',
      });

      expect(intent.workflow_stage_code).toBe('submission');
      expect(intent.uploaded_by_role).toBe('citizen');
    });

    it('falls back to the application current_stage when staff omits it', async () => {
      const application = await applications.createDraft(principal, {
        service_code: 'birth-cert',
        form_data: birthCertificateForm,
      });
      await applications.updateFeeLineSettlement(principal, application.id, 'application', {
        status: 'paid',
        payment_id: randomUUID(),
        amount_paise: 5000,
      });
      const submitted = await applications.submitDraft(principal, application.id, {
        enforceCleanDocuments: false,
      });

      const intent = await documents.createUploadIntent(tenantClerk, {
        application_id: application.id,
        document_code: 'site_inspection',
        original_name: 'inspection.pdf',
        mime_type: 'application/pdf',
        size_mb: 0.5,
      });

      expect(intent.workflow_stage_code).toBe(submitted.current_stage);
    });
  });
});
