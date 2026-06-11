import * as crypto from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';

import { renderLeaseReceiptPdf } from './lease-receipts.pdf';
import { buildReceiptVerifyUrl, renderQrPng } from './lease-receipts.qr';

@Injectable()
export class LeaseReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  /**
   * Generate (or regenerate) the PDF for a Receipt row tied to a lease invoice.
   * Called from the payments settlement hook. Returns the updated row.
   */
  async generateForReceipt(tenantId: string, receiptId: string, publicBase: string) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, tenantId, leaseInvoiceId: { not: null } },
    });
    if (!receipt) throw new NotFoundException('Lease receipt not found');

    const [payment, invoice, tenant] = await Promise.all([
      this.prisma.payment.findFirst({ where: { id: receipt.paymentId } }),
      this.prisma.leaseInvoice.findFirst({
        where: { id: receipt.leaseInvoiceId ?? undefined },
        include: { agreement: true },
      }),
      this.prisma.tenant.findUnique({ where: { id: receipt.tenantId } }),
    ]);
    if (!payment || !invoice || !tenant) {
      throw new NotFoundException('Required receipt context missing');
    }

    const verifyUrl = buildReceiptVerifyUrl(publicBase, receipt.verificationToken);
    const qrPng = await renderQrPng(verifyUrl, 200);
    const pdf = await renderLeaseReceiptPdf({
      receiptNumber: receipt.receiptNumber,
      amountPaise: receipt.amountPaise,
      currency: receipt.currency,
      lessorName: invoice.agreement.lessorName,
      lessorPhone: invoice.agreement.lessorPhone ?? undefined,
      settlementAt: payment.settledAt ?? new Date(),
      invoiceNo: invoice.invoiceNo,
      branding: { ulbName: tenant.name },
      qrPng,
      verifyUrl,
    });
    const sha256 = crypto.createHash('sha256').update(pdf).digest('hex');
    const storageKey = `tenants/${tenant.code}/lease-receipts/${receipt.receiptNumber}.pdf`;

    await this.storage.putObject(storageKey, pdf, 'application/pdf');

    return this.prisma.receipt.update({
      where: { id: receipt.id },
      data: { storageKey, sha256, sizeBytes: pdf.byteLength, generatedAt: new Date() },
    });
  }

  async getStoredPdf(tenantId: string, receiptId: string): Promise<Buffer> {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, tenantId },
      select: { id: true, storageKey: true, receiptNumber: true },
    });
    if (!receipt || !receipt.storageKey) {
      throw new NotFoundException('Receipt has no stored PDF yet');
    }
    const buf = await this.storage.getObjectBuffer(receipt.storageKey);
    if (!buf) {
      throw new NotFoundException(`Stored PDF not found for ${receipt.receiptNumber}`);
    }
    return buf;
  }
}
