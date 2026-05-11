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

import {
  isCitizenSelfServicePrincipal,
  principalIsCitizenPortal,
  resolveCitizenMunicipalityForWrite,
} from '../../common/auth/citizen-scope';
import { ServicesService } from '../services/services.service';
import { TenantsService } from '../tenants/tenants.service';

import { APPLICATION_STORE } from './application-store';

import type { ApplicationStore } from './application-store';
import type {
  ApplicationCommentResponse,
  ApplicationReadScope,
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
    private readonly tenants: TenantsService,
    @Inject(APPLICATION_STORE)
    private readonly store: ApplicationStore,
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
      this.tenants.list(),
      municipalityScopeFromHeader,
    );
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
      tenant_id: tenantId,
      tenant_code: tenantCode,
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
    options: { enforceCleanDocuments?: boolean; readScope?: ApplicationReadScope } = {},
  ): Promise<ApplicationResponse> {
    const application = await this.getOwnedApplication(principal, applicationId, options.readScope);
    if (application.status !== 'draft') {
      return cloneApplication(application);
    }

    const formSchema = this.formSchemasByServiceCode.get(application.service_code);
    if (!formSchema) {
      throw new BadRequestException('Service form schema is not available yet');
    }
    const workflowTenantCode = application.tenant_code;
    if (!workflowTenantCode) {
      throw new BadRequestException('Application missing tenant_code');
    }
    const workflow = workflowForPattern(
      this.services.getTenantService(workflowTenantCode, application.service_code).workflow_pattern,
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

  async list(
    principal: AuthenticatedPrincipal,
    readScope?: ApplicationReadScope,
  ): Promise<ApplicationSummaryResponse[]> {
    return (await this.store.list())
      .filter((application) => this.canAccess(principal, application, readScope))
      .sort((left, right) => right.submitted_at.localeCompare(left.submitted_at))
      .map(toSummary);
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

    return cloneApplication(application);
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
    const updated: ApplicationResponse = {
      ...application,
      documents: [...application.documents.filter((item) => item.id !== document.id), document],
    };

    await this.store.save(updated);
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
