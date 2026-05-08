import { Injectable } from '@nestjs/common';

import type { PaymentResponse } from './dto';
import type {
  CreatePendingPaymentInput,
  ExistingIdempotencyRecord,
  PaymentStore,
} from './payment-store';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

interface IdempotencyRecord {
  fingerprint: string;
  paymentId: string;
}

@Injectable()
export class InMemoryPaymentStore implements PaymentStore {
  private readonly payments = new Map<string, PaymentResponse>();
  private readonly activePaymentByApplication = new Map<string, string>();
  private readonly idempotencyRecords = new Map<string, IdempotencyRecord>();

  async findIdempotencyRecord(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
  ): Promise<ExistingIdempotencyRecord | null> {
    return (
      this.idempotencyRecords.get(this.idempotencyRecordKey(principal, idempotencyKey)) ?? null
    );
  }

  async findActivePaymentByApplication(applicationId: string): Promise<PaymentResponse | null> {
    const paymentId = this.activePaymentByApplication.get(applicationId);
    if (!paymentId) {
      return null;
    }
    return clonePayment(this.payments.get(paymentId) ?? null);
  }

  async createPendingPayment(input: CreatePendingPaymentInput): Promise<PaymentResponse> {
    const now = new Date().toISOString();
    const payment: PaymentResponse = {
      id: input.id,
      tenant_id: input.tenantId,
      citizen_subject: input.citizenSubject,
      application_id: input.applicationId,
      amount_paise: input.amountPaise,
      currency: 'INR',
      method: input.method,
      status: 'requires_action',
      gateway: input.gateway,
      gateway_order_id: input.gatewayOrderId,
      redirect_url: input.redirectUrl,
      created_at: now,
      updated_at: now,
    };

    this.payments.set(payment.id, payment);
    this.activePaymentByApplication.set(payment.application_id, payment.id);
    this.idempotencyRecords.set(
      `${input.tenantId}:${input.citizenSubject}:${input.idempotencyKey}`,
      {
        fingerprint: input.requestFingerprint,
        paymentId: payment.id,
      },
    );

    return clonePaymentResponse(payment);
  }

  async listByPrincipal(principal: AuthenticatedPrincipal): Promise<PaymentResponse[]> {
    return Array.from(this.payments.values())
      .filter((payment) => this.canAccess(principal, payment))
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map(clonePaymentResponse);
  }

  async findByIdForPrincipal(
    principal: AuthenticatedPrincipal,
    paymentId: string,
  ): Promise<PaymentResponse | null> {
    const payment = this.payments.get(paymentId) ?? null;
    if (!payment || !this.canAccess(principal, payment)) {
      return null;
    }
    return clonePayment(payment);
  }

  private canAccess(principal: AuthenticatedPrincipal, payment: PaymentResponse): boolean {
    return (
      payment.tenant_id === principal.tenantId && payment.citizen_subject === principal.subject
    );
  }

  private idempotencyRecordKey(principal: AuthenticatedPrincipal, idempotencyKey: string): string {
    return `${principal.tenantId}:${principal.subject}:${idempotencyKey}`;
  }
}

function clonePayment(payment: PaymentResponse | null): PaymentResponse | null {
  return payment ? { ...payment } : null;
}

function clonePaymentResponse(payment: PaymentResponse): PaymentResponse {
  return { ...payment };
}
