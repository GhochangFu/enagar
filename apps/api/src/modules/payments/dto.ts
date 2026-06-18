import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export const paymentFeeCodes = ['application', 'approval'] as const;
export type PaymentFeeCode = (typeof paymentFeeCodes)[number];

export const paymentMethods = ['upi', 'card', 'netbanking', 'wallet'] as const;

export type PaymentMethod = (typeof paymentMethods)[number];
export type PaymentStatus = 'requires_action' | 'settled' | 'failed';

export class InitiatePaymentDto {
  @ApiProperty({ example: '8c81a274-51de-42c2-97e7-8a41ce34c4f3' })
  @IsUUID()
  application_id!: string;

  @ApiProperty({ example: 5000, minimum: 1 })
  @IsInt()
  @Min(1)
  amount_paise!: number;

  @ApiProperty({ enum: paymentMethods, example: 'upi' })
  @IsString()
  @IsNotEmpty()
  @IsIn(paymentMethods)
  method!: PaymentMethod;

  @ApiProperty({ enum: paymentFeeCodes, example: 'application', required: false })
  @IsOptional()
  @IsIn(paymentFeeCodes)
  fee_code?: PaymentFeeCode;
}

export interface PaymentResponse {
  id: string;
  tenant_id: string;
  citizen_subject: string;
  application_id: string | null;
  booking_reservation_id: string | null;
  /**
   * Set when the Payment was created to settle a `LeaseInvoice` (rent).
   * Mirrors `Payment.leaseInvoiceId` on the schema. The PWA reads this to
   * show a "Rent" badge in the citizen Service-payments list.
   */
  lease_invoice_id?: string | null;
  /** Set when payment was created for an EV charging session settlement. */
  ev_session_id?: string | null;
  /** Set when payment was created for an IoT water meter prepaid recharge. */
  water_meter_recharge_id?: string | null;
  fee_code: PaymentFeeCode | string;
  amount_paise: number;
  currency: 'INR';
  method: PaymentMethod;
  status: PaymentStatus;
  gateway: 'stub';
  gateway_order_id: string;
  gateway_payment_id?: string | null;
  settled_at?: string | null;
  redirect_url: string;
  created_at: string;
  updated_at: string;
}

/** Body for Sprint 3.2 deterministic stub gateway completion — simulates PSP capture prior to webhook work in 3.1B. */
export class StubCompletePaymentDto {
  @ApiProperty({ example: '8c81a274-51de-42c2-9ee7-8a41ce34c4f3' })
  @IsUUID()
  payment_id!: string;

  @ApiProperty({ example: 'stub_order_8c81a274-51de-42c2-9ee7-8a41ce34c4f3' })
  @IsString()
  @IsNotEmpty()
  gateway_order_id!: string;
}

/** Citizen-safe receipt artefact emitted after Sprint 3.2 settlement — PDF worker remains future work; QR contract is canonical. */
export interface ReceiptCitizenDto {
  id: string;
  receipt_number: string;
  payment_id: string;
  application_id: string | null;
  booking_reservation_id?: string | null;
  water_meter_recharge_id?: string | null;
  service_code: string;
  revenue_head_code: string;
  amount_paise: number;
  currency: 'INR';
  issued_at: string;
  /** Opaque verifier path (combine with PUBLIC_API_ORIGIN externally for absolute URLs). */
  verification_path: string;
  /** Machine-readable QR payload for receipt PDFs (`format` discriminator + relative verify path). */
  qr_contract: {
    format: 'enagar_receipt_verify_v1';
    version: 1;
    verification_path: string;
  };
}

/** Public verifier response intentionally omits citizen identity and retains only audit-grade metadata. */
export interface ReceiptVerifierDto {
  valid: boolean;
  receipt_number?: string;
  issued_at?: string;
  tenant_code?: string;
  revenue_head_code?: string;
  service_code?: string;
  accounting_code?: string;
  /** Amount payable and recognized (whole rupees in paise). */
  amount_paise?: number;
  currency?: 'INR';
  gateway_order_id?: string;
  gateway_payment_ref?: string | null;
}

export interface LedgerSettlementDto {
  payment: PaymentResponse;
  receipt: ReceiptCitizenDto;
}
