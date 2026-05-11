import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../common/database/prisma.service';

import { GrievancesService } from './grievances.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

const describeDb = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeDb('Sprint 4.1 grievance persistence', () => {
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

  const svc = new GrievancesService(prisma);

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
  });

  afterAll(async () => {
    await prisma.grievanceTimelineEntry.deleteMany({ where: { tenantId } });
    await prisma.grievance.deleteMany({ where: { tenantId } });
    await prisma.slaPolicy.deleteMany({ where: { tenantId } });
    await prisma.grievanceRoutingRule.deleteMany({ where: { tenantId } });
    await prisma.citizen.deleteMany({ where: { id: citizenId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
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
  });
});
