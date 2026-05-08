import type { PaymentMethod, PaymentResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

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
  listByPrincipal(principal: AuthenticatedPrincipal): Promise<PaymentResponse[]>;
  findByIdForPrincipal(
    principal: AuthenticatedPrincipal,
    paymentId: string,
  ): Promise<PaymentResponse | null>;
}
