import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { ApplicationsService } from '../applications/applications.service';

import type {
  CreateUploadIntentDto,
  DocumentDownloadResponse,
  DocumentResponse,
  DocumentScanStatus,
  UpdateScanResultDto,
  UploadIntentResponse,
} from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { ApplicationDocumentResponse } from '../applications/dto';

interface StoredDocument extends DocumentResponse {
  tenant_id: string;
  citizen_subject: string;
}

const uploadTtlMs = 15 * 60 * 1000;
const downloadTtlMs = 5 * 60 * 1000;

@Injectable()
export class DocumentsService {
  private readonly documents = new Map<string, StoredDocument>();

  constructor(private readonly applications: ApplicationsService) {}

  createUploadIntent(
    principal: AuthenticatedPrincipal,
    dto: CreateUploadIntentDto,
  ): UploadIntentResponse {
    if (dto.size_mb > 10) {
      throw new BadRequestException('File size exceeds 10 MB');
    }

    const application = this.applications.getOwnedApplication(principal, dto.application_id);
    const id = randomUUID();
    const createdAt = new Date();
    const objectKey = this.createObjectKey(principal, dto.application_id, id, dto.original_name);
    const document: StoredDocument = {
      id,
      tenant_id: principal.tenantId,
      citizen_subject: principal.subject,
      application_id: dto.application_id,
      document_code: dto.document_code,
      original_name: dto.original_name,
      mime_type: dto.mime_type,
      size_mb: dto.size_mb,
      object_key: objectKey,
      upload_status: 'intent_created',
      scan_status: 'pending',
      created_at: createdAt.toISOString(),
    };

    this.documents.set(id, document);
    this.applications.attachDocument(principal, application.id, toApplicationDocument(document));

    return {
      ...toDocumentResponse(document),
      upload_url: this.signedUrl('upload', objectKey, createdAt, uploadTtlMs),
      upload_expires_at: new Date(createdAt.getTime() + uploadTtlMs).toISOString(),
    };
  }

  updateScanResult(
    principal: AuthenticatedPrincipal,
    documentId: string,
    dto: UpdateScanResultDto,
  ): DocumentResponse {
    const document = this.getOwnedDocument(principal, documentId);
    const updated: StoredDocument = {
      ...document,
      upload_status: dto.scan_status === 'failed' ? 'rejected' : 'uploaded',
      scan_status: dto.scan_status,
    };

    this.documents.set(documentId, updated);
    this.applications.attachDocument(
      principal,
      updated.application_id,
      toApplicationDocument(updated),
    );
    return toDocumentResponse(updated);
  }

  createDownloadUrl(
    principal: AuthenticatedPrincipal,
    documentId: string,
  ): DocumentDownloadResponse {
    const document = this.getOwnedDocument(principal, documentId);
    if (document.scan_status !== 'clean') {
      throw new BadRequestException('Document is not scan-clean');
    }

    const now = new Date();
    return {
      id: document.id,
      object_key: document.object_key,
      download_url: this.signedUrl('download', document.object_key, now, downloadTtlMs),
      download_expires_at: new Date(now.getTime() + downloadTtlMs).toISOString(),
    };
  }

  private getOwnedDocument(principal: AuthenticatedPrincipal, documentId: string): StoredDocument {
    const document = this.documents.get(documentId);
    if (
      !document ||
      document.tenant_id !== principal.tenantId ||
      document.citizen_subject !== principal.subject
    ) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  private createObjectKey(
    principal: AuthenticatedPrincipal,
    applicationId: string,
    documentId: string,
    originalName: string,
  ): string {
    const tenantCode = principal.tenantCode?.toLowerCase() ?? principal.tenantId;
    const safeName = originalName.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    return `tenants/${tenantCode}/applications/${applicationId}/documents/${documentId}/${safeName}`;
  }

  private signedUrl(
    action: 'upload' | 'download',
    objectKey: string,
    now: Date,
    ttlMs: number,
  ): string {
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
    return `minio://enagar-local/${objectKey}?action=${action}&expires_at=${encodeURIComponent(expiresAt)}`;
  }
}

function toDocumentResponse(document: StoredDocument): DocumentResponse {
  return {
    id: document.id,
    application_id: document.application_id,
    document_code: document.document_code,
    original_name: document.original_name,
    mime_type: document.mime_type,
    size_mb: document.size_mb,
    object_key: document.object_key,
    upload_status: document.upload_status,
    scan_status: document.scan_status as DocumentScanStatus,
    created_at: document.created_at,
  };
}

function toApplicationDocument(document: StoredDocument): ApplicationDocumentResponse {
  return {
    id: document.id,
    document_code: document.document_code,
    original_name: document.original_name,
    mime_type: document.mime_type,
    size_mb: document.size_mb,
    upload_status: document.upload_status,
    scan_status: document.scan_status,
    object_key: document.object_key,
    created_at: document.created_at,
  };
}
