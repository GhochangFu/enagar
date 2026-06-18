import type { LedgerSettlementDto, PaymentMethod, PaymentResponse, ReceiptCitizenDto } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { FeeLineCode } from '../admin-tenant/admin-tenant-config.contracts';
import type { ApplicationReadScope } from '../applications/dto';

export const PAYMENT_STORE = 'PAYMENT_STORE';

export interface CreatePendingPaymentInput {
  id: string;
  tenantId: string;
  citizenSubject: string;
  applicationId?: string;
  bookingReservationId?: string;
  leaseInvoiceId?: string;
  evSessionId?: string;
  feeCode: FeeLineCode | string;
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
  /**
   * Looks up idempotency by citizen subject + key.
   * @param idempotencyTenantId When set (e.g. application’s municipal `tenant_id`), must match
   *   portal-initiated payments so keys are not namespaced under WBPORTAL.
   */
  findIdempotencyRecord(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    idempotencyTenantId?: string,
  ): Promise<ExistingIdempotencyRecord | null>;
  findActivePaymentByApplication(
    applicationId: string,
    feeCode?: FeeLineCode,
  ): Promise<PaymentResponse | null>;
  findActivePaymentByBookingReservation(
    bookingReservationId: string,
  ): Promise<PaymentResponse | null>;
  findActivePaymentByEvSession(evSessionId: string): Promise<PaymentResponse | null>;
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
