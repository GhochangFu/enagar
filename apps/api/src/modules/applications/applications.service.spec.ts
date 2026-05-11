import { birthCertificateSchema } from '@enagar/forms/fixtures';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ServicesService } from '../services/services.service';
import { CITIZEN_PORTAL_TENANT_CODE, CITIZEN_PORTAL_TENANT_ID } from '../tenants/tenant.seed';
import { TenantsService } from '../tenants/tenants.service';

import { ApplicationsService } from './applications.service';
import { InMemoryApplicationStore } from './in-memory-application.store';

import type { ApplicationResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { FormSubmission } from '@enagar/forms';

function stubApplication(
  partial: Pick<
    ApplicationResponse,
    'id' | 'docket_no' | 'tenant_id' | 'tenant_code' | 'citizen_subject'
  >,
): ApplicationResponse {
  const now = new Date().toISOString();
  return {
    ...partial,
    service_code: 'birth-cert',
    service_name: 'Birth Certificate',
    form_version: 1,
    workflow_code: 'cert-issuance-v1',
    workflow_version: 1,
    current_stage: 'submitted',
    status: 'submitted',
    status_label: 'Submitted',
    pending_role: 'reviewer',
    payment_status: 'pending',
    form_data: {} as FormSubmission,
    submitted_at: now,
    timeline: [],
    comments: [],
    documents: [],
  };
}

const citizenA: AuthenticatedPrincipal = {
  subject: 'citizen-a',
  tenantId: '11111111-1111-4111-8111-111111111111',
  tenantCode: 'KMC',
  roles: ['citizen'],
  expiresAt: new Date('2026-05-08T00:00:00.000Z'),
};

const citizenB: AuthenticatedPrincipal = {
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

describe('ApplicationsService', () => {
  let service: ApplicationsService;

  beforeEach(() => {
    service = new ApplicationsService(
      new ServicesService(),
      new TenantsService(),
      new InMemoryApplicationStore(),
    );
  });

  it('creates a citizen application with docket number and timeline', async () => {
    const application = await service.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    expect(application.docket_no).toMatch(/^WBM\/KMC\/birth-cert\/2026\/00001$/);
    expect(application.current_stage).toBe('submitted');
    expect(application.payment_status).toBe('pending');
    expect(application.workflow_code).toBe('cert-issuance-v1');
    expect(application.timeline.map((item) => item.verb)).toEqual([
      'draft-created',
      'submit',
      'sla-armed',
    ]);
  });

  const portalForDrafts: AuthenticatedPrincipal = {
    subject: 'portal-create-test',
    tenantId: CITIZEN_PORTAL_TENANT_ID,
    tenantCode: CITIZEN_PORTAL_TENANT_CODE,
    roles: ['citizen'],
    expiresAt: new Date('2026-05-08T00:00:00.000Z'),
  };

  it('portal principal requires municipality scope header to create a draft', async () => {
    await expect(
      service.createDraft(portalForDrafts, {
        service_code: 'birth-cert',
        form_data: birthCertificateForm,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('portal principal with KMC scope creates a KMC docket and tenant rows', async () => {
    const application = await service.createDraft(
      portalForDrafts,
      { service_code: 'birth-cert', form_data: birthCertificateForm },
      'KMC',
    );
    expect(application.tenant_code).toBe('KMC');
    expect(application.tenant_id).toBe(citizenA.tenantId);
    expect(application.docket_no).toMatch(/^WBM\/KMC\/birth-cert\/2026\/00001$/);
  });

  it('lists and reads only the current citizen tenant applications', async () => {
    const application = await service.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });
    await service.create(citizenB, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    await expect(service.list(citizenA)).resolves.toHaveLength(1);
    await expect(service.getByDocketNo(citizenA, application.docket_no)).resolves.toMatchObject({
      id: application.id,
    });
    await expect(service.getByDocketNo(citizenB, application.docket_no)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('cancels and comments with timeline records', async () => {
    const application = await service.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    const commented = await service.comment(citizenA, application.id, {
      body: 'Please review soon.',
    });
    const cancelled = await service.cancel(citizenA, application.id, {
      reason: 'Submitted by mistake.',
    });

    expect(commented.comments).toHaveLength(1);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.timeline.map((item) => item.verb)).toContain('comment');
    expect(cancelled.timeline.map((item) => item.verb)).toContain('cancel');
  });

  it('rejects cross-citizen mutation attempts as not found', async () => {
    const application = await service.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    await expect(
      service.comment(citizenB, application.id, { body: 'Trying to cross tenant boundary.' }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.cancel(citizenB, application.id, { reason: 'Trying to cross tenant boundary.' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('keeps in-flight applications on their submitted form schema snapshot', async () => {
    const v1Application = await service.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });
    service.publishFormSchema({
      ...birthCertificateSchema,
      version: 2,
      fields: [
        ...birthCertificateSchema.fields,
        {
          id: 'late_registration_reason',
          type: 'textarea',
          label: {
            en: 'Late registration reason',
            bn: 'বিলম্বিত নিবন্ধনের কারণ',
            hi: 'देर से पंजीकरण का कारण',
          },
          required: false,
          max_length: 500,
        },
      ],
    });
    const v2Application = await service.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    await expect(service.getByDocketNo(citizenA, v1Application.docket_no)).resolves.toMatchObject({
      form_version: 1,
    });
    expect(v2Application.form_version).toBe(2);
  });

  it('rejects invalid submissions before application creation', async () => {
    await expect(
      service.create(citizenA, {
        service_code: 'birth-cert',
        form_data: { applicant_name: 'A' },
      }),
    ).rejects.toThrow('Form submission is invalid');
  });
});

describe('ApplicationsService (portal hub scope)', () => {
  let store: InMemoryApplicationStore;
  let hubService: ApplicationsService;

  const portalPrincipal: AuthenticatedPrincipal = {
    subject: 'hub-user',
    tenantId: CITIZEN_PORTAL_TENANT_ID,
    tenantCode: CITIZEN_PORTAL_TENANT_CODE,
    roles: ['citizen'],
    expiresAt: new Date('2026-05-08T00:00:00.000Z'),
  };

  beforeEach(() => {
    store = new InMemoryApplicationStore();
    hubService = new ApplicationsService(new ServicesService(), new TenantsService(), store);
  });

  it('lists all municipality applications for the same subject when unscoped', async () => {
    await store.save(
      stubApplication({
        id: 'kmc-1',
        docket_no: 'WBM/KMC/birth-cert/2026/00001',
        tenant_id: citizenA.tenantId,
        tenant_code: 'KMC',
        citizen_subject: portalPrincipal.subject,
      }),
    );
    await store.save(
      stubApplication({
        id: 'hmc-1',
        docket_no: 'WBM/HMC/birth-cert/2026/00002',
        tenant_id: citizenB.tenantId,
        tenant_code: 'HMC',
        citizen_subject: portalPrincipal.subject,
      }),
    );

    await expect(hubService.list(portalPrincipal)).resolves.toHaveLength(2);
  });

  it('scopes list to one ULB when municipality scope is set', async () => {
    await store.save(
      stubApplication({
        id: 'kmc-1',
        docket_no: 'WBM/KMC/birth-cert/2026/00001',
        tenant_id: citizenA.tenantId,
        tenant_code: 'KMC',
        citizen_subject: portalPrincipal.subject,
      }),
    );
    await store.save(
      stubApplication({
        id: 'hmc-1',
        docket_no: 'WBM/HMC/birth-cert/2026/00002',
        tenant_id: citizenB.tenantId,
        tenant_code: 'HMC',
        citizen_subject: portalPrincipal.subject,
      }),
    );

    await expect(
      hubService.list(portalPrincipal, { municipalityTenantCode: 'KMC' }),
    ).resolves.toHaveLength(1);
    await expect(
      hubService.list(portalPrincipal, { municipalityTenantCode: 'HMC' }),
    ).resolves.toHaveLength(1);
  });

  it('reads cross-tenant docket numbers when unscoped; hides when scoped to another ULB', async () => {
    await store.save(
      stubApplication({
        id: 'hmc-1',
        docket_no: 'WBM/HMC/birth-cert/2026/00002',
        tenant_id: citizenB.tenantId,
        tenant_code: 'HMC',
        citizen_subject: portalPrincipal.subject,
      }),
    );

    await expect(
      hubService.getByDocketNo(portalPrincipal, 'WBM/HMC/birth-cert/2026/00002'),
    ).resolves.toMatchObject({ tenant_code: 'HMC' });

    await expect(
      hubService.getByDocketNo(portalPrincipal, 'WBM/HMC/birth-cert/2026/00002', {
        municipalityTenantCode: 'KMC',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
