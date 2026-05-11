import { randomBytes, randomUUID } from 'node:crypto';

import { RECEIPT_NUMBER_PREFIX, RECEIPT_QR_CONTRACT_VERSION } from './payment-financial.constants';

import type { ReceiptCitizenDto } from './dto';

export function buildReceiptDisplayNumber(tenantCode: string): string {
  const slug = tenantCode
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  const suffix = randomBytes(5).toString('hex');
  const candidate = `${RECEIPT_NUMBER_PREFIX}-${slug}-${suffix}`;
  return candidate.length <= 48 ? candidate : candidate.slice(0, 48);
}

export function verificationPathForToken(verificationToken: string): string {
  return `/api/public/receipts/verify/${verificationToken}`;
}

export function receiptToCitizenDto(input: {
  id: string;
  receipt_number: string;
  payment_id: string;
  application_id: string;
  service_code: string;
  revenue_head_code: string;
  amount_paise: number;
  issued_at: Date;
  verification_token: string;
}): ReceiptCitizenDto {
  const verification_path = verificationPathForToken(input.verification_token);

  return {
    id: input.id,
    receipt_number: input.receipt_number,
    payment_id: input.payment_id,
    application_id: input.application_id,
    service_code: input.service_code,
    revenue_head_code: input.revenue_head_code,
    amount_paise: input.amount_paise,
    currency: 'INR',
    issued_at: input.issued_at.toISOString(),
    verification_path,
    qr_contract: {
      format: 'enagar_receipt_verify_v1',
      version: RECEIPT_QR_CONTRACT_VERSION,
      verification_path,
    },
  };
}

/** Gateway capture reference persisted on settled stub payments prior to PSP identifiers in Sprint 3.1B. */
export function stubGatewayPaymentCaptureRef(paymentId: string): string {
  return `stub_capture_${paymentId}`;
}

export function verificationTokenFresh(): string {
  return randomUUID();
}
