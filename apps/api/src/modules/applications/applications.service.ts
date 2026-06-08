import { randomUUID } from 'node:crypto';

import { validateSubmission } from '@enagar/forms';
import {
  birthCertificateSchema,
  communityHallSchema,
  propertyTaxSchema,
  rtiSchema,
  tradeLicenceSchema,
} from '@enagar/forms/fixtures';
import {
  calculateSlaDueAt,
  getInitialStage,
  evaluateTransition,
  CITIZEN_FEEDBACK_VERB,
  workflowForPattern,
} from '@enagar/workflow';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import {
  isCitizenSelfServicePrincipal,
  principalIsCitizenPortal,
  resolveCitizenMunicipalityForWrite,
} from '../../common/auth/citizen-scope';
import { PrismaService } from '../../common/database/prisma.service';
import { resolveBookingChargesSummary } from '../bookings/booking-charges-summary.util';
import {
  mapApplicationDocumentRow,
  toApplicationDocumentResponse,
} from '../documents/application-document.mapper';
import {
  applyFeeSettlementPatch,
  applicationFeePaidForSubmit,
  applicationPaymentSnapshotIncomplete,
  buildInitialFeeSettlement,
  coerceFeeSettlementSnapshot,
  hydrateApplicationPaymentSnapshot,
  mergeFeeSettlementPreservingStatus,
  rollupPaymentStatus,
} from '../payments/fee-settlement.util';
import { attachPendingAtLabels } from '../services/pending-at-label.util';
import { ServicesService } from '../services/services.service';
import { pendingActorFromWorkflowStage } from '../services/workflow-designation.mapper';
import { TenantsService } from '../tenants/tenants.service';

import { APPLICATION_STORE } from './application-store';

import type { ApplicationStore } from './application-store';
import type {
  ApplicationCommentResponse,
  ApplicationFeedbackDto,
  ApplicationReadScope,
  ApplicationResponse,
  ApplicationSummaryResponse,
  CancelApplicationDto,
  CommentApplicationDto,
  CreateApplicationDto,
} from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma, Payment as PrismaPayment } from '../../generated/prisma';
import type { FeeLineCode } from '../admin-tenant/admin-tenant-config.contracts';
import type { PaymentResponse } from '../payments/dto';
import type { FeeLineSettlement } from '../payments/fee-settlement.util';
import type { EnagarFormSchema } from '@enagar/forms';

type StoredApplication = ApplicationResponse;

const defaultFormSchemas = [
  birthCertificateSchema,
  tradeLicenceSchema,
  propertyTaxSchema,
  communityHallSchema,
  rtiSchema,
] as const;

@Injectable()
export class ApplicationsService {
  private readonly formSchemasByServiceCode = new Map<string, EnagarFormSchema>(
    defaultFormSchemas.map((schema) => [schema.service_code, schema]),
  );

