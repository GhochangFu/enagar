import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { citizenHubRowAccessibleByTenant } from '../../common/auth/citizen-scope';
import { tenantSeeds } from '../tenants/tenant.seed';

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
import type { FeeLineCode } from '../admin-tenant/admin-tenant-config.contracts';
import type { ApplicationReadScope } from '../applications/dto';

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

function tenantSlugForPaymentTenant(tenantId: string, principal: AuthenticatedPrincipal): string {
  const match = tenantSeeds.find((t) => t.id === tenantId);
  const code = match?.code?.trim();
  if (code) {
    return code.replace(/[^A-Za-z0-9]/g, '') || 'TENANT';
  }
  return tenantSlugForReceipt(principal);
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
    idempotencyTenantId?: string,
  ): Promise<ExistingIdempotencyRecord | null> {
    return (
      this.idempotencyRecords.get(
        this.idempotencyRecordKey(principal, idempotencyKey, idempotencyTenantId),
      ) ?? null
    );
  }

  async findActivePaymentByBookingReservation(
    bookingReservationId: string,
  ): Promise<PaymentResponse | null> {
    for (const payment of this.payments.values()) {
      if (
        payment.booking_reservation_id === bookingReservationId &&
        payment.status === 'requires_action'
      ) {
        return clonePayment(payment);
      }
    }
    return null;
  }

  async findActivePaymentByEvSession(evSessionId: string): Promise<PaymentResponse | null> {
    for (const payment of this.payments.values()) {
      if (payment.ev_session_id === evSessionId && payment.status === 'requires_action') {
        return clonePayment(payment);
      }
    }
    return null;
  }

  async findActivePaymentByApplication(
    applicationId: string,
    feeCode?: FeeLineCode,
  ): Promise<PaymentResponse | null> {
    if (feeCode) {
      const key = activePaymentKey(applicationId, feeCode);
      const paymentId = this.activePaymentByApplication.get(key);
      if (!paymentId) {
        return null;
      }
      return clonePayment(this.payments.get(paymentId) ?? null);
    }
    for (const code of ['application', 'approval'] as const) {
      const payment = await this.findActivePaymentByApplication(applicationId, code);
      if (payment) {
        return payment;
      }
    }
    return null;
  }

  async createPendingPayment(input: CreatePendingPaymentInput): Promise<PaymentResponse> {
    const now = new Date().toISOString();
    const payment: PaymentResponse = {
      id: input.id,
      tenant_id: input.tenantId,
      citizen_subject: input.citizenSubject,
      application_id: input.applicationId ?? null,
      booking_reservation_id: input.bookingReservationId ?? null,
      lease_invoice_id: input.leaseInvoiceId ?? null,
      ev_session_id: input.evSessionId ?? null,
      fee_code: input.feeCode,
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
    if (payment.application_id) {
      this.activePaymentByApplication.set(
        activePaymentKey(payment.application_id, input.feeCode as FeeLineCode),
        payment.id,
      );
    }
    this.idempotencyRecords.set(
      `${input.tenantId}:${input.citizenSubject}:${input.idempotencyKey}`,
      {
        fingerprint: input.requestFingerprint,
        paymentId: payment.id,
      },
    );

    return clonePaymentResponse(payment);
  }

  async listByPrincipal(
    principal: AuthenticatedPrincipal,
    readScope?: ApplicationReadScope,
  ): Promise<PaymentResponse[]> {
    return Array.from(this.payments.values())
      .filter((payment) => this.canAccess(principal, payment, readScope))
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map(clonePaymentResponse);
  }

  async findByIdForPrincipal(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    readScope?: ApplicationReadScope,
  ): Promise<PaymentResponse | null> {
    const payment = this.payments.get(paymentId) ?? null;
    if (!payment || !this.canAccess(principal, payment, readScope)) {
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
    const paymentRow = await this.findByIdForPrincipal(principal, paymentId, undefined);
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

    if (settled.application_id) {
      const activePaymentId = this.activePaymentByApplication.get(
        activePaymentKey(settled.application_id, settled.fee_code as FeeLineCode),
      );
      if (activePaymentId === paymentId) {
        this.activePaymentByApplication.delete(
          activePaymentKey(settled.application_id, settled.fee_code as FeeLineCode),
        );
      }
    }

    const verificationToken = verificationTokenFresh();

    const receiptDto = receiptToCitizenDto({
      id: receiptSlipId(),
      receipt_number: buildReceiptDisplayNumber(
        tenantSlugForPaymentTenant(paymentRow.tenant_id, principal),
      ),
      payment_id: paymentId,
      application_id: paymentRow.application_id,
      booking_reservation_id: paymentRow.booking_reservation_id,
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
    readScope?: ApplicationReadScope,
  ): Promise<ReceiptCitizenDto | null> {
    const receipt = this.receiptsByPayment.get(paymentId);
    const paymentRow = await this.findByIdForPrincipal(principal, paymentId, readScope);

    if (!receipt || !paymentRow || paymentRow.status !== 'settled') {
      return null;
    }

    return receipt;
  }

  private canAccess(
    principal: AuthenticatedPrincipal,
    payment: PaymentResponse,
    readScope?: ApplicationReadScope,
  ): boolean {
    return citizenHubRowAccessibleByTenant(
      principal,
      { tenant_id: payment.tenant_id, citizen_subject: payment.citizen_subject },
      readScope,
    );
  }

  private idempotencyRecordKey(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    idempotencyTenantId?: string,
  ): string {
    const tenantId = idempotencyTenantId ?? principal.tenantId;
    return `${tenantId}:${principal.subject}:${idempotencyKey}`;
  }
}

function activePaymentKey(applicationId: string, feeCode: FeeLineCode): string {
  return `${applicationId}:${feeCode}`;
}

function clonePayment(payment: PaymentResponse | null): PaymentResponse | null {
  return payment ? { ...payment } : null;
}

function clonePaymentResponse(payment: PaymentResponse): PaymentResponse {
  return { ...payment };
}
