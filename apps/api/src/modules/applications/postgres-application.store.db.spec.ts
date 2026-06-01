import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../common/database/prisma.service';

import { PostgresApplicationStore } from './postgres-application.store';

import type { ApplicationResponse } from './dto';

const describeDb = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeDb('PostgresApplicationStore DB integration', () => {
  const prisma = new PrismaService();
  const store = new PostgresApplicationStore(prisma);
  const tenantId = randomUUID();
  const tenantCode = `T${Date.now().toString().slice(-8)}`;
  const serviceCode = 'birth-cert-db';
  const citizenSubject = `citizen-${Date.now()}`;
  const applicationId = randomUUID();
  const docketNo = `WBM/${tenantCode}/${serviceCode}/2026/00001`;

  const application: ApplicationResponse = {
    id: applicationId,
    docket_no: docketNo,
    tenant_id: tenantId,
    tenant_code: tenantCode,
    citizen_subject: citizenSubject,
    service_code: serviceCode,
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
        id: randomUUID(),
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

  beforeAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });

    const tenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        code: tenantCode,
        name: 'Phase 3.1A Test Tenant',
        languagesEnabled: ['en', 'bn', 'hi'],
      },
    });
    const department = await prisma.tenantDepartment.create({
      data: {
        tenantId: tenant.id,
        code: 'birth-death',
        name: { en: 'Birth & Death', bn: 'Birth & Death', hi: 'Birth & Death' },
      },
    });
    const category = await prisma.tenantServiceCategory.create({
      data: {
        tenantId: tenant.id,
        departmentId: department.id,
        code: 'cert',
        name: { en: 'Test', bn: 'Test', hi: 'Test' },
      },
    });
    await prisma.citizen.create({
      data: {
        tenantId: tenant.id,
        keycloakSubject: citizenSubject,
        mobile: '9876500001',
        name: 'Aritra Sen',
      },
    });
    await prisma.tenantService.create({
      data: {
        tenantId: tenant.id,
        code: serviceCode,
        categoryId: category.id,
        departmentId: department.id,
        globalCategoryCode: 'cert',
        name: { en: 'Birth Certificate', bn: 'Birth Certificate', hi: 'Birth Certificate' },
        description: { en: 'Test service', bn: 'Test service', hi: 'Test service' },
        effectiveFeeConfig: { amount_paise: 5000, currency: 'INR' },
        requiredDocuments: [],
      },
    });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('persists and restores an application through Postgres', async () => {
    await store.save(application);

    await expect(store.findByDocketNo(docketNo)).resolves.toMatchObject({
      id: application.id,
      docket_no: docketNo,
      citizen_subject: citizenSubject,
      service_code: serviceCode,
      payment_status: 'pending',
    });
  });
});
