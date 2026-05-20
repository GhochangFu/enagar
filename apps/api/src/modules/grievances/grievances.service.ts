import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  isCitizenSelfServicePrincipal,
  principalIsCitizenPortal,
  resolveCitizenMunicipalityForWrite,
  resolveMunicipalityTenantIdFromScopeCode,
} from '../../common/auth/citizen-scope';
import { PrismaService } from '../../common/database/prisma.service';
import { ensureMunicipalCitizenRow } from '../citizen/ensure-municipal-citizen-row';
import { CITIZEN_PORTAL_TENANT_ID } from '../tenants/tenant.seed';
import { TenantsService } from '../tenants/tenants.service';

import {
  assertGrievanceFilingMatchesCatalogue,
  GrievanceCatalogueService,
} from './grievance-catalogue.service';
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
  CreateGrievanceEvidenceUploadIntentDto,
  GrievanceAttachmentResponse,
  GrievanceCommentDto,
  GrievanceEvidenceUploadIntentResponse,
  GrievanceFeedbackDto,
  GrievanceReopenDto,
  GrievanceResponse,
  GrievanceTimelineResponse,
  RegisterGrievanceAttachmentDto,
  UpdateGrievanceStatusDto,
} from './dto';
import type { GrievanceCatalogueResponse } from './grievance-catalogue.types';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Grievance as GrievanceRow, Prisma } from '../../generated/prisma';
import type { ApplicationReadScope } from '../applications/dto';

/** PostgreSQL rejects non-uuid strings bound to `@db.Uuid` columns; branch before querying `id`. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/** One-time reopen window after staff marks resolved (mirror `docs/glossary.md` SLA / re-open wording). */
const GRIEVANCE_REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** First SLA breach escalation: bump routing queue so admins see the backlog (Master Sprint 4.3). */
function escalationRoleAfterBreach(routedRoleCode: string | null): string {
  if (routedRoleCode === 'municipality_clerk') {
    return 'municipality_admin';
  }
  if (routedRoleCode === 'municipality_admin') {
    return 'tenant_admin';
  }
  if (routedRoleCode === 'tenant_admin') {
    return 'state_admin';
  }
  return 'municipality_admin';
}

/** Max structured attachments beyond legacy `photo_keys` JSON array. */
const MAX_ATTACHMENTS_PER_GRIEVANCE = 12;

const GRIEVANCE_EVIDENCE_UPLOAD_TTL_MS = 15 * 60 * 1000;

const GRIEVANCE_EVIDENCE_MAX_MB: Record<string, number> = {
  'image/jpeg': 8,
  'image/png': 8,
  'image/webp': 8,
  'video/mp4': 25,
  'video/webm': 25,
  'video/quicktime': 25,
};

