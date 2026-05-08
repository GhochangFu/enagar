import { randomUUID } from 'node:crypto';

import { validateSubmission } from '@enagar/forms';
import {
  birthCertificateSchema,
  communityHallSchema,
  propertyTaxSchema,
  rtiSchema,
  tradeLicenceSchema,
} from '@enagar/forms/fixtures';
import { calculateSlaDueAt, getInitialStage, workflowForPattern } from '@enagar/workflow';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { ServicesService } from '../services/services.service';

import { APPLICATION_STORE } from './application-store';

import type { ApplicationStore } from './application-store';
import type {
  ApplicationCommentResponse,
  ApplicationResponse,
  ApplicationSummaryResponse,
  CancelApplicationDto,
  CommentApplicationDto,
  CreateApplicationDto,
} from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
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
    @Inject(APPLICATION_STORE)
    private readonly store: ApplicationStore,
  ) {}

  publishFormSchema(schema: EnagarFormSchema): void {
    this.formSchemasByServiceCode.set(schema.service_code, schema);
  }

  async create(
    principal: AuthenticatedPrincipal,
    dto: CreateApplicationDto,
  ): Promise<ApplicationResponse> {
    const draft = await this.createDraft(principal, dto);
    return this.submitDraft(principal, draft.id, { enforceCleanDocuments: false });
  }

  async createDraft(
    principal: AuthenticatedPrincipal,
    dto: CreateApplicationDto,
  ): Promise<ApplicationResponse> {
    const tenantCode = this.requireTenantCode(principal);
    const service = this.services.getTenantService(tenantCode, dto.service_code);
    const formSchema = this.formSchemasByServiceCode.get(dto.service_code);
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

    const workflow = workflowForPattern(service.workflow_pattern);
    const createdAt = new Date();
    const docketNo = await this.store.nextDocketNo(tenantCode, dto.service_code);
    const application: ApplicationResponse = {
      id: randomUUID(),
      docket_no: docketNo,
      tenant_id: principal.tenantId,
      tenant_code: principal.tenantCode,
      citizen_subject: principal.subject,
      service_code: dto.service_code,
      service_name: service.name.en,
      form_version: formSchema.version,
      workflow_code: workflow.code,
      workflow_version: workflow.version,
      current_stage: 'draft',
      status: 'draft',
      status_label: 'Draft',
      pending_role: 'citizen',
      payment_status: service.fee_type === 'free' ? 'not_required' : 'pending',
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
    options: { enforceCleanDocuments?: boolean } = {},
  ): Promise<ApplicationResponse> {
    const application = await this.getOwnedApplication(principal, applicationId);
    if (application.status !== 'draft') {
      return cloneApplication(application);
    }

    const formSchema = this.formSchemasByServiceCode.get(application.service_code);
    if (!formSchema) {
      throw new BadRequestException('Service form schema is not available yet');
    }
    const workflow = workflowForPattern(
      this.services.getTenantService(this.requireTenantCode(principal), application.service_code)
        .workflow_pattern,
    );
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

    const submittedAt = new Date();
    const dueAt = calculateSlaDueAt(submittedAt, initialStage.sla_hours);
    const updated: ApplicationResponse = {
      ...application,
      current_stage: initialStage.code,
      status: initialStage.terminal ? 'closed' : 'submitted',
      status_label: initialStage.label.en,
      pending_role: initialStage.owner_role,
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

  async list(principal: AuthenticatedPrincipal): Promise<ApplicationSummaryResponse[]> {
    return (await this.store.list())
      .filter((application) => this.canAccess(principal, application))
      .sort((left, right) => right.submitted_at.localeCompare(left.submitted_at))
      .map(toSummary);
  }

  async getByDocketNo(
    principal: AuthenticatedPrincipal,
    docketNo: string,
  ): Promise<ApplicationResponse> {
    const application = await this.store.findByDocketNo(docketNo);
    if (!application || !this.canAccess(principal, application)) {
      throw new NotFoundException('Application not found');
    }

    return cloneApplication(application);
  }

  async cancel(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    dto: CancelApplicationDto,
  ): Promise<ApplicationResponse> {
    const application = await this.getOwnedApplication(principal, applicationId);
    if (application.status === 'cancelled') {
      return cloneApplication(application);
    }

    const updated: ApplicationResponse = {
      ...application,
      current_stage: 'withdrawn',
      status: 'cancelled',
      status_label: 'Withdrawn',
      pending_role: null,
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
  ): Promise<ApplicationResponse> {
    const application = await this.getOwnedApplication(principal, applicationId);
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
  ): Promise<void> {
    const application = await this.getOwnedApplication(principal, applicationId);
    const updated: ApplicationResponse = {
      ...application,
      documents: [...application.documents.filter((item) => item.id !== document.id), document],
    };

    await this.store.save(updated);
  }

  async getOwnedApplication(
    principal: AuthenticatedPrincipal,
    applicationId: string,
  ): Promise<StoredApplication> {
    const application = await this.store.findById(applicationId);
    if (!application || !this.canAccess(principal, application)) {
      throw new NotFoundException('Application not found');
    }
    return application;
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

  private canAccess(principal: AuthenticatedPrincipal, application: StoredApplication): boolean {
    return (
      application.tenant_id === principal.tenantId &&
      application.citizen_subject === principal.subject
    );
  }

  private requireTenantCode(principal: AuthenticatedPrincipal): string {
    if (!principal.tenantCode) {
      throw new BadRequestException('Tenant code claim is required');
    }
    return principal.tenantCode;
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
