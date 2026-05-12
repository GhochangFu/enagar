import { BadRequestException } from '@nestjs/common';

import { PostgresApplicationStore } from './postgres-application.store';

import type { ApplicationResponse } from './dto';
import type { PrismaService } from '../../common/database/prisma.service';

const application: ApplicationResponse = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  docket_no: 'WBM/KMC/birth-cert/2026/00001',
  tenant_id: '11111111-1111-4111-8111-111111111111',
  tenant_code: 'KMC',
  citizen_subject: 'keycloak-user-1',
  service_code: 'birth-cert',
  service_name: 'Birth Certificate',
  form_version: 1,
  workflow_code: 'cert-issuance-v1',
  workflow_version: 1,
  current_stage: 'front-office-review',
  status: 'submitted',
  status_label: 'Front-office review',
  pending_role: 'front-office',
  payment_status: 'pending',
  form_data: {
    applicant_name: 'Aritra Sen',
  },
  submitted_at: '2026-05-08T10:00:00.000Z',
  timeline: [
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      from_stage: null,
      to_stage: 'draft',
      verb: 'draft-created',
      actor_role: 'citizen',
      comment: null,
      created_at: '2026-05-08T10:00:00.000Z',
    },
  ],
  comments: [],
  documents: [],
};

describe('PostgresApplicationStore', () => {
  it('creates an application row with normalized FKs and runtime snapshot', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const store = new PostgresApplicationStore({
      application: {
        upsert,
      },
      citizen: {
        findFirst: jest.fn().mockResolvedValue({ id: 'citizen-id' }),
      },
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'service-id' }),
      },
    } as unknown as PrismaService);

    await store.save(application);

    expect(upsert).toHaveBeenCalledWith({
      where: {
        id: application.id,
      },
      create: expect.objectContaining({
        id: application.id,
        tenantId: application.tenant_id,
        citizenId: 'citizen-id',
        serviceId: 'service-id',
        docketNo: application.docket_no,
        serviceCode: application.service_code,
        runtimeSnapshot: application,
        paymentStatus: 'pending',
      }),
      update: expect.objectContaining({
        runtimeSnapshot: application,
        paymentStatus: 'pending',
      }),
    });
  });

  it('rejects persistence when the citizen subject is not persisted', async () => {
    const store = new PostgresApplicationStore({
      application: {
        upsert: jest.fn(),
      },
      citizen: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      tenantService: {
        findFirst: jest.fn().mockResolvedValue({ id: 'service-id' }),
      },
    } as unknown as PrismaService);

    await expect(store.save(application)).rejects.toThrow(BadRequestException);
  });

  it('restores the API response from the runtime snapshot', async () => {
    const store = new PostgresApplicationStore({
      application: {
        findUnique: jest.fn().mockResolvedValue({ runtimeSnapshot: application }),
      },
    } as unknown as PrismaService);

    await expect(store.findByDocketNo(application.docket_no)).resolves.toMatchObject({
      id: application.id,
      docket_no: application.docket_no,
      current_stage: application.current_stage,
    });
  });

  it('generates docket numbers from the persisted application count', async () => {
    const store = new PostgresApplicationStore({
      application: {
        count: jest.fn().mockResolvedValue(4),
      },
    } as unknown as PrismaService);

    await expect(store.nextDocketNo('KMC', 'birth-cert')).resolves.toBe(
      'WBM/KMC/birth-cert/2026/00005',
    );
  });
});
