import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  citizenHubRowAccessibleByTenant,
  isCitizenSelfServicePrincipal,
  principalIsCitizenPortal,
  resolveMunicipalityTenantIdFromScopeCode,
} from '../../common/auth/citizen-scope';
import { PrismaService } from '../../common/database/prisma.service';
import { TenantsService } from '../tenants/tenants.service';

import { STUB_GATEWAY_DEBIT_ACCOUNT_CODE } from './payment-financial.constants';
import {
  buildReceiptDisplayNumber,
  receiptToCitizenDto,
  stubGatewayPaymentCaptureRef,
  verificationTokenFresh,
} from './receipt-mapping';

import type {
  LedgerSettlementDto,
  PaymentMethod,
  PaymentResponse,
  PaymentStatus,
  ReceiptCitizenDto,
} from './dto';
import type {
  CreatePendingPaymentInput,
  ExistingIdempotencyRecord,
  PaymentStore,
  SettlementLedgerContext,
} from './payment-store';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Payment as PrismaPayment, Receipt as PrismaReceipt } from '../../generated/prisma';
import type { FeeLineCode } from '../admin-tenant/admin-tenant-config.contracts';
import type { ApplicationReadScope } from '../applications/dto';

function mapPersistedReceipt(receiptRow: PrismaReceipt): ReceiptCitizenDto {
  return receiptToCitizenDto({
    id: receiptRow.id,
    receipt_number: receiptRow.receiptNumber,
    payment_id: receiptRow.paymentId,
    application_id: receiptRow.applicationId,
    booking_reservation_id: receiptRow.bookingReservationId,
    service_code: receiptRow.serviceCode,
    revenue_head_code: receiptRow.revenueHeadCode,
    amount_paise: receiptRow.amountPaise,
    issued_at: receiptRow.issuedAt,
    verification_token: receiptRow.verificationToken,
  });
}

/**
 * Postgres-backed store for the Phase 3.1A+ payment tables, including Sprint 3.2 ledger artefacts.
 *
 * Activated when PAYMENT_STORE_PROVIDER=postgres applications are persisted.
 */
