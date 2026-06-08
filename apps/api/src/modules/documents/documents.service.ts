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
} from '../../common/auth/citizen-scope';
import { PrismaService } from '../../common/database/prisma.service';
import {
  allowsClientScanSimulation,
  maxUploadIntentsPerApplicationPerHour,
} from '../../common/document-scan/document-scan.config';
import { DocumentScanQueueService } from '../../common/document-scan/document-scan.queue';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';
import { ApplicationsService } from '../applications/applications.service';

import {
  mapApplicationDocumentRow,
  toApplicationDocumentResponse,
  toDocumentResponse,
  type StoredApplicationDocument,
} from './application-document.mapper';

import type {
  CreateUploadIntentDto,
  DocumentDownloadResponse,
  DocumentResponse,
  UpdateScanResultDto,
  UploadIntentResponse,
} from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { ApplicationReadScope } from '../applications/dto';

const uploadTtlMs = 15 * 60 * 1000;
const downloadTtlMs = 5 * 60 * 1000;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly objectStorage: ObjectStorageService,
    private readonly prisma: PrismaService,
    private readonly documentScanQueue: DocumentScanQueueService,
  ) {}

  private isCitizenPrincipal(principal: AuthenticatedPrincipal): boolean {
    return principalIsCitizenPortal(principal) && isCitizenSelfServicePrincipal(principal);
  }

  async createUploadIntent(
    principal: AuthenticatedPrincipal,
    dto: CreateUploadIntentDto,
    readScope?: ApplicationReadScope,
  ): Promise<UploadIntentResponse> {
    if (dto.size_mb > 10) {
      throw new BadRequestException('File size exceeds 10 MB');
    }

    const isCitizen = this.isCitizenPrincipal(principal);
    const application = isCitizen
      ? await this.applications.getOwnedApplication(principal, dto.application_id, readScope)
      : await this.applications.getApplicationForStaff(principal, dto.application_id);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentIntentCount = await this.prisma.applicationDocument.count({
      where: {
        applicationId: dto.application_id,
        createdAt: { gte: oneHourAgo },
      },
    });
    const limit = maxUploadIntentsPerApplicationPerHour();
    if (recentIntentCount >= limit) {
      throw new BadRequestException(
        `Too many document upload attempts for this application (max ${limit} per hour)`,
      );
    }

    // EN-16: staff attach is a context action, not a transition.
    // Citizens can only attach at submission (existing behaviour); staff can attach
    // at any stage. We record the stage and actor role for the audit list.
    const workflowStageCode = isCitizen
      ? 'submission'
      : (dto.workflow_stage_code ?? application.current_stage ?? 'unknown');
    const uploadedByRole = principal.roles[0] ?? (isCitizen ? 'citizen' : 'tenant_staff');

    const municipalTenantCode =
      application.tenant_code?.trim() || principal.tenantCode || principal.tenantId;
    const id = randomUUID();
    const createdAt = new Date();
    const objectKey = this.createObjectKey(
      municipalTenantCode,
      dto.application_id,
      id,
      dto.original_name,
    );

    const trimmedNote = dto.note?.trim();
    const note = trimmedNote && trimmedNote.length > 0 ? trimmedNote.slice(0, 500) : null;

    const row = await this.prisma.applicationDocument.create({
      data: {
        id,
        tenantId: application.tenant_id,
        applicationId: dto.application_id,
        documentCode: dto.document_code,
        originalName: dto.original_name,
        mimeType: dto.mime_type,
        sizeMb: dto.size_mb,
        objectKey,
        uploadStatus: 'intent_created',
        scanStatus: 'pending',
        workflowStageCode,
        uploadedByRole,
        note,
      },
    });

    const document = mapApplicationDocumentRow(row, principal.subject);
    await this.syncApplicationDocument(principal, document, readScope, isCitizen);

    const upload = await this.objectStorage.presignUpload(
      objectKey,
      dto.mime_type,
      uploadTtlMs,
      createdAt,
    );
    return {
      ...toDocumentResponse(document),
      upload_url: upload.url,
      upload_expires_at: upload.expires_at,
    };
  }

  async confirmUpload(
    principal: AuthenticatedPrincipal,
    documentId: string,
    readScope?: ApplicationReadScope,
  ): Promise<DocumentResponse> {
    const document = await this.getOwnedDocument(principal, documentId, readScope);
    if (document.upload_status === 'rejected') {
      throw new BadRequestException('Document upload was rejected');
    }

    if (this.objectStorage.isEnabled()) {
      const head = await this.objectStorage.headObject(document.object_key);
      if (!head || head.content_length <= 0) {
        throw new BadRequestException('Uploaded object not found in storage');
      }
    }

    if (document.upload_status === 'uploaded' && document.scan_status !== 'pending') {
      return toDocumentResponse(document);
    }

    const row = await this.prisma.applicationDocument.update({
      where: { id: documentId },
      data: { uploadStatus: 'uploaded' },
    });
    const updated = mapApplicationDocumentRow(row, principal.subject);
    await this.syncApplicationDocument(
      principal,
      updated,
      readScope,
      this.isCitizenPrincipal(principal),
    );
    await this.documentScanQueue.enqueueScan(documentId);
    return toDocumentResponse(updated);
  }

  async getDocument(
    principal: AuthenticatedPrincipal,
    documentId: string,
    readScope?: ApplicationReadScope,
  ): Promise<DocumentResponse> {
    const document = await this.getOwnedDocument(principal, documentId, readScope);
    return toDocumentResponse(document);
  }

  async updateScanResult(
    principal: AuthenticatedPrincipal,
    documentId: string,
    dto: UpdateScanResultDto,
    readScope?: ApplicationReadScope,
  ): Promise<DocumentResponse> {
    if (!allowsClientScanSimulation()) {
      throw new ForbiddenException(
        'Document scan results are applied by the scan worker; client scan simulation is disabled',
      );
    }
    const document = await this.getOwnedDocument(principal, documentId, readScope);
    const row = await this.prisma.applicationDocument.update({
      where: { id: documentId },
      data: {
        uploadStatus: dto.scan_status === 'failed' ? 'rejected' : 'uploaded',
        scanStatus: dto.scan_status,
        scanProvider: dto.scan_provider ?? null,
        scanSignature: dto.scan_signature ?? null,
        scanCompletedAt: new Date(),
      },
    });
    const updated = mapApplicationDocumentRow(row, document.citizen_subject);
    await this.syncApplicationDocument(
      principal,
      updated,
      readScope,
      this.isCitizenPrincipal(principal),
    );
    return toDocumentResponse(updated);
  }

  async createDownloadUrl(
    principal: AuthenticatedPrincipal,
    documentId: string,
    readScope?: ApplicationReadScope,
  ): Promise<DocumentDownloadResponse> {
    const document = await this.getOwnedDocument(principal, documentId, readScope);
    if (document.scan_status !== 'clean') {
      throw new BadRequestException('Document is not scan-clean');
    }
    if (document.upload_status !== 'uploaded') {
      throw new BadRequestException('Document upload is not complete');
    }

    if (this.objectStorage.isEnabled()) {
      const head = await this.objectStorage.headObject(document.object_key);
      if (!head || head.content_length <= 0) {
        throw new BadRequestException('Document object not found in storage');
      }
    }

    const now = new Date();
    const download = await this.objectStorage.presignDownload(
      document.object_key,
      downloadTtlMs,
      now,
    );
    return {
      id: document.id,
      object_key: document.object_key,
      download_url: download.url,
      download_expires_at: download.expires_at,
    };
  }

  async listForApplication(
    tenantId: string,
    applicationId: string,
    citizenSubject: string,
  ): Promise<StoredApplicationDocument[]> {
    const rows = await this.prisma.applicationDocument.findMany({
      where: { tenantId, applicationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => mapApplicationDocumentRow(row, citizenSubject));
  }

  private async getOwnedDocument(
    principal: AuthenticatedPrincipal,
    documentId: string,
    readScope?: ApplicationReadScope,
  ): Promise<StoredApplicationDocument> {
    const row = await this.prisma.applicationDocument.findUnique({
      where: { id: documentId },
    });
    if (!row) {
      throw new NotFoundException('Document not found');
    }

    const application = await this.applications.getOwnedApplication(
      principal,
      row.applicationId,
      readScope,
    );

    if (application.citizen_subject !== principal.subject) {
      throw new NotFoundException('Document not found');
    }

    if (!principalIsCitizenPortal(principal) || !isCitizenSelfServicePrincipal(principal)) {
      if (row.tenantId !== principal.tenantId) {
        throw new NotFoundException('Document not found');
      }
    }

    return mapApplicationDocumentRow(row, application.citizen_subject);
  }

  private async syncApplicationDocument(
    principal: AuthenticatedPrincipal,
    document: StoredApplicationDocument,
    readScope: ApplicationReadScope | undefined,
    isCitizen: boolean,
  ): Promise<void> {
    const response = toApplicationDocumentResponse(document);
    if (isCitizen) {
      await this.applications.attachDocument(
        principal,
        document.application_id,
        response,
        readScope,
      );
      return;
    }
    await this.applications.attachDocumentForStaff(principal, document.application_id, response);
  }

  private createObjectKey(
    tenantCodeForPath: string,
    applicationId: string,
    documentId: string,
    originalName: string,
  ): string {
    const tenantCode = tenantCodeForPath.toLowerCase();
    const safeName = originalName.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    return `tenants/${tenantCode}/applications/${applicationId}/documents/${documentId}/${safeName}`;
  }
}
