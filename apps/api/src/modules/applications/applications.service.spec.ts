import { birthCertificateSchema } from '@enagar/forms/fixtures';
import { NotFoundException } from '@nestjs/common';

import { ServicesService } from '../services/services.service';

import { ApplicationsService } from './applications.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

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
    service = new ApplicationsService(new ServicesService());
  });

  it('creates a citizen application with docket number and timeline', () => {
    const application = service.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    expect(application.docket_no).toMatch(/^WBM\/KMC\/birth-cert\/2026\/00001$/);
    expect(application.current_stage).toBe('submitted');
    expect(application.workflow_code).toBe('cert-issuance-v1');
    expect(application.timeline.map((item) => item.verb)).toEqual([
      'draft-created',
      'submit',
      'sla-armed',
    ]);
  });

  it('lists and reads only the current citizen tenant applications', () => {
    const application = service.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });
    service.create(citizenB, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    expect(service.list(citizenA)).toHaveLength(1);
    expect(service.getByDocketNo(citizenA, application.docket_no).id).toBe(application.id);
    expect(() => service.getByDocketNo(citizenB, application.docket_no)).toThrow(NotFoundException);
  });

  it('cancels and comments with timeline records', () => {
    const application = service.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    const commented = service.comment(citizenA, application.id, { body: 'Please review soon.' });
    const cancelled = service.cancel(citizenA, application.id, { reason: 'Submitted by mistake.' });

    expect(commented.comments).toHaveLength(1);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.timeline.map((item) => item.verb)).toContain('comment');
    expect(cancelled.timeline.map((item) => item.verb)).toContain('cancel');
  });

  it('rejects cross-citizen mutation attempts as not found', () => {
    const application = service.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    expect(() =>
      service.comment(citizenB, application.id, { body: 'Trying to cross tenant boundary.' }),
    ).toThrow(NotFoundException);
    expect(() =>
      service.cancel(citizenB, application.id, { reason: 'Trying to cross tenant boundary.' }),
    ).toThrow(NotFoundException);
  });

  it('keeps in-flight applications on their submitted form schema snapshot', () => {
    const v1Application = service.create(citizenA, {
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
    const v2Application = service.create(citizenA, {
      service_code: 'birth-cert',
      form_data: birthCertificateForm,
    });

    expect(service.getByDocketNo(citizenA, v1Application.docket_no).form_version).toBe(1);
    expect(v2Application.form_version).toBe(2);
  });

  it('rejects invalid submissions before application creation', () => {
    expect(() =>
      service.create(citizenA, {
        service_code: 'birth-cert',
        form_data: { applicant_name: 'A' },
      }),
    ).toThrow('Form submission is invalid');
  });
});