  constructor(
    private readonly services: ServicesService,
    private readonly tenants: TenantsService,
    @Inject(APPLICATION_STORE)
    private readonly store: ApplicationStore,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  publishFormSchema(schema: EnagarFormSchema): void {
    this.formSchemasByServiceCode.set(schema.service_code, schema);
  }

  async create(
    principal: AuthenticatedPrincipal,
    dto: CreateApplicationDto,
    municipalityScopeFromHeader?: string,
  ): Promise<ApplicationResponse> {
    const draft = await this.createDraft(principal, dto, municipalityScopeFromHeader);
    return this.submitDraft(principal, draft.id, { enforceCleanDocuments: false });
  }

  async createDraft(
    principal: AuthenticatedPrincipal,
    dto: CreateApplicationDto,
    municipalityScopeFromHeader?: string,
  ): Promise<ApplicationResponse> {
    const { tenantId, tenantCode } = resolveCitizenMunicipalityForWrite(
      principal,
      await this.tenants.list(),
      municipalityScopeFromHeader,
    );
    const service = await this.services.getTenantService(tenantCode, dto.service_code);
    const formSchema = service.form_schema ?? this.formSchemasByServiceCode.get(dto.service_code);
    if (!formSchema) {
      throw new BadRequestException('Service form schema is not available yet');
    }

    const validation = validateSubmission(formSchema, dto.form_data);
    if (!validation.ok) {
      throw new BadRequestException({
        message: 'Form submission is invalid',
        issues: validation.issues,
      });
    }

    const workflow =
      (await this.services.getPublishedWorkflowDefinition(tenantCode, dto.service_code)) ??
      workflowForPattern(service.workflow_pattern);
    const paymentConfig = await this.services.resolvePaymentConfig(tenantCode, dto.service_code);
    const fee_settlement = buildInitialFeeSettlement(paymentConfig);
    const payment_status = rollupPaymentStatus(paymentConfig.payment_schedule, fee_settlement);
    const createdAt = new Date();
    const docketNo = await this.store.nextDocketNo(tenantCode, dto.service_code);
    const application: ApplicationResponse = {
      id: randomUUID(),
      docket_no: docketNo,
      tenant_id: tenantId,
      tenant_code: tenantCode,
      citizen_subject: principal.subject,
      service_code: dto.service_code,
      service_name: service.name.en,
      form_version_id: service.form_version_id,
      form_version: formSchema.version,
      workflow_code: workflow.code,
      workflow_version: workflow.version,
      current_stage: 'draft',
      status: 'draft',
      status_label: 'Draft',
      pending_role: 'citizen',
      payment_schedule: paymentConfig.payment_schedule,
      fee_settlement,
      payment_status,
      form_data: dto.form_data,
      submitted_at: createdAt.toISOString(),
      timeline: [
        {
          id: randomUUID(),
          from_stage: null,
          to_stage: 'draft',
          verb: 'draft-created',
          actor_role: 'citizen',
          comment: null,
          created_at: createdAt.toISOString(),
        },
      ],
      comments: [],
      documents: [],
    };

    await this.store.save(application);
    return cloneApplication(application);
  }

  async submitDraft(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    options: { enforceCleanDocuments?: boolean; readScope?: ApplicationReadScope } = {},
  ): Promise<ApplicationResponse> {
    const application = await this.getOwnedApplication(principal, applicationId, options.readScope);
    if (application.status !== 'draft') {
      return cloneApplication(application);
    }

    const workflowTenantCode = application.tenant_code;
    if (!workflowTenantCode) {
      throw new BadRequestException('Application missing tenant_code');
    }
    const service = await this.services.getTenantService(
      workflowTenantCode,
      application.service_code,
    );
    const formSchema =
      service.form_schema ?? this.formSchemasByServiceCode.get(application.service_code);
    if (!formSchema) {
      throw new BadRequestException('Service form schema is not available yet');
    }
    const workflow =
      (await this.services.getPublishedWorkflowDefinition(
        workflowTenantCode,
        application.service_code,
      )) ?? workflowForPattern(service.workflow_pattern);
    const initialStage = getInitialStage(workflow);
    if (options.enforceCleanDocuments !== false) {
      const cleanDocumentCodes = new Set(
        application.documents
          .filter((document) => document.scan_status === 'clean')
          .map((document) => document.document_code),
      );
      const missingCleanDocument = formSchema.fields.find(
        (field) =>
          field.type === 'file' && field.required === true && !cleanDocumentCodes.has(field.id),
      );
      if (missingCleanDocument) {
        throw new BadRequestException(
          `Document ${missingCleanDocument.id} must be uploaded and scan-clean before submission`,
        );
      }
    }

    const paymentConfig = await this.services.resolvePaymentConfig(
      workflowTenantCode,
      application.service_code,
    );
    const settlementForSubmit = coerceFeeSettlementSnapshot(application.fee_settlement);
    if (
      !applicationFeePaidForSubmit(paymentConfig.payment_schedule, settlementForSubmit, {
        applicationFeePreviewPaise: paymentConfig.fee_line_previews.application,
      })
    ) {
      throw new BadRequestException(
        'Application fee must be paid before submit. Pay the application fee on this draft, complete settlement, then submit again.',
      );
    }

    const submittedAt = new Date();
    const dueAt = calculateSlaDueAt(submittedAt, initialStage.sla_hours);
    const pendingActor = pendingActorFromWorkflowStage(initialStage);
    const fee_settlement = mergeFeeSettlementPreservingStatus(
      application.fee_settlement,
      buildInitialFeeSettlement(paymentConfig),
    );
    const payment_status = rollupPaymentStatus(paymentConfig.payment_schedule, fee_settlement);
    const updated: ApplicationResponse = {
      ...application,
      payment_schedule: paymentConfig.payment_schedule,
      fee_settlement,
      payment_status,
      workflow_code: workflow.code,
      workflow_version: workflow.version,
      current_stage: initialStage.code,
      status: initialStage.terminal ? 'closed' : 'submitted',
      status_label: initialStage.label.en,
      pending_role: pendingActor.pending_role,
      pending_designation: pendingActor.pending_designation,
      submitted_at: submittedAt.toISOString(),
      timeline: [
        ...application.timeline,
        {
          id: randomUUID(),
          from_stage: 'draft',
          to_stage: initialStage.code,
          verb: 'submit',
          actor_role: 'citizen',
          comment: null,
          created_at: submittedAt.toISOString(),
        },
        ...(dueAt
          ? [
              {
                id: randomUUID(),
                from_stage: initialStage.code,
                to_stage: initialStage.code,
                verb: 'sla-armed',
                actor_role: 'system',
                comment: `SLA due at ${dueAt.toISOString()}`,
                created_at: submittedAt.toISOString(),
              },
            ]
          : []),
      ],
    };

    await this.store.save(updated);
    return cloneApplication(updated);
  }

  async list(
    principal: AuthenticatedPrincipal,
    readScope?: ApplicationReadScope,
  ): Promise<ApplicationSummaryResponse[]> {
    const owned = (await this.store.list()).filter((application) =>
      this.canAccess(principal, application, readScope),
    );
    const hydrated = await Promise.all(
      owned.map((application) => this.hydratePaymentSnapshot(application)),
    );
    const summaries = hydrated
      .sort((left, right) => right.submitted_at.localeCompare(left.submitted_at))
      .map(toSummary);
    return this.enrichSummariesWithPendingAt(summaries);
  }

  async getByDocketNo(
    principal: AuthenticatedPrincipal,
    docketNo: string,
    readScope?: ApplicationReadScope,
  ): Promise<ApplicationResponse> {
    const application = await this.store.findByDocketNo(docketNo);
    if (!application || !this.canAccess(principal, application, readScope)) {
      throw new NotFoundException('Application not found');
    }

    const enriched = await this.enrichWithPendingAt(
      cloneApplication(
        await this.hydratePaymentSnapshot(await this.withPersistedDocuments(application)),
      ),
    );
    const withBooking = await this.attachBookingCharges(enriched);
    return this.attachRelatedPayments(withBooking);
  }

  async cancel(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    dto: CancelApplicationDto,
    readScope?: ApplicationReadScope,
  ): Promise<ApplicationResponse> {
    const application = await this.getOwnedApplication(principal, applicationId, readScope);
    if (application.status === 'cancelled') {
      return cloneApplication(application);
    }

    const updated: ApplicationResponse = {
      ...application,
      current_stage: 'withdrawn',
      status: 'cancelled',
      status_label: 'Withdrawn',
      pending_role: null,
      pending_designation: null,
      timeline: [
        ...application.timeline,
        {
          id: randomUUID(),
          from_stage: application.current_stage,
          to_stage: 'withdrawn',
          verb: 'cancel',
          actor_role: 'citizen',
          comment: dto.reason ?? null,
          created_at: new Date().toISOString(),
        },
      ],
    };

    await this.store.save(updated);
    return cloneApplication(updated);
  }

  async comment(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    dto: CommentApplicationDto,
    readScope?: ApplicationReadScope,
  ): Promise<ApplicationResponse> {
    const application = await this.getOwnedApplication(principal, applicationId, readScope);
    const comment: ApplicationCommentResponse = {
      id: randomUUID(),
      actor_role: 'citizen',
      body: dto.body,
      created_at: new Date().toISOString(),
    };
    const updated: ApplicationResponse = {
      ...application,
      comments: [...application.comments, comment],
      timeline: [
        ...application.timeline,
        {
          id: randomUUID(),
          from_stage: application.current_stage,
          to_stage: application.current_stage,
          verb: 'comment',
          actor_role: 'citizen',
          comment: dto.body,
          created_at: comment.created_at,
        },
      ],
    };

    await this.store.save(updated);
    return cloneApplication(updated);
  }

  async attachDocument(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    document: StoredApplication['documents'][number],
    readScope?: ApplicationReadScope,
  ): Promise<void> {
    const application = await this.getOwnedApplication(principal, applicationId, readScope);
    await this.mergeDocument(application, document);
  }

  /**
   * EN-16: tenant-scoped attach for non-citizen principals. Same effect as
   * {@link attachDocument} but uses the staff read path.
   */
  async attachDocumentForStaff(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    document: StoredApplication['documents'][number],
  ): Promise<void> {
    const application = await this.getApplicationForStaff(principal, applicationId);
    await this.mergeDocument(application, document);
  }

  private async mergeDocument(
    application: StoredApplication,
    document: StoredApplication['documents'][number],
  ): Promise<void> {
    const updated: ApplicationResponse = {
      ...application,
      documents: [...application.documents.filter((item) => item.id !== document.id), document],
    };
    await this.store.save(updated);
  }

  async submitFeedback(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    dto: ApplicationFeedbackDto,
    readScope?: ApplicationReadScope,
  ): Promise<ApplicationResponse> {
    const application = await this.getOwnedApplication(principal, applicationId, readScope);
    if (application.current_stage !== 'citizen-feedback') {
      throw new BadRequestException('Feedback is allowed only at the citizen-feedback stage');
    }

    const tenantCode = application.tenant_code;
    if (!tenantCode) {
      throw new BadRequestException('Application missing tenant_code');
    }

    const service = await this.services.getTenantService(tenantCode, application.service_code);
    const workflow =
      (await this.services.getPublishedWorkflowDefinition(tenantCode, application.service_code)) ??
      workflowForPattern(service.workflow_pattern);

    const evaluated = evaluateTransition({
      workflow,
      current_stage: application.current_stage,
      verb: CITIZEN_FEEDBACK_VERB,
      actor_roles: ['citizen'],
    });
    if (!evaluated.ok) {
      throw new BadRequestException(`Workflow transition rejected: ${evaluated.reason}`);
    }

    const submittedAt = new Date().toISOString();
    const updated: ApplicationResponse = {
      ...application,
      current_stage: evaluated.to.code,
      status: evaluated.to.terminal ? 'closed' : evaluated.to.code,
      status_label: evaluated.to.label.en,
      pending_role: null,
      pending_designation: null,
      citizen_feedback: {
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
        submitted_at: submittedAt,
      },
      timeline: [
        ...application.timeline,
        {
          id: randomUUID(),
          from_stage: evaluated.from.code,
          to_stage: evaluated.to.code,
          verb: evaluated.transition.verb,
          actor_role: 'citizen',
          comment: dto.comment?.trim() || null,
          created_at: submittedAt,
        },
      ],
    };

    await this.store.save(updated);
    return cloneApplication(updated);
  }

  async getOwnedApplication(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    readScope?: ApplicationReadScope,
  ): Promise<StoredApplication> {
    const application = await this.store.findById(applicationId);
    if (!application || !this.canAccess(principal, application, readScope)) {
      throw new NotFoundException('Application not found');
    }
    const hydrated = await this.hydratePaymentSnapshot(
      await this.withPersistedDocuments(application),
    );
    const withBooking = await this.attachBookingCharges(hydrated);
    return this.attachRelatedPayments(withBooking);
  }

  /**
   * EN-16: staff context-action read.
   *
   * Tenant-scoped read for non-citizen principals (workflow-assigned staff).
   * Bypasses the citizen-subject ownership check that {@link getOwnedApplication}
   * enforces for self-service uploads, so clerks/admins/heads can attach a
   * document to a stage on an application they don't own personally.
   */
  async getApplicationForStaff(
    principal: AuthenticatedPrincipal,
    applicationId: string,
  ): Promise<StoredApplication> {
    if (principalIsCitizenPortal(principal)) {
      throw new NotFoundException('Application not found');
    }
    const application = await this.store.findById(applicationId);
    if (!application || application.tenant_id !== principal.tenantId) {
      throw new NotFoundException('Application not found');
    }
    const hydrated = await this.hydratePaymentSnapshot(
      await this.withPersistedDocuments(application),
    );
    const withBooking = await this.attachBookingCharges(hydrated);
    return this.attachRelatedPayments(withBooking);
  }

  private async attachBookingCharges(
    application: ApplicationResponse,
  ): Promise<ApplicationResponse> {
    if (!this.prisma) {
      return application;
    }
    const formData =
      typeof application.form_data === 'object' && application.form_data !== null
        ? (application.form_data as Record<string, unknown>)
        : {};
    const summary = await resolveBookingChargesSummary(
      this.prisma,
      application.tenant_id,
      application.id,
      formData,
      coerceFeeSettlementSnapshot(application.fee_settlement),
    );
    if (!summary) {
      return application;
    }
    return { ...application, booking_charges: summary };
  }

  private async attachRelatedPayments(
    application: ApplicationResponse,
  ): Promise<ApplicationResponse> {
    if (!this.prisma) {
      return application;
    }
    const reservationId = application.booking_charges?.reservation_id ?? null;
    const orFilters: Prisma.PaymentWhereInput[] = [{ applicationId: application.id }];
    if (reservationId) {
      orFilters.push({ bookingReservationId: reservationId });
    }
    const rows = await this.prisma.payment.findMany({
      where: {
        tenantId: application.tenant_id,
        OR: orFilters,
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      ...application,
      related_payments: rows.map((row) => this.mapPaymentRow(row)),
    };
  }

  private mapPaymentRow(row: PrismaPayment): PaymentResponse {
    return {
      id: row.id,
      tenant_id: row.tenantId,
      citizen_subject: row.citizenSubject,
      application_id: row.applicationId,
      booking_reservation_id: row.bookingReservationId,
      fee_code: row.feeCode,
      amount_paise: row.amountPaise,
      currency: 'INR',
      method: row.method as PaymentResponse['method'],
      status: row.status as PaymentResponse['status'],
      gateway: 'stub',
      gateway_order_id: row.gatewayOrderId,
      gateway_payment_id: row.gatewayPaymentId,
      settled_at: row.settledAt ? row.settledAt.toISOString() : null,
      redirect_url: `/payments/stub/complete?payment_id=${row.id}&order_id=${row.gatewayOrderId}`,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  private async hydratePaymentSnapshot(
    application: ApplicationResponse,
  ): Promise<ApplicationResponse> {
    const tenantCode = application.tenant_code?.trim();
    if (!tenantCode) {
      return application;
    }
    if (!applicationPaymentSnapshotIncomplete(application)) {
      return application;
    }

    const paymentConfig = await this.services.resolvePaymentConfig(
      tenantCode,
      application.service_code,
    );
    const hydrated = hydrateApplicationPaymentSnapshot(application, paymentConfig);
    if (!hydrated.changed) {
      return application;
    }

    const updated: ApplicationResponse = {
      ...application,
      payment_schedule: hydrated.payment_schedule,
      fee_settlement: hydrated.fee_settlement,
      payment_status: hydrated.payment_status,
    };
    await this.store.save(updated);
    return updated;
  }

  private async withPersistedDocuments(
    application: ApplicationResponse,
  ): Promise<ApplicationResponse> {
    if (!this.prisma) {
      return application;
    }
    const rows = await this.prisma.applicationDocument.findMany({
      where: {
        tenantId: application.tenant_id,
        applicationId: application.id,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (rows.length === 0) {
      return application;
    }
    return {
      ...application,
      documents: rows.map((row) =>
        toApplicationDocumentResponse(mapApplicationDocumentRow(row, application.citizen_subject)),
      ),
    };
  }

  async recordPaymentStatus(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    paymentStatus: StoredApplication['payment_status'],
  ): Promise<void> {
    const application = await this.getOwnedApplication(principal, applicationId);
    await this.store.save({
      ...application,
      payment_status: paymentStatus,
    });
  }

  async updateFeeLineSettlement(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    feeCode: FeeLineCode,
    patch: Partial<FeeLineSettlement>,
    snapshotExtras?: Record<string, unknown>,
  ): Promise<void> {
    const application = await this.getOwnedApplication(principal, applicationId);
    const schedule =
      application.payment_schedule ??
      (
        await this.services.resolvePaymentConfig(
          application.tenant_code ?? '',
          application.service_code,
        )
      ).payment_schedule;
    const settlement = coerceFeeSettlementSnapshot(application.fee_settlement);
    const next = applyFeeSettlementPatch(schedule, settlement, feeCode, patch);
    await this.store.save({
      ...application,
      ...next,
      ...snapshotExtras,
    });
  }

  /** Desk / system path — tenant-scoped, no citizen-subject ownership check (Phase 11). */
  async recordPaymentStatusForTenant(
    tenantId: string,
    applicationId: string,
    paymentStatus: StoredApplication['payment_status'],
    snapshotExtras?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.prisma) {
      throw new BadRequestException('Tenant payment updates require Postgres application store');
    }
    const row = await this.prisma.application.findFirst({
      where: { id: applicationId, tenantId },
      select: { runtimeSnapshot: true },
    });
    if (!row) {
      throw new NotFoundException('Application not found');
    }
    const base =
      row.runtimeSnapshot &&
      typeof row.runtimeSnapshot === 'object' &&
      !Array.isArray(row.runtimeSnapshot)
        ? (row.runtimeSnapshot as Record<string, unknown>)
        : {};
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        paymentStatus,
        runtimeSnapshot: {
          ...base,
          payment_status: paymentStatus,
          ...snapshotExtras,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async updateFeeLineSettlementForTenant(
    tenantId: string,
    applicationId: string,
    feeCode: FeeLineCode,
    patch: Partial<FeeLineSettlement>,
    snapshotExtras?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.prisma) {
      throw new BadRequestException('Tenant payment updates require Postgres application store');
    }
    const row = await this.prisma.application.findFirst({
      where: { id: applicationId, tenantId },
      select: { runtimeSnapshot: true, serviceCode: true },
    });
    if (!row) {
      throw new NotFoundException('Application not found');
    }
    const snapshot =
      row.runtimeSnapshot &&
      typeof row.runtimeSnapshot === 'object' &&
      !Array.isArray(row.runtimeSnapshot)
        ? (row.runtimeSnapshot as unknown as ApplicationResponse)
        : ({} as ApplicationResponse);
    const tenantCode = snapshot.tenant_code?.trim();
    if (!tenantCode) {
      throw new BadRequestException('Application is missing tenant_code in runtime snapshot');
    }
    const schedule =
      snapshot.payment_schedule ??
      (await this.services.resolvePaymentConfig(tenantCode, row.serviceCode)).payment_schedule;
    const settlement = coerceFeeSettlementSnapshot(snapshot.fee_settlement);
    const next = applyFeeSettlementPatch(schedule, settlement, feeCode, patch);
    const base =
      row.runtimeSnapshot &&
      typeof row.runtimeSnapshot === 'object' &&
      !Array.isArray(row.runtimeSnapshot)
        ? (row.runtimeSnapshot as Record<string, unknown>)
        : {};
    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        paymentStatus: next.payment_status,
        runtimeSnapshot: {
          ...base,
          payment_schedule: schedule,
          fee_settlement: next.fee_settlement,
          payment_status: next.payment_status,
          ...snapshotExtras,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async enrichSummariesWithPendingAt(
    summaries: ApplicationSummaryResponse[],
  ): Promise<ApplicationSummaryResponse[]> {
    if (!this.prisma || summaries.length === 0) {
      return summaries;
    }
    const byTenant = new Map<string, ApplicationSummaryResponse[]>();
    for (const row of summaries) {
      const tenantId = row.tenant_id;
      if (!tenantId) {
        continue;
      }
      const bucket = byTenant.get(tenantId) ?? [];
      bucket.push(row);
      byTenant.set(tenantId, bucket);
    }
    const enriched: ApplicationSummaryResponse[] = [];
    for (const [tenantId, rows] of byTenant) {
      enriched.push(...(await attachPendingAtLabels(this.prisma, tenantId, rows)));
    }
    const withoutTenant = summaries.filter((row) => !row.tenant_id);
    return [...enriched, ...withoutTenant].sort((left, right) =>
      right.submitted_at.localeCompare(left.submitted_at),
    );
  }

  private async enrichWithPendingAt(
    application: ApplicationResponse,
  ): Promise<ApplicationResponse> {
    if (!this.prisma) {
      return application;
    }
    const [enriched] = await attachPendingAtLabels(this.prisma, application.tenant_id, [
      application,
    ]);
    return enriched ?? application;
  }

  private canAccess(
    principal: AuthenticatedPrincipal,
    application: StoredApplication,
    readScope?: ApplicationReadScope,
  ): boolean {
    if (application.citizen_subject !== principal.subject) {
      return false;
    }

    if (principalIsCitizenPortal(principal) && isCitizenSelfServicePrincipal(principal)) {
      const scoped = readScope?.municipalityTenantCode?.trim();
      if (scoped) {
        const code = application.tenant_code?.toUpperCase() ?? '';
        return code === scoped.toUpperCase();
      }
      return true;
    }

    return application.tenant_id === principal.tenantId;
  }
}

function toSummary(application: ApplicationResponse): ApplicationSummaryResponse {
  const {
    form_data: _formData,
    timeline: _timeline,
    comments: _comments,
    ...summary
  } = application;
  return { ...summary };
}

function cloneApplication(application: ApplicationResponse): ApplicationResponse {
  return {
    ...application,
    form_data: { ...application.form_data },
    timeline: application.timeline.map((item) => ({ ...item })),
    comments: application.comments.map((item) => ({ ...item })),
    documents: application.documents.map((item) => ({ ...item })),
  };
}
