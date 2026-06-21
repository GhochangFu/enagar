import { randomUUID } from 'node:crypto';

import {
  assessImportProposalApplyability,
  importProposalToFormSchema,
  type FormImportJobRecord,
  type FormImportSourceKind,
} from '@enagar/forms/form-import';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { assertStateAdmin } from '../admin-state/admin-state.contracts';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';

import {
  ExcelFormImportError,
  extractFormImportProposalFromExcel,
  isExcelUpload,
} from './extractors/excel-form-import.extractor';
import {
  WordFormImportError,
  extractFormImportProposalFromWord,
  isWordUpload,
} from './extractors/word-form-import.extractor';

import type { FormImportJobResponseDto, FormImportUploadedFile } from './dto/form-import.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

type StoredImportJob = FormImportJobRecord & {
  tenant_id?: string;
};

@Injectable()
export class FormImportService {
  private readonly jobs = new Map<string, StoredImportJob>();

  constructor(private readonly prisma: PrismaService) {}

  async createTenantImportJob(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    file: FormImportUploadedFile,
  ): Promise<FormImportJobResponseDto> {
    assertTenantPortalStaff(principal);
    return this.runSyncImport({
      scope: 'tenant',
      tenantId: principal.tenantId,
      serviceId,
      file,
      loader: async () => {
        const service = await this.prisma.tenantService.findFirst({
          where: { id: serviceId, tenantId: principal.tenantId },
          select: { id: true, code: true },
        });
        if (!service) {
          throw new NotFoundException('Tenant service not found');
        }
        return service.code;
      },
    });
  }

  async getTenantImportJob(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    jobId: string,
  ): Promise<FormImportJobResponseDto> {
    assertTenantPortalStaff(principal);
    return this.getJob('tenant', jobId, principal.tenantId, serviceId);
  }

  async createStateImportJob(
    principal: AuthenticatedPrincipal,
    serviceCode: string,
    file: FormImportUploadedFile,
  ): Promise<FormImportJobResponseDto> {
    assertStateAdmin(principal);
    return this.runSyncImport({
      scope: 'state',
      serviceCode,
      file,
      loader: async () => {
        const row = await this.prisma.globalService.findUnique({
          where: { code: serviceCode },
          select: { code: true },
        });
        if (!row) {
          throw new NotFoundException(`Global service template "${serviceCode}" not found`);
        }
        return row.code;
      },
    });
  }

  async getStateImportJob(
    principal: AuthenticatedPrincipal,
    serviceCode: string,
    jobId: string,
  ): Promise<FormImportJobResponseDto> {
    assertStateAdmin(principal);
    return this.getJob('state', jobId, undefined, serviceCode);
  }

  private async runSyncImport(input: {
    scope: 'tenant' | 'state';
    tenantId?: string;
    serviceId?: string;
    serviceCode?: string;
    file: FormImportUploadedFile;
    loader: () => Promise<string>;
  }): Promise<FormImportJobResponseDto> {
    if (!input.file?.buffer?.length) {
      throw new BadRequestException('file upload is required');
    }

    const now = new Date().toISOString();
    const jobId = randomUUID();

    try {
      const serviceCode = await input.loader();
      const { proposal, sourceKind } = await this.extractProposal(input.file, serviceCode);
      const applyability = assessImportProposalApplyability(proposal);
      const proposed_schema = importProposalToFormSchema(proposal, {
        service_code: serviceCode,
        version: 1,
      });

      const job: StoredImportJob = {
        job_id: jobId,
        scope: input.scope,
        service_code: serviceCode,
        service_id: input.serviceId,
        status: applyability.ok ? 'completed' : 'rejected',
        source_filename: input.file.originalname,
        source_kind: sourceKind,
        overall_confidence: proposal.overall_confidence,
        proposal,
        proposed_schema,
        rejection_reason: applyability.ok ? undefined : applyability.reasons.join('; '),
        created_at: now,
        updated_at: now,
        tenant_id: input.tenantId,
      };

      this.jobs.set(this.jobKey(input.scope, jobId), job);
      return this.toResponse(job);
    } catch (error) {
      if (error instanceof ExcelFormImportError || error instanceof WordFormImportError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async extractProposal(
    file: FormImportUploadedFile,
    serviceCode: string,
  ): Promise<{
    proposal: Awaited<ReturnType<typeof extractFormImportProposalFromExcel>>;
    sourceKind: FormImportSourceKind;
  }> {
    if (isExcelUpload(file)) {
      return {
        proposal: extractFormImportProposalFromExcel(file, serviceCode),
        sourceKind: 'excel',
      };
    }
    if (isWordUpload(file)) {
      return {
        proposal: await extractFormImportProposalFromWord(file, serviceCode),
        sourceKind: 'word',
      };
    }
    throw new BadRequestException('Supported formats: Excel (.xlsx) and Word (.docx)');
  }

  private getJob(
    scope: 'tenant' | 'state',
    jobId: string,
    tenantId: string | undefined,
    resourceKey: string,
  ): FormImportJobResponseDto {
    const job = this.jobs.get(this.jobKey(scope, jobId));
    if (!job) {
      throw new NotFoundException('Form import job not found');
    }
    if (scope === 'tenant') {
      if (job.tenant_id !== tenantId || job.service_id !== resourceKey) {
        throw new NotFoundException('Form import job not found');
      }
    } else if (job.service_code !== resourceKey) {
      throw new NotFoundException('Form import job not found');
    }
    return this.toResponse(job);
  }

  private jobKey(scope: 'tenant' | 'state', jobId: string): string {
    return `${scope}:${jobId}`;
  }

  private toResponse(job: StoredImportJob): FormImportJobResponseDto {
    return {
      job_id: job.job_id,
      scope: job.scope,
      service_code: job.service_code,
      service_id: job.service_id,
      status: job.status,
      source_filename: job.source_filename,
      source_kind: job.source_kind,
      source_storage_key: job.source_storage_key,
      overall_confidence: job.overall_confidence,
      proposal: job.proposal,
      proposed_schema: job.proposed_schema,
      rejection_reason: job.rejection_reason,
      source_preview: job.source_preview,
      created_at: job.created_at,
      updated_at: job.updated_at,
    };
  }
}
