import { BadRequestException } from '@nestjs/common';

import { ApplicationsService } from '../applications/applications.service';
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
    applications = new ApplicationsService(new ServicesService());
    documents = new DocumentsService(applications);
  });

  it('creates tenant-scoped upload intents and attaches metadata to applications', () => {
    const application = applications.create(principal, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    const intent = documents.createUploadIntent(principal, {
      application_id: application.id,
      document_code: 'hospital_discharge',
      original_name: 'Birth Proof.pdf',
      mime_type: 'application/pdf',
      size_mb: 1,
    });

    expect(intent.object_key).toContain(`tenants/kmc/applications/${application.id}/documents/`);
    expect(intent.upload_url).toContain('action=upload');
    expect(applications.getByDocketNo(principal, application.docket_no).documents).toHaveLength(1);
  });

  it('blocks oversized uploads and scan-pending downloads', () => {
    const application = applications.create(principal, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    expect(() =>
      documents.createUploadIntent(principal, {
        application_id: application.id,
        document_code: 'hospital_discharge',
        original_name: 'large.pdf',
        mime_type: 'application/pdf',
        size_mb: 11,
      }),
    ).toThrow(BadRequestException);

    const intent = documents.createUploadIntent(principal, {
      application_id: application.id,
      document_code: 'hospital_discharge',
      original_name: 'clean.pdf',
      mime_type: 'application/pdf',
      size_mb: 1,
    });

    expect(() => documents.createDownloadUrl(principal, intent.id)).toThrow(
      'Document is not scan-clean',
    );
  });

  it('allows download only after a clean scan result', () => {
    const application = applications.create(principal, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });
    const intent = documents.createUploadIntent(principal, {
      application_id: application.id,
      document_code: 'hospital_discharge',
      original_name: 'clean.pdf',
      mime_type: 'application/pdf',
      size_mb: 1,
    });

    documents.updateScanResult(principal, intent.id, {
      scan_status: 'clean',
      scan_provider: 'clamav-local',
    });

    expect(documents.createDownloadUrl(principal, intent.id).download_url).toContain(
      'action=download',
    );
  });
});
