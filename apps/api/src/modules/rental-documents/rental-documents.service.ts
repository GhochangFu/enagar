import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';

import type { Prisma, LeaseAgreementDocumentStatus } from '../../generated/prisma';

export interface UploadedFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
}

export interface RecordUploadInput {
  tenantId: string;
  agreementId: string;
  uploadedBy: string;
  file: UploadedFile;
}

export interface ReviewDocumentInput {
  tenantId: string;
  documentId: string;
  actorUserId: string;
  decision: 'APPROVE' | 'REJECT';
  note?: string;
}

@Injectable()
export class RentalDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  async recordUpload(input: RecordUploadInput) {
    this.storage.assertTenantObjectKey(
      input.file.storageKey,
      await this.tenantCodeOf(input.tenantId),
    );
    const agreement = await this.prisma.leaseAgreement.findFirst({
      where: { id: input.agreementId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!agreement) throw new NotFoundException('Lease agreement not found');
    return this.prisma.$transaction(async (tx) => {
      const doc = await tx.leaseAgreementDocument.create({
        data: {
          tenantId: input.tenantId,
          agreementId: input.agreementId,
          fileName: input.file.fileName,
          mimeType: input.file.mimeType,
          sizeBytes: input.file.sizeBytes,
          sha256: input.file.sha256,
          storageKey: input.file.storageKey,
          status: 'PENDING_REVIEW',
          uploadedBy: input.uploadedBy,
        },
      });
      await tx.leaseAgreementDocumentEvent.create({
        data: {
          tenantId: input.tenantId,
          documentId: doc.id,
          eventType: 'UPLOADED',
          actorUserId: input.uploadedBy,
          payload: {
            fileName: input.file.fileName,
            sizeBytes: input.file.sizeBytes,
          } as Prisma.JsonObject,
        },
      });
      return doc;
    });
  }

  async listDocuments(tenantId: string, status?: LeaseAgreementDocumentStatus) {
    return this.prisma.leaseAgreementDocument.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { uploadedAt: 'desc' },
      include: {
        agreement: { include: { asset: { select: { id: true, name: true } } } },
      },
    });
  }

  async reviewDocument(input: ReviewDocumentInput) {
    if (input.decision === 'REJECT' && !input.note?.trim()) {
      throw new BadRequestException('Rejection note is required');
    }
    const doc = await this.prisma.leaseAgreementDocument.findFirst({
      where: { id: input.documentId, tenantId: input.tenantId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.status !== 'PENDING_REVIEW') {
      throw new BadRequestException(`Document is already ${doc.status.toLowerCase()}`);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.leaseAgreementDocument.update({
        where: { id: doc.id },
        data: {
          status: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          reviewedBy: input.actorUserId,
          reviewedAt: new Date(),
          reviewerNote: input.note ?? null,
        },
      });
      await tx.leaseAgreementDocumentEvent.create({
        data: {
          tenantId: input.tenantId,
          documentId: doc.id,
          eventType: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          actorUserId: input.actorUserId,
          payload: { note: input.note ?? null } as Prisma.JsonObject,
        },
      });
      if (input.decision === 'APPROVE') {
        await tx.leaseAgreement.update({
          where: { id: doc.agreementId },
          data: { status: 'ACTIVE' },
        });
      }
      return updated;
    });
  }

  private async tenantCodeOf(tenantId: string): Promise<string> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { code: true },
    });
    if (!t) throw new NotFoundException('Tenant not found');
    return t.code;
  }
}
