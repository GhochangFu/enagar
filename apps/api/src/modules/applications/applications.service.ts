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
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { ServicesService } from '../services/services.service';

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

const formSchemasByServiceCode = new Map<string, EnagarFormSchema>(
  [
    birthCertificateSchema,
    tradeLicenceSchema,
    propertyTaxSchema,
    communityHallSchema,
    rtiSchema,
  ].map((schema) => [schema.service_code, schema]),
);

@Injectable()
export class ApplicationsService {
  private readonly applications = new Map<string, StoredApplication>();
  private sequence = 0;

  constructor(private readonly services: ServicesService) {}

  create(principal: AuthenticatedPrincipal, dto: CreateApplicationDto): ApplicationResponse {
    const tenantCode = this.requireTenantCode(principal);
    const service = this.services.getTenantService(tenantCode, dto.service_code);
    const formSchema = formSchemasByServiceCode.get(dto.service_code);
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
    const initialStage = getInitialStage(workflow);
    const submittedAt = new Date();
    const docketNo = this.nextDocketNo(tenantCode, dto.service_code);
    const timeline = [
      {
        id: randomUUID(),
        from_stage: null,
        to_stage: initialStage.code,
        verb: 'submit',
        actor_role: 'citizen',
        comment: null,
        created_at: submittedAt.toISOString(),
      },
    ];
    const dueAt = calculateSlaDueAt(submittedAt, initialStage.sla_hours);
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
      current_stage: initialStage.code,
      status: initialStage.terminal ? 'closed' : 'submitted',
      status_label: initialStage.label.en,
      pending_role: initialStage.owner_role,
      payment_status: service.fee_type === 'free' ? 'not_required' : 'mock_paid',
      form_data: dto.form_data,
      submitted_at: submittedAt.toISOString(),
      timeline: dueAt
        ? [
            ...timeline,
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
        : timeline,
      comments: [],
      documents: [],
    };

    this.applications.set(application.id, application);
    return cloneApplication(application);
  }

  list(principal: AuthenticatedPrincipal): ApplicationSummaryResponse[] {
    return Array.from(this.applications.values())
      .filter((application) => this.canAccess(principal, application))
      .sort((left, right) => right.submitted_at.localeCompare(left.submitted_at))
      .map(toSummary);
  }

  getByDocketNo(principal: AuthenticatedPrincipal, docketNo: string): ApplicationResponse {
    const application = Array.from(this.applications.values()).find(
      (candidate) => candidate.docket_no === docketNo,
    );
    if (!application || !this.canAccess(principal, application)) {
      throw new NotFoundException('Application not found');
    }

    return cloneApplication(application);
  }

  cancel(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    dto: CancelApplicationDto,
  ): ApplicationResponse {
    const application = this.getOwnedApplication(principal, applicationId);
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

    this.applications.set(updated.id, updated);
    return cloneApplication(updated);
  }

  comment(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    dto: CommentApplicationDto,
  ): ApplicationResponse {
    const application = this.getOwnedApplication(principal, applicationId);
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

    this.applications.set(updated.id, updated);
    return cloneApplication(updated);
  }

  attachDocument(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    document: StoredApplication['documents'][number],
  ): void {
    const application = this.getOwnedApplication(principal, applicationId);
    const updated: ApplicationResponse = {
      ...application,
      documents: [...application.documents.filter((item) => item.id !== document.id), document],
    };

    this.applications.set(updated.id, updated);
  }

  getOwnedApplication(principal: AuthenticatedPrincipal, applicationId: string): StoredApplication {
    const application = this.applications.get(applicationId);
    if (!application || !this.canAccess(principal, application)) {
      throw new NotFoundException('Application not found');
    }
    return application;
  }

  private canAccess(principal: AuthenticatedPrincipal, application: StoredApplication): boolean {
    return (
      application.tenant_id === principal.tenantId &&
      application.citizen_subject === principal.subject
    );
  }

  private nextDocketNo(tenantCode: string, serviceCode: string): string {
    this.sequence += 1;
    return `WBM/${tenantCode}/${serviceCode}/2026/${String(this.sequence).padStart(5, '0')}`;
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