@Injectable()
export class PostgresPaymentStore implements PaymentStore {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    private readonly tenants: TenantsService,
  ) {}

  async findIdempotencyRecord(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
    idempotencyTenantId?: string,
  ): Promise<ExistingIdempotencyRecord | null> {
    const tenantId = idempotencyTenantId ?? principal.tenantId;
    const record = await this.db.paymentIdempotencyKey.findUnique({
      where: {
        tenantId_citizenSubject_idempotencyKey: {
          tenantId,
          citizenSubject: principal.subject,
          idempotencyKey,
        },
      },
      select: {
        requestFingerprint: true,
        paymentId: true,
      },
    });

    return record
      ? {
          fingerprint: record.requestFingerprint,
          paymentId: record.paymentId,
        }
      : null;
  }

  async findActivePaymentByApplication(
    applicationId: string,
    feeCode?: FeeLineCode,
  ): Promise<PaymentResponse | null> {
    const payment = await this.db.payment.findFirst({
      where: {
        applicationId,
        status: 'requires_action',
        ...(feeCode ? { feeCode } : {}),
      },
    });
    return payment ? this.toPaymentResponse(payment) : null;
  }

  async findActivePaymentByBookingReservation(
    bookingReservationId: string,
  ): Promise<PaymentResponse | null> {
    const payment = await this.db.payment.findFirst({
      where: {
        bookingReservationId,
        status: 'requires_action',
      },
    });
    return payment ? this.toPaymentResponse(payment) : null;
  }

  async createPendingPayment(input: CreatePendingPaymentInput): Promise<PaymentResponse> {
    const payment = await this.db.$transaction(async (tx) => {
      if (!input.applicationId && !input.bookingReservationId) {
        throw new BadRequestException('Payment must target an application or booking hold');
      }
      const created = await tx.payment.create({
        data: {
          id: input.id,
          tenantId: input.tenantId,
          citizenSubject: input.citizenSubject,
          applicationId: input.applicationId ?? null,
          bookingReservationId: input.bookingReservationId ?? null,
          feeCode: input.feeCode,
          amountPaise: input.amountPaise,
          currency: 'INR',
          method: input.method,
          status: 'requires_action',
          gateway: input.gateway,
          gatewayOrderId: input.gatewayOrderId,
        },
      });

      await tx.paymentIdempotencyKey.create({
        data: {
          tenantId: input.tenantId,
          citizenSubject: input.citizenSubject,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          paymentId: created.id,
          expiresAt: input.expiresAt,
        },
      });

      return created;
    });

    return this.toPaymentResponse(payment);
  }

  async listByPrincipal(
    principal: AuthenticatedPrincipal,
    readScope?: ApplicationReadScope,
  ): Promise<PaymentResponse[]> {
    const catalogue = await this.tenants.list();
    const scopedCode = readScope?.municipalityTenantCode?.trim();
    const where: { citizenSubject: string; tenantId?: string } = {
      citizenSubject: principal.subject,
    };

    if (principalIsCitizenPortal(principal) && isCitizenSelfServicePrincipal(principal)) {
      if (scopedCode) {
        const tid = resolveMunicipalityTenantIdFromScopeCode(scopedCode, catalogue);
        if (!tid) {
          throw new BadRequestException('Invalid tenant scope');
        }
        where.tenantId = tid;
      }
    } else {
      where.tenantId = principal.tenantId;
    }

    const payments = await this.db.payment.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });
    return payments.map((row) => this.toPaymentResponse(row));
  }

  async findByIdForPrincipal(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    readScope?: ApplicationReadScope,
  ): Promise<PaymentResponse | null> {
    const payment = await this.db.payment.findUnique({
      where: {
        id: paymentId,
      },
    });
    if (!payment) {
      return null;
    }
    const catalogue = await this.tenants.list();
    const dto = this.toPaymentResponse(payment);
    if (
      !citizenHubRowAccessibleByTenant(
        principal,
        { tenant_id: dto.tenant_id, citizen_subject: dto.citizen_subject },
        readScope,
        catalogue,
      )
    ) {
      return null;
    }
    return dto;
  }

  async settleStubLedger(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    gatewayOrderId: string,
    ctx: SettlementLedgerContext,
  ): Promise<LedgerSettlementDto> {
    const catalogue = await this.tenants.list();
    const result = await this.db.$transaction(async (tx) => {
      const paymentOwned = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (
        !paymentOwned ||
        !citizenHubRowAccessibleByTenant(
          principal,
          {
            tenant_id: paymentOwned.tenantId,
            citizen_subject: paymentOwned.citizenSubject,
          },
          undefined,
          catalogue,
        )
      ) {
        throw new NotFoundException('Payment not found');
      }

      if (paymentOwned.gatewayOrderId !== gatewayOrderId) {
        throw new NotFoundException('Payment not found');
      }

      if (paymentOwned.status !== 'requires_action') {
        throw new ConflictException('Payment is not awaiting deterministic completion');
      }

      const captureRef = stubGatewayPaymentCaptureRef(paymentOwned.id);

      const tenantMeta = await tx.tenant.findUnique({
        where: { id: paymentOwned.tenantId },
        select: { code: true },
      });

      const tenantSlug = tenantMeta?.code.trim() ?? 'TENANT';
      const receiptNumber = buildReceiptDisplayNumber(tenantSlug);
      const verificationToken = verificationTokenFresh();

      const receiptCreated = await tx.receipt.create({
        data: {
          tenantId: paymentOwned.tenantId,
          paymentId: paymentOwned.id,
          receiptNumber,
          verificationToken,
          revenueHeadCode: ctx.revenueHeadCode,
          accountingCode: ctx.accountingCode,
          applicationId: paymentOwned.applicationId,
          bookingReservationId: paymentOwned.bookingReservationId,
          leaseInvoiceId: paymentOwned.leaseInvoiceId,
          serviceCode: ctx.serviceCode,
          amountPaise: paymentOwned.amountPaise,
          gateway: paymentOwned.gateway,
          gatewayOrderId: paymentOwned.gatewayOrderId,
          gatewayPaymentRef: captureRef,
        },
      });

      await tx.glPosting.create({
        data: {
          tenantId: paymentOwned.tenantId,
          paymentId: paymentOwned.id,
          receiptId: receiptCreated.id,
          revenueHeadCode: ctx.revenueHeadCode,
          debitAccountCode: STUB_GATEWAY_DEBIT_ACCOUNT_CODE,
          creditAccountCode: ctx.accountingCode,
          amountPaise: paymentOwned.amountPaise,
          settlementReference: paymentOwned.gatewayOrderId,
          gateway: paymentOwned.gateway,
        },
      });

      const settledPayment = await tx.payment.update({
        where: { id: paymentOwned.id },
        data: {
          status: 'settled',
          gatewayPaymentId: captureRef,
          settledAt: new Date(),
        },
      });

      if (paymentOwned.bookingReservationId) {
        const reservation = await tx.bookingReservation.findUnique({
          where: { id: paymentOwned.bookingReservationId },
          select: { depositId: true },
        });
        if (reservation?.depositId) {
          await tx.deposit.update({
            where: { id: reservation.depositId },
            data: { capturePaymentId: paymentOwned.id },
          });
        }
      }

      return {
        payment: settledPayment,
        receipt: receiptCreated,
      };
    });

    return {
      payment: this.toPaymentResponse(result.payment),
      receipt: mapPersistedReceipt(result.receipt),
    };
  }

  async findReceiptForPayment(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    readScope?: ApplicationReadScope,
  ): Promise<ReceiptCitizenDto | null> {
    const paymentSnapshot = await this.findByIdForPrincipal(principal, paymentId, readScope);
    if (!paymentSnapshot || paymentSnapshot.status !== 'settled') {
      return null;
    }

    const receipt = await this.db.receipt.findFirst({
      where: {
        paymentId,
        tenantId: paymentSnapshot.tenant_id,
      },
    });

    if (!receipt) {
      return null;
    }

    return mapPersistedReceipt(receipt);
  }

  private toPaymentResponse(row: PrismaPayment): PaymentResponse {
    return {
      id: row.id,
      tenant_id: row.tenantId,
      citizen_subject: row.citizenSubject,
      application_id: row.applicationId,
      booking_reservation_id: row.bookingReservationId,
      lease_invoice_id: row.leaseInvoiceId,
      fee_code: row.feeCode as PaymentResponse['fee_code'],
      amount_paise: row.amountPaise,
      currency: 'INR',
      method: row.method as PaymentMethod,
      status: row.status as PaymentStatus,
      gateway: 'stub',
      gateway_order_id: row.gatewayOrderId,
      gateway_payment_id: row.gatewayPaymentId,
      settled_at: row.settledAt ? row.settledAt.toISOString() : null,
      redirect_url: `/payments/stub/complete?payment_id=${row.id}&order_id=${row.gatewayOrderId}`,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
