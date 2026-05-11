import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import type { ReceiptVerifierDto } from './dto';

const OPAQUE_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ReceiptVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyByOpaqueToken(opaqueVerifier: string): Promise<ReceiptVerifierDto> {
    if (!OPAQUE_UUID_V4.test(opaqueVerifier)) {
      return { valid: false };
    }

    const receipt = await this.prisma.receipt.findUnique({
      where: {
        verificationToken: opaqueVerifier,
      },
      include: {
        tenant: { select: { code: true } },
        payment: {
          select: {
            gatewayOrderId: true,
            gatewayPaymentId: true,
          },
        },
      },
    });

    if (!receipt) {
      return { valid: false };
    }

    return {
      valid: true,
      receipt_number: receipt.receiptNumber,
      issued_at: receipt.issuedAt.toISOString(),
      tenant_code: receipt.tenant.code,
      revenue_head_code: receipt.revenueHeadCode,
      service_code: receipt.serviceCode,
      accounting_code: receipt.accountingCode,
      amount_paise: receipt.amountPaise,
      currency: 'INR',
      gateway_order_id: receipt.payment.gatewayOrderId,
      gateway_payment_ref: receipt.payment.gatewayPaymentId,
    };
  }
}
