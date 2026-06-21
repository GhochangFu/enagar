import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { isFormImportQueueEnabled } from '../../common/form-import/form-import.config';
import { FormImportQueueService } from '../../common/form-import/form-import.queue';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';
import { assertStateAdmin } from '../admin-state/admin-state.contracts';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';

import {
  completeFormImportFromProposal,
  extractFormImportFromUpload,
  isFormImportExtractionError,
  UnsupportedFormImportFormatError,
} from './form-import-job.processor';
import {
  buildStateFormImportObjectKey,
  buildTenantFormImportObjectKey,
} from './form-import-storage';
import { mapFormImportJobRow } from './form-import.mapper';

import type { FormImportJobResponseDto, FormImportUploadedFile } from './dto/form-import.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';

@Injectable()
export class FormImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorage: ObjectStorageService,
    private readonly formImportQueue: FormImportQueueService,
  ) {}

  async createTenantImportJob(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    file: FormImportUploadedFile,
  ): Promise<FormImportJobResponseDto> {
    assertTenantPortalStaff(principal);
    const service = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: principal.tenantId },
      select: { id: true, code: true },
    });
    if (!service) {
      throw new NotFoundException('Tenant service not found');
    }

    const tenantCode = principal.tenantCode?.trim();
    if (!tenantCode) {
      throw new BadRequestException('Tenant code is required for form import uploads');
    }

    return this.createImportJob({
      scope: 'tenant',
      tenantId: principal.tenantId,
      tenantCode,
      serviceId: service.id,
      serviceCode: service.code,
      file,
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
    const row = await this.prisma.globalService.findUnique({
      where: { code: serviceCode },
      select: { code: true },
    });
    if (!row) {
      throw new NotFoundException(`Global service template "${serviceCode}" not found`);
    }

    return this.createImportJob({
      scope: 'state',
      serviceCode: row.code,
      file,
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

  private async createImportJob(input: {
    scope: 'tenant' | 'state';
    tenantId?: string;
    tenantCode?: string;
    serviceId?: string;
    serviceCode: string;
    file: FormImportUploadedFile;
  }): Promise<FormImportJobResponseDto> {
    if (!input.file?.buffer?.length) {
      throw new BadRequestException('file upload is required');
    }

    const jobId = randomUUID();
    const sourceStorageKey =
      input.scope === 'tenant'
        ? buildTenantFormImportObjectKey(
            input.tenantCode!,
            input.serviceId!,
            input.file.originalname,
            jobId,
          )
        : buildStateFormImportObjectKey(input.serviceCode, input.file.originalname, jobId);

    if (input.scope === 'tenant') {
      this.objectStorage.assertTenantObjectKey(sourceStorageKey, input.tenantCode!);
    } else {
      this.objectStorage.assertSafeObjectKey(sourceStorageKey);
    }

    await this.objectStorage.putObject(
      sourceStorageKey,
      input.file.buffer,
      input.file.mimetype || 'application/octet-stream',
    );

    const row = await this.prisma.formImportJob.create({
      data: {
        id: jobId,
        scope: input.scope,
        tenantId: input.tenantId,
        serviceId: input.serviceId,
        serviceCode: input.serviceCode,
        status: 'pending',
        sourceFilename: input.file.originalname,
        sourceMimeType: input.file.mimetype || 'application/octet-stream',
        sourceStorageKey,
      },
    });

    if (isFormImportQueueEnabled()) {
      await this.formImportQueue.enqueueImport(jobId);
      return mapFormImportJobRow(row);
    }

    return this.processImportJobInline(jobId, input.file);
  }

  /** Dev/CI fallback when Redis or durable object storage is unavailable. */
  private async processImportJobInline(
    jobId: string,
    file: FormImportUploadedFile,
  ): Promise<FormImportJobResponseDto> {
    const row = await this.prisma.formImportJob.findUnique({ where: { id: jobId } });
    if (!row) {
      throw new NotFoundException('Form import job not found');
    }

    await this.prisma.formImportJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    try {
      const extraction = await extractFormImportFromUpload(file, row.serviceCode);
      const completion = completeFormImportFromProposal(
        extraction.proposal,
        extraction.sourceKind,
        row.serviceCode,
      );

      const updated = await this.prisma.formImportJob.update({
        where: { id: jobId },
        data: {
          status: completion.status,
          sourceKind: completion.sourceKind,
          overallConfidence: completion.overallConfidence,
          proposalJson: completion.proposal as unknown as Prisma.InputJsonValue,
          proposedSchemaJson: completion.proposed_schema as unknown as Prisma.InputJsonValue,
          rejectionReason: completion.rejectionReason,
          errorMessage: null,
        },
      });
      return mapFormImportJobRow(updated);
    } catch (error) {
      if (isFormImportExtractionError(error) || error instanceof UnsupportedFormImportFormatError) {
        await this.prisma.formImportJob.delete({ where: { id: jobId } }).catch(() => undefined);
        throw new BadRequestException(error.message);
      }

      const message = error instanceof Error ? error.message : 'Form import failed';
      const failed = await this.prisma.formImportJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errorMessage: message,
        },
      });
      return mapFormImportJobRow(failed);
    }
  }

  private async getJob(
    scope: 'tenant' | 'state',
    jobId: string,
    tenantId: string | undefined,
    resourceKey: string,
  ): Promise<FormImportJobResponseDto> {
    const row = await this.prisma.formImportJob.findUnique({ where: { id: jobId } });
    if (!row || row.scope !== scope) {
      throw new NotFoundException('Form import job not found');
    }
    if (scope === 'tenant') {
      if (row.tenantId !== tenantId || row.serviceId !== resourceKey) {
        throw new NotFoundException('Form import job not found');
      }
    } else if (row.serviceCode !== resourceKey) {
      throw new NotFoundException('Form import job not found');
    }
    return mapFormImportJobRow(row);
  }
}
