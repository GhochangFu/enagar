import type { DocumentResponse, DocumentScanStatus, DocumentUploadStatus } from './dto';
import type { ApplicationDocument } from '../../generated/prisma';
import type { ApplicationDocumentResponse } from '../applications/dto';

export type StoredApplicationDocument = DocumentResponse & {
  tenant_id: string;
  citizen_subject: string;
};

export function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export function mapApplicationDocumentRow(
  row: ApplicationDocument,
  citizenSubject: string,
): StoredApplicationDocument {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    citizen_subject: citizenSubject,
    application_id: row.applicationId,
    document_code: row.documentCode,
    original_name: row.originalName,
    mime_type: row.mimeType as StoredApplicationDocument['mime_type'],
    size_mb: decimalToNumber(row.sizeMb),
    object_key: row.objectKey,
    upload_status: row.uploadStatus as DocumentUploadStatus,
    scan_status: row.scanStatus as DocumentScanStatus,
    created_at: row.createdAt.toISOString(),
    workflow_stage_code: row.workflowStageCode ?? undefined,
    uploaded_by_role: row.uploadedByRole ?? undefined,
    note: row.note ?? undefined,
  };
}

export function toDocumentResponse(document: StoredApplicationDocument): DocumentResponse {
  return {
    id: document.id,
    application_id: document.application_id,
    document_code: document.document_code,
    original_name: document.original_name,
    mime_type: document.mime_type,
    size_mb: document.size_mb,
    object_key: document.object_key,
    upload_status: document.upload_status,
    scan_status: document.scan_status,
    created_at: document.created_at,
    workflow_stage_code: document.workflow_stage_code,
    uploaded_by_role: document.uploaded_by_role,
    note: document.note,
  };
}

export function toApplicationDocumentResponse(
  document: StoredApplicationDocument,
): ApplicationDocumentResponse {
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
