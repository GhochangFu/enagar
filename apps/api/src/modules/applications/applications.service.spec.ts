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
    expect(application.timeline.map((item) => item.verb)).toEqual(['submit', 'sla-armed']);
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

  it('rejects invalid submissions before application creation', () => {
    expect(() =>
      service.create(citizenA, {
        service_code: 'birth-cert',
        form_data: { applicant_name: 'A' },
      }),
    ).toThrow('Form submission is invalid');
  });
});
