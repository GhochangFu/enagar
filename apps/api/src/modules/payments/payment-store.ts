import type { LedgerSettlementDto, PaymentMethod, PaymentResponse, ReceiptCitizenDto } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { ApplicationReadScope } from '../applications/dto';

export const PAYMENT_STORE = 'PAYMENT_STORE';

export interface CreatePendingPaymentInput {
  id: string;
  tenantId: string;
  citizenSubject: string;
  applicationId: string;
  amountPaise: number;
  method: PaymentMethod;
  gateway: 'stub';
  gatewayOrderId: string;
  redirectUrl: string;
  idempotencyKey: string;
  requestFingerprint: string;
  expiresAt: Date;
}

/** Revenue / GL lineage resolved from catalogue at settlement time — provider-neutral identifiers only. */
export interface SettlementLedgerContext {
  revenueHeadCode: string;
  accountingCode: string;
  serviceCode: string;
}

export interface ExistingIdempotencyRecord {
  fingerprint: string;
  paymentId: string;
}

export interface PaymentStore {
  findIdempotencyRecord(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
  ): Promise<ExistingIdempotencyRecord | null>;
  findActivePaymentByApplication(applicationId: string): Promise<PaymentResponse | null>;
  createPendingPayment(input: CreatePendingPaymentInput): Promise<PaymentResponse>;
  listByPrincipal(
    principal: AuthenticatedPrincipal,
    readScope?: ApplicationReadScope,
  ): Promise<PaymentResponse[]>;
  findByIdForPrincipal(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    readScope?: ApplicationReadScope,
  ): Promise<PaymentResponse | null>;

  settleStubLedger(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    gatewayOrderId: string,
    ctx: SettlementLedgerContext,
  ): Promise<LedgerSettlementDto>;

  findReceiptForPayment(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    readScope?: ApplicationReadScope,
  ): Promise<ReceiptCitizenDto | null>;
}
