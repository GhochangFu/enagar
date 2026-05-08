import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ApplicationsService } from '../applications/applications.service';
import { InMemoryApplicationStore } from '../applications/in-memory-application.store';
import { ServicesService } from '../services/services.service';

import { DocumentsService } from './documents.service';

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

  beforeEach(() => {
    applications = new ApplicationsService(new ServicesService(), new InMemoryApplicationStore());
    documents = new DocumentsService(applications);
  });

  it('creates tenant-scoped upload intents and attaches metadata to applications', async () => {
    const application = await applications.create(principal, {
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
    const application = await applications.create(principal, {
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

  it('allows download only after a clean scan result', async () => {
    const application = await applications.create(principal, {
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

    const submitted = await applications.submitDraft(principal, draft.id);

    expect(submitted.status).toBe('submitted');
    expect(submitted.timeline.map((item) => item.verb)).toEqual([
      'draft-created',
      'submit',
      'sla-armed',
    ]);
  });

  it('rejects cross-tenant scan and download attempts as not found', async () => {
    const application = await applications.create(principal, {
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
});
