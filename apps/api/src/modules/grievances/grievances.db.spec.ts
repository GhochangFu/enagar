import { randomUUID } from 'node:crypto';

import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';
import { TenantsService } from '../tenants/tenants.service';

import { seedMinimalTenantGrievanceCatalogue } from './grievance-catalogue.seed';
import { GrievanceCatalogueService } from './grievance-catalogue.service';
import { GrievancesService } from './grievances.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

const describeDb = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeDb('Phase 4 grievance persistence', () => {
  const prisma = new PrismaService();
  const tenantId = randomUUID();
  const citizenSubject = `grief-cit-${tenantId.slice(0, 8)}`;
  const citizenId = randomUUID();
  const tenantCode = `G${tenantId.replace(/-/g, '').slice(0, 6)}`;

  const citizenPrincipal = {
    subject: citizenSubject,
    tenantId,
    tenantCode,
    roles: ['citizen'],
    expiresAt: new Date(Date.now() + 3_600_000),
  } satisfies AuthenticatedPrincipal;

  const clerkPrincipal = {
    subject: `grief-clerk-${tenantId.slice(0, 8)}`,
    tenantId,
    tenantCode,
    roles: ['municipality_clerk'],
    expiresAt: new Date(Date.now() + 3_600_000),
  } satisfies AuthenticatedPrincipal;

  const catalogue = new GrievanceCatalogueService(prisma);
  const svc = new GrievancesService(
    prisma,
    new TenantsService(),
    catalogue,
    new ObjectStorageService(),
  );

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        code: tenantCode,
        name: 'Grievance 4.1 fixture tenant',
        languagesEnabled: ['en', 'bn', 'hi'],
      },
    });
    await prisma.citizen.create({
      data: {
        id: citizenId,
        tenantId,
        mobile: '9876001234',
        name: 'Fixture citizen',
        keycloakSubject: citizenSubject,
      },
    });
    await prisma.slaPolicy.createMany({
      data: [
        {
          tenantId,
          sortOrder: 0,
          categoryMatch: 'roads',
          grievancePriorityMatch: null,
          hoursToResolve: 48,
        },
        {
          tenantId,
          sortOrder: 100,
          categoryMatch: null,
          grievancePriorityMatch: null,
          hoursToResolve: 72,
        },
      ],
    });
    await prisma.grievanceRoutingRule.createMany({
      data: [
        {
          tenantId,
          sortOrder: 0,
          categoryMatch: 'roads',
          grievancePriorityMatch: null,
          targetRoleCode: 'municipality_clerk',
        },
        {
          tenantId,
          sortOrder: 100,
          categoryMatch: null,
          grievancePriorityMatch: null,
          targetRoleCode: 'municipality_clerk',
        },
      ],
    });
    await seedMinimalTenantGrievanceCatalogue(prisma, tenantId);
  });

  afterAll(async () => {
    await prisma.grievanceTimelineEntry.deleteMany({ where: { tenantId } });
    await prisma.grievanceAttachment.deleteMany({ where: { tenantId } });
    await prisma.grievance.deleteMany({ where: { tenantId } });
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.slaPolicy.deleteMany({ where: { tenantId } });
    await prisma.grievanceRoutingRule.deleteMany({ where: { tenantId } });
    await prisma.tenantGrievanceSubtype.deleteMany({ where: { tenantId } });
    await prisma.tenantGrievanceCategory.deleteMany({ where: { tenantId } });
    await prisma.citizen.deleteMany({ where: { id: citizenId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('rejects unknown category when tenant catalogue is configured', async () => {
    await expect(
      svc.create(citizenPrincipal, {
        category: 'not-a-real-category',
        description: 'Should fail validation',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates grievance with SLA + routing metadata; staff advances status; sweep breach', async () => {
    const g = await svc.create(citizenPrincipal, {
      category: 'sanitation',
      description: 'Overflowing dustbin',
      grievance_priority: 'medium',
    });
    expect(g.status).toBe('submitted');
    expect(g.routed_role_code).toBe('municipality_clerk');
    expect(g.sla_due_at).toBeTruthy();

    const listed = await svc.list(citizenPrincipal);
    expect(listed.some((x) => x.id === g.id)).toBe(true);

    const detail = await svc.getById(citizenPrincipal, g.id);
    expect(detail.timeline.some((e) => e.event_type === 'created')).toBe(true);

    const detailByPublicNo = await svc.getById(citizenPrincipal, g.grievance_no);
    expect(detailByPublicNo.grievance.id).toBe(g.id);
    expect(detailByPublicNo.timeline).toHaveLength(detail.timeline.length);

    await svc.updateStatus(clerkPrincipal, g.id, { status: 'in_progress' });
    await svc.updateStatus(clerkPrincipal, g.id, { status: 'resolved' });

    await svc.submitFeedback(citizenPrincipal, g.id, { rating: 4, comment: 'Timely fix' });
    const closed = await prisma.grievance.findUniqueOrThrow({ where: { id: g.id } });
    expect(closed.status).toBe('closed');

    const g2 = await svc.create(citizenPrincipal, {
      category: 'roads',
      description: 'Pothole',
    });
    const past = new Date(Date.now() - 86400000);
    await prisma.grievance.update({
      where: { id: g2.id },
      data: { slaDueAt: past, status: 'in_progress' },
    });
    const sweep = await svc.sweepSlaBreaches(clerkPrincipal);
    expect(sweep.breached_count).toBeGreaterThanOrEqual(1);
    const breached = await prisma.grievance.findUniqueOrThrow({ where: { id: g2.id } });
    expect(breached.slaBreachedAt).toBeTruthy();
    expect(breached.routedRoleCode).toBe('municipality_admin');
    expect(breached.assignedToUserId).toBeNull();

    const escRows = await prisma.grievanceTimelineEntry.findMany({
      where: { grievanceId: g2.id, eventType: { in: ['sla_breach', 'sla_escalation'] } },
    });
    expect(escRows).toHaveLength(2);

    const breachNotif = await prisma.notification.findFirst({
      where: { citizenId, type: 'sla_breach', tenantId },
    });
    expect(breachNotif).toBeTruthy();
    expect(breachNotif!.body).toContain(g2.grievance_no);

    await expect(svc.sweepSlaBreaches(clerkPrincipal)).resolves.toMatchObject({
      breached_count: 0,
    });
  });

  it('allows citizen attachment registration on owned grievances', async () => {
    const grv = await svc.create(citizenPrincipal, {
      category: 'trade',
      description: 'Licence signage',
      grievance_priority: 'medium',
    });
    const attachment = await svc.registerCitizenAttachment(citizenPrincipal, grv.id, {
      storage_key: `tenants/${tenantCode.toLowerCase()}/grievances/demo/photo.jpg`,
      content_type: 'image/jpeg',
    });
    expect(attachment.content_type).toBe('image/jpeg');
    const detail = await svc.getById(citizenPrincipal, grv.id);
    expect(detail.grievance.attachments ?? []).toHaveLength(1);
  });

  it('rejects attachment register when storage is enabled but object is missing', async () => {
    const storage = new ObjectStorageService();
    jest.spyOn(storage, 'isEnabled').mockReturnValue(true);
    jest.spyOn(storage, 'headObject').mockResolvedValue(null);
    const strictSvc = new GrievancesService(prisma, new TenantsService(), catalogue, storage);
    const grv = await strictSvc.create(citizenPrincipal, {
      category: 'trade',
      description: 'Missing object',
      grievance_priority: 'low',
    });
    await expect(
      strictSvc.registerCitizenAttachment(citizenPrincipal, grv.id, {
        storage_key: `tenants/${tenantCode.toLowerCase()}/grievances/evidence/missing.jpg`,
        content_type: 'image/jpeg',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Sprint 4.3 citizen reopen restores triage; stale resolved_at rejects reopen', async () => {
    const grv = await svc.create(citizenPrincipal, {
      category: 'parks',
      description: 'Broken swing',
      grievance_priority: 'low',
    });
    await svc.updateStatus(clerkPrincipal, grv.id, { status: 'under_review' });
    await svc.updateStatus(clerkPrincipal, grv.id, { status: 'resolved' });

    const reopened = await svc.reopenCitizenCase(citizenPrincipal, grv.grievance_no, {
      reason: 'Still unsafe',
    });
    expect(reopened.status).toBe('under_review');
    expect(reopened.resolved_at).toBeNull();
    expect(reopened.sla_breached_at).toBeNull();
    expect(reopened.sla_due_at).toBeTruthy();

    const tl = await svc.getById(citizenPrincipal, grv.id);
    expect(tl.timeline.some((e) => e.event_type === 'reopen')).toBe(true);

    await svc.updateStatus(clerkPrincipal, grv.id, { status: 'resolved' });

    await prisma.grievance.update({
      where: { id: grv.id },
      data: { resolvedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    });

    await expect(
      svc.reopenCitizenCase(citizenPrincipal, grv.grievance_no, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
