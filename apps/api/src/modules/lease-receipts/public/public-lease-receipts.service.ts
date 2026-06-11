import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/database/prisma.service';

export interface PublicReceiptView {
  receiptNumber: string;
  amountPaise: number;
  currency: string;
  lessorName: string;
  settlementAt: Date | null;
  verifiedBy: 'eNagarSeba';
}

@Injectable()
export class PublicLeaseReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async verify(token: string): Promise<PublicReceiptView | null> {
    if (!token || token.length < 8) return null;
    const receipt = await this.prisma.receipt.findUnique({
      where: { verificationToken: token },
    });
    if (!receipt || !receipt.leaseInvoiceId) return null;
    const payment = await this.prisma.payment.findUnique({ where: { id: receipt.paymentId } });
    const invoice = await this.prisma.leaseInvoice.findUnique({
      where: { id: receipt.leaseInvoiceId },
      include: { agreement: { select: { lessorName: true } } },
    });
    if (!invoice) return null;
    return {
      receiptNumber: receipt.receiptNumber,
      amountPaise: receipt.amountPaise,
      currency: receipt.currency,
      lessorName: invoice.agreement.lessorName,
      settlementAt: payment?.settledAt ?? receipt.issuedAt,
      verifiedBy: 'eNagarSeba',
    };
  }
}
