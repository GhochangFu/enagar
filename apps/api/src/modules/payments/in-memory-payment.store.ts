import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import {
  buildReceiptDisplayNumber,
  receiptToCitizenDto,
  stubGatewayPaymentCaptureRef,
  verificationTokenFresh,
} from './receipt-mapping';

import type { LedgerSettlementDto, PaymentResponse, PaymentStatus, ReceiptCitizenDto } from './dto';
import type {
  CreatePendingPaymentInput,
  ExistingIdempotencyRecord,
  PaymentStore,
  SettlementLedgerContext,
} from './payment-store';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

interface IdempotencyRecord {
  fingerprint: string;
  paymentId: string;
}

function receiptSlipId(): string {
  return randomUUID();
}

function tenantSlugForReceipt(principal: AuthenticatedPrincipal): string {
  if (principal.tenantCode?.trim()) {
    return principal.tenantCode.trim();
  }
  return principal.tenantId.slice(0, 8).replace(/[^A-Za-z0-9]/g, '') || 'TENANT';
}

@Injectable()
export class InMemoryPaymentStore implements PaymentStore {
  private readonly payments = new Map<string, PaymentResponse>();
  private readonly activePaymentByApplication = new Map<string, string>();
  private readonly idempotencyRecords = new Map<string, IdempotencyRecord>();
  /** Sprint 3.2 in-memory fidelity for receipt reads after deterministic stub settlement. */
  private readonly receiptsByPayment = new Map<string, ReceiptCitizenDto>();

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

  async settleStubLedger(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    gatewayOrderId: string,
    ctx: SettlementLedgerContext,
  ): Promise<LedgerSettlementDto> {
    const paymentRow = await this.findByIdForPrincipal(principal, paymentId);
    if (!paymentRow) {
      throw new NotFoundException('Payment not found');
    }

    if (paymentRow.gateway_order_id !== gatewayOrderId) {
      throw new NotFoundException('Payment not found');
    }

    if (paymentRow.status !== 'requires_action') {
      throw new ConflictException('Payment is not awaiting deterministic completion');
    }

    const now = new Date();
    const settled: PaymentResponse = {
      ...paymentRow,
      status: 'settled' satisfies PaymentStatus,
      gateway_payment_id: stubGatewayPaymentCaptureRef(paymentId),
      settled_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    this.payments.set(paymentId, settled);

    const activePaymentId = this.activePaymentByApplication.get(settled.application_id);
    if (activePaymentId === paymentId) {
      this.activePaymentByApplication.delete(settled.application_id);
    }

    const verificationToken = verificationTokenFresh();

    const receiptDto = receiptToCitizenDto({
      id: receiptSlipId(),
      receipt_number: buildReceiptDisplayNumber(tenantSlugForReceipt(principal)),
      payment_id: paymentId,
      application_id: paymentRow.application_id,
      service_code: ctx.serviceCode,
      revenue_head_code: ctx.revenueHeadCode,
      amount_paise: paymentRow.amount_paise,
      issued_at: now,
      verification_token: verificationToken,
    });

    this.receiptsByPayment.set(paymentId, receiptDto);

    return {
      payment: clonePaymentResponse(settled),
      receipt: receiptDto,
    };
  }

  async findReceiptForPayment(
    principal: AuthenticatedPrincipal,
    paymentId: string,
  ): Promise<ReceiptCitizenDto | null> {
    const receipt = this.receiptsByPayment.get(paymentId);
    const paymentRow = await this.findByIdForPrincipal(principal, paymentId);

    if (!receipt || !paymentRow || paymentRow.status !== 'settled') {
      return null;
    }

    return receipt;
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
