import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import {
  assertGrievanceTransition,
  type GrievanceStatus,
  isGrievanceStatus,
} from './grievance-lifecycle';
import { resolveGrievanceRouting } from './grievance-routing';
import { addHours, resolveSlaHours } from './grievance-sla';
import { principalHasGrievanceStaffAccess } from './grievance-staff-roles';

import type {
  AssignGrievanceDto,
  CreateGrievanceDto,
  GrievanceCommentDto,
  GrievanceFeedbackDto,
  GrievanceResponse,
  GrievanceTimelineResponse,
  UpdateGrievanceStatusDto,
} from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Grievance as GrievanceRow, Prisma } from '../../generated/prisma';

/** PostgreSQL rejects non-uuid strings bound to `@db.Uuid` columns; branch before querying `id`. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

@Injectable()
export class GrievancesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve `:id` path param — clients may send DB uuid or human-readable grievance_no (e.g. GRV-KMC-2026-000001). */
  private grievanceLookupWhere(
    tenantId: string,
    idOrGrievanceNo: string,
  ): Prisma.GrievanceWhereInput {
    if (isUuid(idOrGrievanceNo)) {
      return { tenantId, id: idOrGrievanceNo };
    }
    return { tenantId, grievanceNo: idOrGrievanceNo };
  }

  private toResponse(row: GrievanceRow): GrievanceResponse {
    return {
      id: row.id,
      tenant_id: row.tenantId,
      citizen_id: row.citizenId,
      grievance_no: row.grievanceNo,
      category: row.category,
      description: row.description,
      location: row.location,
      photo_keys: row.photoKeys as unknown as string[],
      grievance_priority: row.grievancePriority,
      status: row.status,
      routed_role_code: row.routedRoleCode,
      assigned_to_user_id: row.assignedToUserId,
      sla_due_at: row.slaDueAt?.toISOString() ?? null,
      sla_breached_at: row.slaBreachedAt?.toISOString() ?? null,
      rating: row.rating,
      feedback: row.feedback,
      resolved_at: row.resolvedAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  private async requireCitizenId(principal: AuthenticatedPrincipal): Promise<string> {
    const row = await this.prisma.citizen.findFirst({
      where: { tenantId: principal.tenantId, keycloakSubject: principal.subject },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Citizen profile not found; register first');
    }
    return row.id;
  }

  private assertCitizenOnly(principal: AuthenticatedPrincipal): void {
    if (!principal.roles.includes('citizen')) {
      throw new ForbiddenException('Citizen role required');
    }
  }

  private assertStaff(principal: AuthenticatedPrincipal): void {
    if (!principalHasGrievanceStaffAccess(principal.roles)) {
      throw new ForbiddenException('Grievance staff role required');
    }
  }

  private async allocateGrievanceNumber(
    tx: Prisma.TransactionClient,
    tenantId: string,
    tenantCode: string,
  ): Promise<string> {
    const y = new Date().getUTCFullYear();
    const start = new Date(Date.UTC(y, 0, 1));
    const end = new Date(Date.UTC(y + 1, 0, 1));
    const count = await tx.grievance.count({
      where: { tenantId, createdAt: { gte: start, lt: end } },
    });
    return `GRV-${tenantCode}-${y}-${String(count + 1).padStart(6, '0')}`;
  }

  async create(
    principal: AuthenticatedPrincipal,
    dto: CreateGrievanceDto,
  ): Promise<GrievanceResponse> {
    this.assertCitizenOnly(principal);
    const citizenId = await this.requireCitizenId(principal);

    const priority = dto.grievance_priority ?? 'medium';
    const category = dto.category;
    const wardRow = await this.prisma.citizen.findFirst({
      where: { id: citizenId, tenantId: principal.tenantId },
      select: { wardId: true },
    });

    const tenant = await this.prisma.tenant.findFirstOrThrow({
      where: { id: principal.tenantId },
      select: { code: true },
    });

    const hours = await resolveSlaHours(this.prisma, principal.tenantId, category, priority);
    const routing = await resolveGrievanceRouting(
      this.prisma,
      principal.tenantId,
      category,
      priority,
      wardRow?.wardId ?? null,
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const grievanceNo = await this.allocateGrievanceNumber(tx, principal.tenantId, tenant.code);
      const now = new Date();
      const slaDueAt = addHours(now, hours);

      const row = await tx.grievance.create({
        data: {
          tenantId: principal.tenantId,
          citizenId,
          grievanceNo,
          category,
          description: dto.description,
          location: (dto.location ?? {}) as Prisma.InputJsonValue,
          photoKeys: (dto.photos ?? []) as Prisma.InputJsonValue,
          grievancePriority: priority,
          status: routing.assignUserId ? 'under_review' : 'submitted',
          routedRoleCode: routing.targetRoleCode,
          assignedToUserId: routing.assignUserId,
          slaDueAt,
        },
      });

      await tx.grievanceTimelineEntry.create({
        data: {
          tenantId: principal.tenantId,
          grievanceId: row.id,
          eventType: 'created',
          actorSubject: principal.subject,
          body: `Grievance ${grievanceNo} filed`,
          metadata: { category, priority: routing.targetRoleCode },
        },
      });

      if (routing.assignUserId) {
        await tx.grievanceTimelineEntry.create({
          data: {
            tenantId: principal.tenantId,
            grievanceId: row.id,
            eventType: 'assignment',
            actorSubject: 'system:routing',
            body: 'Auto-assigned from routing rule',
            metadata: { assignee: routing.assignUserId },
          },
        });
      }

      return row;
    });

    return this.toResponse(created);
  }

  async list(principal: AuthenticatedPrincipal): Promise<GrievanceResponse[]> {
    const staff = principalHasGrievanceStaffAccess(principal.roles);
    if (staff) {
      const rows = await this.prisma.grievance.findMany({
        where: { tenantId: principal.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return rows.map((r) => this.toResponse(r));
    }

    const citizenId = await this.requireCitizenId(principal);
    const rows = await this.prisma.grievance.findMany({
      where: { tenantId: principal.tenantId, citizenId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => this.toResponse(r));
  }

  async getById(
    principal: AuthenticatedPrincipal,
    grievanceId: string,
  ): Promise<{ grievance: GrievanceResponse; timeline: GrievanceTimelineResponse[] }> {
    const row = await this.prisma.grievance.findFirst({
      where: this.grievanceLookupWhere(principal.tenantId, grievanceId),
    });
    if (!row) {
      throw new NotFoundException('Grievance not found');
    }

    const staff = principalHasGrievanceStaffAccess(principal.roles);
    if (!staff) {
      const citizenId = await this.requireCitizenId(principal);
      if (row.citizenId !== citizenId) {
        throw new NotFoundException('Grievance not found');
      }
    }

    const timelineRows = await this.prisma.grievanceTimelineEntry.findMany({
      where: { grievanceId: row.id, tenantId: principal.tenantId },
      orderBy: { occurredAt: 'asc' },
    });

    const timeline: GrievanceTimelineResponse[] = timelineRows.map((t) => ({
      id: t.id,
      event_type: t.eventType,
      actor_subject: t.actorSubject,
      body: t.body,
      metadata: t.metadata,
      occurred_at: t.occurredAt.toISOString(),
    }));

    return { grievance: this.toResponse(row), timeline };
  }

  async addComment(
    principal: AuthenticatedPrincipal,
    grievanceId: string,
    dto: GrievanceCommentDto,
  ): Promise<{ grievance: GrievanceResponse; timeline: GrievanceTimelineResponse[] }> {
    const { grievance } = await this.getById(principal, grievanceId);
    const canonicalId = grievance.id;

    await this.prisma.grievanceTimelineEntry.create({
      data: {
        tenantId: principal.tenantId,
        grievanceId: canonicalId,
        eventType: 'comment',
        actorSubject: principal.subject,
        body: dto.body,
        metadata: {},
      },
    });

    return this.getById(principal, grievanceId);
  }

  async submitFeedback(
    principal: AuthenticatedPrincipal,
    grievanceId: string,
    dto: GrievanceFeedbackDto,
  ): Promise<GrievanceResponse> {
    this.assertCitizenOnly(principal);
    const citizenId = await this.requireCitizenId(principal);
    const row = await this.prisma.grievance.findFirst({
      where: {
        ...this.grievanceLookupWhere(principal.tenantId, grievanceId),
        citizenId,
      },
    });
    if (!row) {
      throw new NotFoundException('Grievance not found');
    }
    if (row.status !== 'resolved') {
      throw new BadRequestException('Feedback is allowed only when status is resolved');
    }

    assertGrievanceTransition('resolved', 'closed');

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.grievance.update({
        where: { id: row.id },
        data: {
          rating: dto.rating,
          feedback: dto.comment ?? null,
          status: 'closed',
        },
      });
      await tx.grievanceTimelineEntry.create({
        data: {
          tenantId: principal.tenantId,
          grievanceId: row.id,
          eventType: 'feedback',
          actorSubject: principal.subject,
          body: `Rating ${dto.rating}`,
          metadata: { comment: dto.comment ?? null },
        },
      });
      return u;
    });

    return this.toResponse(updated);
  }

  async assign(
    principal: AuthenticatedPrincipal,
    grievanceId: string,
    dto: AssignGrievanceDto,
  ): Promise<GrievanceResponse> {
    this.assertStaff(principal);

    const user = await this.prisma.user.findFirst({
      where: { id: dto.user_id, tenantId: principal.tenantId },
    });
    if (!user) {
      throw new BadRequestException('User not found in tenant');
    }

    const row = await this.prisma.grievance.findFirst({
      where: this.grievanceLookupWhere(principal.tenantId, grievanceId),
    });
    if (!row) {
      throw new NotFoundException('Grievance not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      let nextStatus = row.status as GrievanceStatus;
      if (row.status === 'submitted') {
        assertGrievanceTransition('submitted', 'under_review');
        nextStatus = 'under_review';
      }

      const u = await tx.grievance.update({
        where: { id: row.id },
        data: {
          assignedToUserId: dto.user_id,
          status: nextStatus,
        },
      });

      await tx.grievanceTimelineEntry.create({
        data: {
          tenantId: principal.tenantId,
          grievanceId: row.id,
          eventType: 'assignment',
          actorSubject: principal.subject,
          body: `Assigned to user ${dto.user_id}`,
          metadata: {},
        },
      });

      return u;
    });

    return this.toResponse(updated);
  }

  async updateStatus(
    principal: AuthenticatedPrincipal,
    grievanceId: string,
    dto: UpdateGrievanceStatusDto,
  ): Promise<GrievanceResponse> {
    this.assertStaff(principal);

    if (!isGrievanceStatus(dto.status)) {
      throw new BadRequestException('Invalid status');
    }

    const row = await this.prisma.grievance.findFirst({
      where: this.grievanceLookupWhere(principal.tenantId, grievanceId),
    });
    if (!row) {
      throw new NotFoundException('Grievance not found');
    }

    const from = row.status as GrievanceStatus;
    const to = dto.status as GrievanceStatus;

    try {
      assertGrievanceTransition(from, to);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid transition');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.GrievanceUpdateInput = { status: to };
      if (to === 'resolved') {
        data.resolvedAt = new Date();
      }

      const u = await tx.grievance.update({
        where: { id: row.id },
        data,
      });

      await tx.grievanceTimelineEntry.create({
        data: {
          tenantId: principal.tenantId,
          grievanceId: row.id,
          eventType: 'status_change',
          actorSubject: principal.subject,
          body: dto.note ?? `Status → ${to}`,
          metadata: { from, to },
        },
      });

      return u;
    });

    return this.toResponse(updated);
  }

  async sweepSlaBreaches(principal: AuthenticatedPrincipal): Promise<{ breached_count: number }> {
    this.assertStaff(principal);

    const now = new Date();
    const open = await this.prisma.grievance.findMany({
      where: {
        tenantId: principal.tenantId,
        slaDueAt: { lt: now },
        slaBreachedAt: null,
        status: { notIn: ['resolved', 'closed'] },
      },
    });

    let count = 0;
    for (const row of open) {
      await this.prisma.$transaction(async (tx) => {
        await tx.grievance.update({
          where: { id: row.id },
          data: { slaBreachedAt: now },
        });
        await tx.grievanceTimelineEntry.create({
          data: {
            tenantId: principal.tenantId,
            grievanceId: row.id,
            eventType: 'sla_breach',
            actorSubject: 'system:sla-sweep',
            body: 'SLA deadline passed',
            metadata: { sla_due_at: row.slaDueAt?.toISOString() ?? null },
          },
        });
      });
      count += 1;
    }

    return { breached_count: count };
  }
}