@Injectable()
export class GrievancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantsService,
    private readonly catalogue: GrievanceCatalogueService,
  ) {}

  /** Resolve `:id` path param — clients may send DB uuid or human-readable grievance_no (e.g. GRV-KMC-2026-000001). */
  private grievanceLookupWhere(
    tenantId: string,
    idOrGrievanceNo: string,
  ): Prisma.GrievanceWhereInput {
    return { ...this.grievanceIdentifierWhere(idOrGrievanceNo), tenantId };
  }

  private grievanceIdentifierWhere(idOrGrievanceNo: string): Prisma.GrievanceWhereInput {
    if (isUuid(idOrGrievanceNo)) {
      return { id: idOrGrievanceNo };
    }
    return { grievanceNo: idOrGrievanceNo };
  }

  private grievanceLocationToJson(location: CreateGrievanceDto['location']): Prisma.InputJsonValue {
    if (!location) {
      return {};
    }
    const o: Record<string, string | number> = {};
    if (location.address !== undefined) {
      o.address = location.address;
    }
    if (location.ward_hint !== undefined) {
      o.ward_hint = location.ward_hint;
    }
    if (location.latitude !== undefined) {
      o.latitude = location.latitude;
    }
    if (location.longitude !== undefined) {
      o.longitude = location.longitude;
    }
    return o as Prisma.InputJsonValue;
  }

  /** Reject traversal / opaque schemes in client-supplied object keys */
  private createGrievanceEvidenceObjectKey(
    tenantCode: string,
    evidenceId: string,
    originalName: string,
  ): string {
    const safeName = originalName.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    return `tenants/${tenantCode.toLowerCase()}/grievances/evidence/${evidenceId}/${safeName}`;
  }

  private signedEvidenceUrl(
    action: 'upload' | 'download',
    objectKey: string,
    now: Date,
    ttlMs: number,
  ): string {
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
    return `minio://enagar-local/${objectKey}?action=${action}&expires_at=${encodeURIComponent(expiresAt)}`;
  }

  private assertSafeStorageKey(key: string): void {
    const k = key.trim();
    if (!k || k.includes('..') || k.startsWith('/') || k.includes('\\')) {
      throw new BadRequestException('Invalid storage_key');
    }
    for (let i = 0; i < k.length; i += 1) {
      const code = k.charCodeAt(i);
      if (code < 0x20) {
        throw new BadRequestException('Invalid storage_key');
      }
    }
  }

  private toResponse(row: GrievanceRow): GrievanceResponse {
    return {
      id: row.id,
      tenant_id: row.tenantId,
      citizen_id: row.citizenId,
      grievance_no: row.grievanceNo,
      category: row.category,
      subtype_code: row.subtypeCode,
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

  private async ensureCitizenForTargetTenant(
    principal: AuthenticatedPrincipal,
    targetTenantId: string,
  ): Promise<string> {
    const subject = principal.subject;
    if (!subject) {
      throw new BadRequestException('Citizen identity (sub) is required');
    }

    return ensureMunicipalCitizenRow(this.prisma, subject, targetTenantId);
  }

  async create(
    principal: AuthenticatedPrincipal,
    dto: CreateGrievanceDto,
    municipalityScopeFromHeader?: string,
  ): Promise<GrievanceResponse> {
    this.assertCitizenOnly(principal);

    const { tenantId, tenantCode } = resolveCitizenMunicipalityForWrite(
      principal,
      this.tenants.list(),
      municipalityScopeFromHeader,
    );

    const citizenId = await this.ensureCitizenForTargetTenant(principal, tenantId);

    const priority = dto.grievance_priority ?? 'medium';
    const category = dto.category.trim();
    const subtypeCode = dto.subtype_code?.trim() || null;

    await assertGrievanceFilingMatchesCatalogue(this.prisma, tenantId, {
      category,
      subtype_code: subtypeCode ?? undefined,
    });
    const wardRow = await this.prisma.citizen.findFirst({
      where: { id: citizenId, tenantId },
      select: { wardId: true },
    });

    const hours = await resolveSlaHours(this.prisma, tenantId, category, priority);
    const routing = await resolveGrievanceRouting(
      this.prisma,
      tenantId,
      category,
      priority,
      wardRow?.wardId ?? null,
    );

    const locationJson = this.grievanceLocationToJson(dto.location);

    const created = await this.prisma.$transaction(async (tx) => {
      const grievanceNo = await this.allocateGrievanceNumber(tx, tenantId, tenantCode);
      const now = new Date();
      const slaDueAt = addHours(now, hours);

      const row = await tx.grievance.create({
        data: {
          tenantId,
          citizenId,
          grievanceNo,
          category,
          subtypeCode,
          description: dto.description,
          location: locationJson,
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
          tenantId,
          grievanceId: row.id,
          eventType: 'created',
          actorSubject: principal.subject,
          body: `Grievance ${grievanceNo} filed`,
          metadata: {
            category,
            subtype_code: subtypeCode,
            priority: routing.targetRoleCode,
          },
        },
      });

      if (routing.assignUserId) {
        await tx.grievanceTimelineEntry.create({
          data: {
            tenantId,
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

  async getCatalogueForPrincipal(
    principal: AuthenticatedPrincipal,
    municipalityScopeFromHeader?: string,
  ): Promise<GrievanceCatalogueResponse> {
    const staff = principalHasGrievanceStaffAccess(principal.roles);
    if (staff) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: principal.tenantId },
        select: { id: true, code: true },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found');
      }
      return this.catalogue.getActiveCatalogue(tenant.id, tenant.code);
    }

    const { tenantId, tenantCode } = resolveCitizenMunicipalityForWrite(
      principal,
      this.tenants.list(),
      municipalityScopeFromHeader,
    );
    return this.catalogue.getActiveCatalogue(tenantId, tenantCode);
  }

  async list(
    principal: AuthenticatedPrincipal,
    readScope?: ApplicationReadScope,
  ): Promise<GrievanceResponse[]> {
    const staff = principalHasGrievanceStaffAccess(principal.roles);
    if (staff) {
      const rows = await this.prisma.grievance.findMany({
        where: { tenantId: principal.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return rows.map((r) => this.toResponse(r));
    }

    if (principalIsCitizenPortal(principal) && isCitizenSelfServicePrincipal(principal)) {
      const scoped = readScope?.municipalityTenantCode?.trim();
      const where: Prisma.GrievanceWhereInput = {
        citizen: { keycloakSubject: principal.subject },
      };

      if (scoped) {
        const tid = resolveMunicipalityTenantIdFromScopeCode(scoped);
        if (!tid) {
          throw new BadRequestException('Invalid tenant scope');
        }
        where.tenantId = tid;
      } else {
        where.tenantId = { not: CITIZEN_PORTAL_TENANT_ID };
      }

      const rows = await this.prisma.grievance.findMany({
        where,
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
    readScope?: ApplicationReadScope,
  ): Promise<{ grievance: GrievanceResponse; timeline: GrievanceTimelineResponse[] }> {
    const staff = principalHasGrievanceStaffAccess(principal.roles);

    if (staff) {
      const row = await this.prisma.grievance.findFirst({
        where: this.grievanceLookupWhere(principal.tenantId, grievanceId),
      });
      if (!row) {
        throw new NotFoundException('Grievance not found');
      }
      return this.loadGrievanceWithTimeline(row);
    }

    if (principalIsCitizenPortal(principal) && isCitizenSelfServicePrincipal(principal)) {
      const scoped = readScope?.municipalityTenantCode?.trim();
      const where: Prisma.GrievanceWhereInput = {
        ...this.grievanceIdentifierWhere(grievanceId),
        citizen: { keycloakSubject: principal.subject },
      };

      if (scoped) {
        const tid = resolveMunicipalityTenantIdFromScopeCode(scoped);
        if (!tid) {
          throw new BadRequestException('Invalid tenant scope');
        }
        where.tenantId = tid;
      }

      const row = await this.prisma.grievance.findFirst({
        where,
      });
      if (!row) {
        throw new NotFoundException('Grievance not found');
      }
      return this.loadGrievanceWithTimeline(row);
    }

    const row = await this.prisma.grievance.findFirst({
      where: this.grievanceLookupWhere(principal.tenantId, grievanceId),
    });
    if (!row) {
      throw new NotFoundException('Grievance not found');
    }

    const citizenId = await this.requireCitizenId(principal);
    if (row.citizenId !== citizenId) {
      throw new NotFoundException('Grievance not found');
    }

    return this.loadGrievanceWithTimeline(row);
  }

  private async loadGrievanceWithTimeline(row: GrievanceRow): Promise<{
    grievance: GrievanceResponse;
    timeline: GrievanceTimelineResponse[];
  }> {
    const timelineRows = await this.prisma.grievanceTimelineEntry.findMany({
      where: { grievanceId: row.id, tenantId: row.tenantId },
      orderBy: { occurredAt: 'asc' },
    });

    const attachmentRows = await this.prisma.grievanceAttachment.findMany({
      where: { grievanceId: row.id, tenantId: row.tenantId },
      orderBy: { createdAt: 'asc' },
    });

    const attachments: GrievanceAttachmentResponse[] = attachmentRows.map((a) => ({
      id: a.id,
      storage_key: a.storageKey,
      content_type: a.contentType,
      created_at: a.createdAt.toISOString(),
    }));

    const timeline: GrievanceTimelineResponse[] = timelineRows.map((t) => ({
      id: t.id,
      event_type: t.eventType,
      actor_subject: t.actorSubject,
      body: t.body,
      metadata: t.metadata,
      occurred_at: t.occurredAt.toISOString(),
    }));

    return { grievance: { ...this.toResponse(row), attachments }, timeline };
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
        tenantId: grievance.tenant_id,
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
    readScope?: ApplicationReadScope,
  ): Promise<GrievanceResponse> {
    this.assertCitizenOnly(principal);

    const { grievance } = await this.getById(principal, grievanceId, readScope);
    if (grievance.status !== 'resolved') {
      throw new BadRequestException('Feedback is allowed only when status is resolved');
    }

    assertGrievanceTransition('resolved', 'closed');

    const canonicalId = grievance.id;

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.grievance.update({
        where: { id: canonicalId },
        data: {
          rating: dto.rating,
          feedback: dto.comment ?? null,
          status: 'closed',
        },
      });
      await tx.grievanceTimelineEntry.create({
        data: {
          tenantId: u.tenantId,
          grievanceId: u.id,
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

  /**
   * Citizen re-opens a grievance shortly after municipal staff marked `resolved`,
   * before rating/feedback closes the case (`POST …/feedback`). Portal JWT paths use the same
   * read scope semantics as GET detail.
   */
  async reopenCitizenCase(
    principal: AuthenticatedPrincipal,
    grievanceId: string,
    dto: GrievanceReopenDto,
    readScope?: ApplicationReadScope,
  ): Promise<GrievanceResponse> {
    this.assertCitizenOnly(principal);

    const { grievance } = await this.getById(principal, grievanceId, readScope);
    if (grievance.status !== 'resolved') {
      throw new BadRequestException('Re-open is allowed only while status is resolved');
    }

    const resolvedAt = grievance.resolved_at ? new Date(grievance.resolved_at) : null;
    if (!resolvedAt || Number.isNaN(resolvedAt.getTime())) {
      throw new BadRequestException('Grievance has no resolved timestamp');
    }

    const elapsed = Date.now() - resolvedAt.getTime();
    if (elapsed > GRIEVANCE_REOPEN_WINDOW_MS) {
      throw new BadRequestException('Re-open window expired (resolve was more than 7 days ago)');
    }

    try {
      assertGrievanceTransition('resolved', 'under_review');
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid transition');
    }

    const canonicalId = grievance.id;
    const tenantId = grievance.tenant_id;

    const hours = await resolveSlaHours(
      this.prisma,
      tenantId,
      grievance.category,
      grievance.grievance_priority,
    );

    const now = new Date();
    const slaDueAt = addHours(now, hours);

    const reopenBody = dto.reason?.trim()
      ? `Citizen re-opened: ${dto.reason.trim()}`
      : 'Citizen re-opened the grievance';

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.grievance.update({
        where: { id: canonicalId },
        data: {
          status: 'under_review',
          resolvedAt: null,
          slaBreachedAt: null,
          slaDueAt,
        },
      });
      await tx.grievanceTimelineEntry.create({
        data: {
          tenantId,
          grievanceId: canonicalId,
          eventType: 'reopen',
          actorSubject: principal.subject,
          body: reopenBody,
          metadata: {
            reopened_within_hours: Math.round(elapsed / 3600000),
            previous_resolved_at: resolvedAt.toISOString(),
          },
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

  /**
   * Presigned-style upload target for grievance photo/video evidence (citizen filing).
   * Local dev uses `minio://` URLs; clients may skip PUT and register metadata only.
   */
  async createEvidenceUploadIntent(
    principal: AuthenticatedPrincipal,
    dto: CreateGrievanceEvidenceUploadIntentDto,
    municipalityScopeFromHeader?: string,
  ): Promise<GrievanceEvidenceUploadIntentResponse> {
    this.assertCitizenOnly(principal);

    const maxMb = GRIEVANCE_EVIDENCE_MAX_MB[dto.mime_type];
    if (!maxMb || dto.size_mb > maxMb) {
      throw new BadRequestException(`File size exceeds ${maxMb} MB for ${dto.mime_type}`);
    }

    const { tenantCode } = resolveCitizenMunicipalityForWrite(
      principal,
      this.tenants.list(),
      municipalityScopeFromHeader,
    );

    const createdAt = new Date();
    const evidenceId = randomUUID();
    const storageKey = this.createGrievanceEvidenceObjectKey(
      tenantCode,
      evidenceId,
      dto.original_name,
    );
    this.assertSafeStorageKey(storageKey);

    return {
      storage_key: storageKey,
      upload_url: this.signedEvidenceUrl(
        'upload',
        storageKey,
        createdAt,
        GRIEVANCE_EVIDENCE_UPLOAD_TTL_MS,
      ),
      upload_expires_at: new Date(
        createdAt.getTime() + GRIEVANCE_EVIDENCE_UPLOAD_TTL_MS,
      ).toISOString(),
      mime_type: dto.mime_type,
      original_name: dto.original_name,
    };
  }

  /**
   * Persist attachment metadata after the client uploads binary to object storage.
   * Ownership is enforced via the same read path as grievance detail (portal scope supported).
   */
  async registerCitizenAttachment(
    principal: AuthenticatedPrincipal,
    grievanceId: string,
    dto: RegisterGrievanceAttachmentDto,
    readScope?: ApplicationReadScope,
  ): Promise<GrievanceAttachmentResponse> {
    this.assertCitizenOnly(principal);
    this.assertSafeStorageKey(dto.storage_key);
    const { grievance } = await this.getById(principal, grievanceId, readScope);
    const canonicalId = grievance.id;

    const count = await this.prisma.grievanceAttachment.count({
      where: { grievanceId: canonicalId, tenantId: grievance.tenant_id },
    });
    if (count >= MAX_ATTACHMENTS_PER_GRIEVANCE) {
      throw new BadRequestException('Maximum attachments reached for this grievance');
    }

    const ct = dto.content_type?.trim();
    const row = await this.prisma.grievanceAttachment.create({
      data: {
        tenantId: grievance.tenant_id,
        grievanceId: canonicalId,
        storageKey: dto.storage_key.trim(),
        contentType: ct && ct.length > 0 ? ct.slice(0, 120) : 'application/octet-stream',
      },
    });

    return {
      id: row.id,
      storage_key: row.storageKey,
      content_type: row.contentType,
      created_at: row.createdAt.toISOString(),
    };
  }

  /**
   * Citizens / open-data: counts only — no narratives, no row-level disclosure.
   */
  async getPublicAggregate(params: { tenantCode?: string; windowDays?: number }): Promise<{
    window_days: number;
    generated_at: string;
    tenant_code: string | null;
    totals_by_status: Record<string, number>;
    totals_by_category: Record<string, number>;
    breached_open_count: number;
    metadata: { legacy_unmapped: number };
  }> {
    const windowDaysRaw = params.windowDays ?? 30;
    const window_days = Math.min(365, Math.max(1, Math.floor(Number(windowDaysRaw)) || 30));
    const since = new Date(Date.now() - window_days * 86_400_000);
    const where: Prisma.GrievanceWhereInput = {
      createdAt: { gte: since },
    };
    let tenant_code: string | null = null;

    const trimmed = params.tenantCode?.trim();
    if (trimmed) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { code: trimmed },
        select: { id: true, code: true },
      });
      if (!tenant) {
        throw new NotFoundException('Unknown tenant_code');
      }
      where.tenantId = tenant.id;
      tenant_code = tenant.code;
    }

    const [byStatus, byCategory, breachedOpen] = await Promise.all([
      this.prisma.grievance.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.grievance.groupBy({
        by: ['category'],
        where,
        _count: true,
      }),
      this.prisma.grievance.count({
        where: {
          ...where,
          slaBreachedAt: { not: null },
          status: { notIn: ['resolved', 'closed'] },
        },
      }),
    ]);

    const totals_by_status: Record<string, number> = {};
    for (const row of byStatus) {
      totals_by_status[row.status] = row._count;
    }

    const activeCatalogueCodes = new Set<string>();
    if (where.tenantId && typeof where.tenantId === 'string') {
      const catalogueRows = await this.prisma.tenantGrievanceCategory.findMany({
        where: { tenantId: where.tenantId, isActive: true },
        select: { code: true },
      });
      for (const row of catalogueRows) {
        activeCatalogueCodes.add(row.code);
      }
      activeCatalogueCodes.add('other');
    }

    let legacy_unmapped = 0;
    const totals_by_category: Record<string, number> = {};
    for (const row of byCategory) {
      const bucket =
        activeCatalogueCodes.size === 0 || activeCatalogueCodes.has(row.category)
          ? row.category
          : 'other';
      if (bucket === 'other' && row.category !== 'other' && activeCatalogueCodes.size > 0) {
        legacy_unmapped += row._count;
      }
      totals_by_category[bucket] = (totals_by_category[bucket] ?? 0) + row._count;
    }

    return {
      window_days,
      generated_at: new Date().toISOString(),
      tenant_code,
      totals_by_status,
      totals_by_category,
      breached_open_count: breachedOpen,
      metadata: { legacy_unmapped },
    };
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
      const nextRole = escalationRoleAfterBreach(row.routedRoleCode);
      await this.prisma.$transaction(async (tx) => {
        await tx.grievance.update({
          where: { id: row.id },
          data: {
            slaBreachedAt: now,
            routedRoleCode: nextRole,
            assignedToUserId: null,
          },
        });
        await tx.grievanceTimelineEntry.create({
          data: {
            tenantId: principal.tenantId,
            grievanceId: row.id,
            eventType: 'sla_breach',
            actorSubject: 'system:sla-sweep',
            body: 'SLA deadline passed',
            metadata: {
              sla_due_at: row.slaDueAt?.toISOString() ?? null,
              escalated_role_code: nextRole,
              previous_routed_role_code: row.routedRoleCode ?? null,
            },
          },
        });
        await tx.grievanceTimelineEntry.create({
          data: {
            tenantId: principal.tenantId,
            grievanceId: row.id,
            eventType: 'sla_escalation',
            actorSubject: 'system:sla-sweep',
            body: `Escalated queue to role ${nextRole}`,
            metadata: {
              escalated_role_code: nextRole,
              previous_assignee_user_id: row.assignedToUserId ?? null,
            },
          },
        });

        /** In-app SLA breach ping (deep link carries docket ID only — no PII body). Phase 12 may fan out native push here. */
        await tx.notification.create({
          data: {
            tenantId: row.tenantId,
            citizenId: row.citizenId,
            type: 'sla_breach',
            title: 'Grievance deadline passed',
            body: `${row.grievanceNo} — service timeline crossed. Tap to track your case.`,
            deepLink: `grievances/${row.grievanceNo}`,
          },
        });
      });
      count += 1;
    }

    return { breached_count: count };
  }
}
