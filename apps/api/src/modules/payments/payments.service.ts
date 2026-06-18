import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { tryAdvancePostApprovalOnPaymentPaid } from '../admin-tenant/post-approval-workflow.util';
import { ApplicationsService } from '../applications/applications.service';
import { LeaseReceiptsService } from '../lease-receipts/lease-receipts.service';
import { ServicesService } from '../services/services.service';
import { PostApprovalExecutionService } from '../work-orders/post-approval-execution.service';

import {
  buildInitialFeeSettlement,
  coerceFeeSettlementSnapshot,
  feeLineAllowsCitizenInitiate,
  feeLineAmountPaise,
  parseFeeLineCode,
} from './fee-settlement.util';
import { indianBusinessDayUtcBounds } from './finance-date';
import { PAYMENT_STORE } from './payment-store';
import { RECONCILIATION_EXPORT_ROLES } from './payments-finance-roles';
import { StubPaymentGateway } from './stub-payment.gateway';

import type {
  InitiatePaymentDto,
  LedgerSettlementDto,
  PaymentResponse,
  ReceiptCitizenDto,
  StubCompletePaymentDto,
} from './dto';
import type { IPaymentGateway } from './payment-gateway';
import type { PaymentStore, SettlementLedgerContext } from './payment-store';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { FeeLineCode } from '../admin-tenant/admin-tenant-config.contracts';
import type { ApplicationReadScope } from '../applications/dto';

function csvEscape(value: string | number): string {
  const asString = String(value);
  if (/[",\n\r]/.test(asString)) {
    return `"${asString.replace(/"/g, '""')}"`;
  }
  return asString;
}

const RECEIPT_VERIFY_PUBLIC_BASE =
  process.env.RECEIPT_VERIFY_PUBLIC_BASE?.trim().replace(/\/+$/, '') ||
  'https://enagar.example.gov';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly services: ServicesService,
    private readonly postApprovalExecution: PostApprovalExecutionService,
    @Inject('IPaymentGateway')
    private readonly gateway: IPaymentGateway,
    @Inject(PAYMENT_STORE)
    private readonly store: PaymentStore,
    private readonly prisma: PrismaService,
    @Optional() private readonly leaseReceipts?: LeaseReceiptsService,
  ) {
    this.logger = new Logger(PaymentsService.name);
  }

  private readonly logger: Logger;

  async initiate(
    principal: AuthenticatedPrincipal,
    dto: InitiatePaymentDto,
    idempotencyKey: string | undefined,
    readScope?: ApplicationReadScope,
  ): Promise<PaymentResponse> {
    const normalizedIdempotencyKey = idempotencyKey?.trim();
    if (!normalizedIdempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const application = await this.applications.getOwnedApplication(principal, dto.application_id);
    const feeCode = parseFeeLineCode(dto.fee_code, 'application');

    const businessTenantCode = application.tenant_code?.trim();
    if (!businessTenantCode) {
      throw new BadRequestException('Application is missing tenant_code');
    }
    const businessTenantId = application.tenant_id;

    const paymentConfig = await this.services.resolvePaymentConfig(
      businessTenantCode,
      application.service_code,
    );

    let expectedAmountPaise: number;
    try {
      expectedAmountPaise = feeLineAmountPaise(paymentConfig, feeCode);
    } catch {
      throw new BadRequestException(
        'Only fixed-fee application payments are enabled in Sprint 3.1A',
      );
    }
    if (dto.amount_paise !== expectedAmountPaise) {
      throw new BadRequestException('Payment amount does not match the application fee');
    }

    const fingerprint = this.fingerprint(dto, feeCode);
    const existingIdempotencyRecord = await this.store.findIdempotencyRecord(
      principal,
      normalizedIdempotencyKey,
      businessTenantId,
    );
    if (existingIdempotencyRecord) {
      if (existingIdempotencyRecord.fingerprint !== fingerprint) {
        throw new ConflictException('Idempotency-Key was already used for a different payment');
      }
      return this.getOwnedPayment(principal, existingIdempotencyRecord.paymentId);
    }

    const activePayment = await this.store.findActivePaymentByApplication(application.id, feeCode);
    if (activePayment) {
      const existing = await this.store.findByIdForPrincipal(
        principal,
        activePayment.id,
        readScope,
      );
      if (existing && existing.application_id === application.id) {
        return existing;
      }
      throw new ConflictException(
        'Application already has an active payment attempt for this fee line',
      );
    }

    const settlement =
      Object.keys(coerceFeeSettlementSnapshot(application.fee_settlement)).length > 0
        ? coerceFeeSettlementSnapshot(application.fee_settlement)
        : buildInitialFeeSettlement(paymentConfig);
    const feeLine = settlement[feeCode];
    if (!feeLineAllowsCitizenInitiate(paymentConfig.payment_schedule, feeCode, feeLine)) {
      throw new BadRequestException(`Payment line "${feeCode}" is not open for citizen initiation`);
    }
    if (feeLine?.status === 'paid') {
      throw new BadRequestException('This fee line is already paid');
    }

    const paymentId = randomUUID();
    const gatewayResult = await this.gateway.initiate({
      paymentId,
      tenantId: businessTenantId,
      applicationId: application.id,
      amountPaise: dto.amount_paise,
      currency: 'INR',
      method: dto.method,
    });
    const payment = await this.store.createPendingPayment({
      id: paymentId,
      tenantId: businessTenantId,
      citizenSubject: principal.subject,
      applicationId: application.id,
      feeCode,
      amountPaise: dto.amount_paise,
      method: dto.method,
      gateway: gatewayResult.gateway,
      gatewayOrderId: gatewayResult.gatewayOrderId,
      redirectUrl: gatewayResult.redirectUrl,
      idempotencyKey: normalizedIdempotencyKey,
      requestFingerprint: fingerprint,
      expiresAt: this.nextDay(),
    });
    await this.applications.updateFeeLineSettlement(principal, application.id, feeCode, {
      status: 'pending',
      payment_id: payment.id,
      amount_paise: dto.amount_paise,
    });

    return payment;
  }

  /**
   * Sprint 3.2 deterministic PSP capture surrogate — only honoured for {@link StubPaymentGateway}
   * and blocked in production unless explicitly enabled (prevents counterfeit settlements).
   */
  async completeStubPayment(
    principal: AuthenticatedPrincipal,
    dto: StubCompletePaymentDto,
  ): Promise<LedgerSettlementDto> {
    const expectedStubOrder = StubPaymentGateway.expectedOrderIdForPayment(dto.payment_id).trim();

    const payment = await this.getOwnedPayment(principal, dto.payment_id);

    if (payment.booking_reservation_id) {
      return this.completeBookingStubPayment(principal, payment, dto);
    }
    if (payment.lease_invoice_id) {
      return this.completeLeaseStubPayment(principal, payment, dto);
    }
    if (payment.ev_session_id) {
      return this.completeEvChargingStubPayment(principal, payment, dto);
    }
    if (!payment.application_id) {
      throw new BadRequestException('Payment is not linked to an application or booking hold');
    }

    if (this.gateway.id !== 'stub') {
      throw new BadRequestException('Only the stub gateway supports synchronous completion');
    }

    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_STUB_PAYMENT_SETTLEMENT !== 'true'
    ) {
      throw new ForbiddenException('Stub payment settlement is disabled in production');
    }

    const normalizedOrder = dto.gateway_order_id.trim();
    if (
      normalizedOrder !== expectedStubOrder ||
      normalizedOrder !== payment.gateway_order_id.trim()
    ) {
      throw new BadRequestException('gateway_order_id does not match the stub redirect contract');
    }

    if (payment.status !== 'requires_action') {
      throw new ConflictException('Payment is not awaiting deterministic completion');
    }

    const application = await this.applications.getOwnedApplication(
      principal,
      payment.application_id,
    );

    const applicationTenantCode = application.tenant_code?.trim();
    if (!applicationTenantCode) {
      throw new BadRequestException('Application is missing tenant_code');
    }
    const service = await this.services.getTenantService(
      applicationTenantCode,
      application.service_code,
    );

    const ledgerAllocation = this.services.resolveLedgerCodesForService(service);
    const ctx: SettlementLedgerContext = {
      serviceCode: service.code,
      revenueHeadCode: ledgerAllocation.revenue_head_code,
      accountingCode: ledgerAllocation.accounting_code,
    };

    const ledger = await this.store.settleStubLedger(
      principal,
      dto.payment_id,
      normalizedOrder,
      ctx,
    );

    const feeCode = parseFeeLineCode(payment.fee_code, 'application');
    await this.applications.updateFeeLineSettlement(principal, application.id, feeCode, {
      status: 'paid',
      payment_id: payment.id,
      amount_paise: payment.amount_paise,
    });

    await tryAdvancePostApprovalOnPaymentPaid(
      this.prisma,
      application.tenant_id,
      application.id,
      this.postApprovalExecution,
    );

    return ledger;
  }

  /** Sprint 8.1C — stub capture for hall-booking security deposit (+ optional rent in one payment). */
  private async completeBookingStubPayment(
    principal: AuthenticatedPrincipal,
    payment: PaymentResponse,
    dto: StubCompletePaymentDto,
  ): Promise<LedgerSettlementDto> {
    if (this.gateway.id !== 'stub') {
      throw new BadRequestException('Only the stub gateway supports synchronous completion');
    }
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_STUB_PAYMENT_SETTLEMENT !== 'true'
    ) {
      throw new ForbiddenException('Stub payment settlement is disabled in production');
    }

    const expectedStubOrder = StubPaymentGateway.expectedOrderIdForPayment(dto.payment_id).trim();
    const normalizedOrder = dto.gateway_order_id.trim();
    if (
      normalizedOrder !== expectedStubOrder ||
      normalizedOrder !== payment.gateway_order_id.trim()
    ) {
      throw new BadRequestException('gateway_order_id does not match the stub redirect contract');
    }
    if (payment.status !== 'requires_action') {
      throw new ConflictException('Payment is not awaiting deterministic completion');
    }

    const reservation = await this.prisma.bookingReservation.findFirst({
      where: { id: payment.booking_reservation_id ?? '', tenantId: payment.tenant_id },
      select: { id: true, depositId: true, note: true },
    });
    if (!reservation) {
      throw new NotFoundException('Booking hold not found for this payment');
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: payment.tenant_id },
      select: { code: true },
    });
    const serviceCode = this.resolveBookingServiceCodeFromNote(reservation.note);
    const service = await this.services.getTenantService(tenant.code, serviceCode);
    const ledgerAllocation = this.services.resolveLedgerCodesForService(service);
    const ctx: SettlementLedgerContext = {
      serviceCode: service.code,
      revenueHeadCode: ledgerAllocation.revenue_head_code,
      accountingCode: ledgerAllocation.accounting_code,
    };

    return this.store.settleStubLedger(principal, dto.payment_id, normalizedOrder, ctx);
  }

  /** Sprint 8.2D — stub capture for EV charging session settlement. */
  private async completeEvChargingStubPayment(
    principal: AuthenticatedPrincipal,
    payment: PaymentResponse,
    dto: StubCompletePaymentDto,
  ): Promise<LedgerSettlementDto> {
    if (this.gateway.id !== 'stub') {
      throw new BadRequestException('Only the stub gateway supports synchronous completion');
    }
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_STUB_PAYMENT_SETTLEMENT !== 'true'
    ) {
      throw new ForbiddenException('Stub payment settlement is disabled in production');
    }

    const expectedStubOrder = StubPaymentGateway.expectedOrderIdForPayment(dto.payment_id).trim();
    const normalizedOrder = dto.gateway_order_id.trim();
    if (
      normalizedOrder !== expectedStubOrder ||
      normalizedOrder !== payment.gateway_order_id.trim()
    ) {
      throw new BadRequestException('gateway_order_id does not match the stub redirect contract');
    }
    if (payment.status !== 'requires_action') {
      throw new ConflictException('Payment is not awaiting deterministic completion');
    }

    const session = await this.prisma.evSession.findFirst({
      where: { id: payment.ev_session_id ?? '', tenantId: payment.tenant_id },
      select: { id: true, status: true },
    });
    if (!session) {
      throw new NotFoundException('EV session not found for this payment');
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: payment.tenant_id },
      select: { code: true },
    });
    const service = await this.services.getTenantService(tenant.code, 'ev-charging');
    const ledgerAllocation = this.services.resolveLedgerCodesForService(service);
    const ctx: SettlementLedgerContext = {
      serviceCode: service.code,
      revenueHeadCode: ledgerAllocation.revenue_head_code,
      accountingCode: ledgerAllocation.accounting_code,
    };

    return this.store.settleStubLedger(principal, dto.payment_id, normalizedOrder, ctx);
  }

  private resolveBookingServiceCodeFromNote(note: string | null): string {
    if (!note) {
      return 'community-hall';
    }
    try {
      const parsed = JSON.parse(note) as { service_code?: string; source?: string };
      if (parsed.source === 'smart_parking') {
        return 'smart-parking';
      }
      if (parsed.service_code?.trim()) {
        return parsed.service_code.trim();
      }
    } catch {
      return 'community-hall';
    }
    return 'community-hall';
  }

  /**
   * Sprint EN-18 — stub capture for a rent (lease-invoice) payment made from
   * the citizen portal. Mirrors `completeBookingStubPayment` but flips the
   * `LeaseInvoice` row to PAID and writes a RENT_LEASE receipt instead of a
   * booking hold receipt.
   */
  private async completeLeaseStubPayment(
    principal: AuthenticatedPrincipal,
    payment: PaymentResponse,
    dto: StubCompletePaymentDto,
  ): Promise<LedgerSettlementDto> {
    if (this.gateway.id !== 'stub') {
      throw new BadRequestException('Only the stub gateway supports synchronous completion');
    }
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_STUB_PAYMENT_SETTLEMENT !== 'true'
    ) {
      throw new ForbiddenException('Stub payment settlement is disabled in production');
    }

    const expectedStubOrder = StubPaymentGateway.expectedOrderIdForPayment(dto.payment_id).trim();
    const normalizedOrder = dto.gateway_order_id.trim();
    if (
      normalizedOrder !== expectedStubOrder ||
      normalizedOrder !== payment.gateway_order_id.trim()
    ) {
      throw new BadRequestException('gateway_order_id does not match the stub redirect contract');
    }
    if (payment.status !== 'requires_action') {
      throw new ConflictException('Payment is not awaiting deterministic completion');
    }

    const leaseInvoice = await this.prisma.leaseInvoice.findFirst({
      where: { id: payment.lease_invoice_id ?? '' },
    });
    if (!leaseInvoice) {
      throw new NotFoundException('Lease invoice not found for this payment');
    }
    if (leaseInvoice.status === 'PAID' || leaseInvoice.status === 'WAIVED') {
      throw new ConflictException(`Invoice is already ${leaseInvoice.status}`);
    }

    const ctx: SettlementLedgerContext = {
      serviceCode: 'lease-rent',
      revenueHeadCode: 'RENT_LEASE',
      accountingCode: 'RENT_LEASE_INCOME',
    };
    // `settleStubLedger` writes the Receipt row inside its own transaction
    // (so a failure rolls the GL postings and the payment status flip
    // back together) — it now also carries `leaseInvoiceId` from the
    // Payment to the new Receipt, so the receipts_target_check passes
    // for the lease-invoice-only path.
    const ledger = await this.store.settleStubLedger(
      principal,
      dto.payment_id,
      normalizedOrder,
      ctx,
    );

    // EN-19/EN-22: kick off the lease-receipt PDF generation in the
    // same transaction-flow as the Receipt row creation. Awaited because
    // the stub settlement is synchronous. The helper catches and logs
    // PDF-generation failures so a transient rendering error does not
    // roll back the lease-invoice flip below.
    await this.tryGenerateLeaseReceipt(leaseInvoice.tenantId, ledger.receipt.id);

    await this.prisma.leaseInvoice.update({
      where: { id: leaseInvoice.id },
      data: { status: 'PAID' },
    });

    this.logger.log(
      `[LEASE PAYMENT] Invoice ${leaseInvoice.invoiceNo} settled online via stub (payment=${payment.id})`,
    );
    return ledger;
  }

  /**
   * Department head desk transition effect — issues a citizen payment link via the stub gateway (ADR-0012 §9).
   */
  async issueDeskPaymentLink(
    tenantId: string,
    applicationId: string,
    feeCodeInput?: FeeLineCode,
  ): Promise<PaymentResponse> {
    const feeCode = feeCodeInput ?? 'approval';
    const row = await this.prisma.application.findFirst({
      where: { id: applicationId, tenantId },
      select: {
        id: true,
        tenantId: true,
        serviceCode: true,
        paymentStatus: true,
        runtimeSnapshot: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Application not found');
    }
    const snapshot =
      row.runtimeSnapshot &&
      typeof row.runtimeSnapshot === 'object' &&
      !Array.isArray(row.runtimeSnapshot)
        ? (row.runtimeSnapshot as Record<string, unknown>)
        : {};
    const citizenSubject =
      typeof snapshot.citizen_subject === 'string' ? snapshot.citizen_subject.trim() : '';
    if (!citizenSubject) {
      throw new BadRequestException('Application is missing citizen_subject in runtime snapshot');
    }
    const tenantCode = typeof snapshot.tenant_code === 'string' ? snapshot.tenant_code.trim() : '';
    if (!tenantCode) {
      throw new BadRequestException('Application is missing tenant_code');
    }

    const paymentConfig = await this.services.resolvePaymentConfig(tenantCode, row.serviceCode);
    const settlement = coerceFeeSettlementSnapshot(snapshot.fee_settlement);
    const feeLine = settlement[feeCode];
    if (!feeLine) {
      throw new BadRequestException(`Fee line "${feeCode}" is not configured for this service`);
    }
    if (feeLine.status === 'paid') {
      throw new BadRequestException('This fee line is already paid');
    }

    let amountPaise: number;
    try {
      amountPaise = feeLineAmountPaise(paymentConfig, feeCode);
    } catch {
      throw new BadRequestException('Only fixed-fee desk payment links are enabled in Phase 11');
    }

    const existing = await this.store.findActivePaymentByApplication(applicationId, feeCode);
    if (existing) {
      return existing;
    }

    const paymentId = randomUUID();
    const gatewayResult = await this.gateway.initiate({
      paymentId,
      tenantId,
      applicationId,
      amountPaise,
      currency: 'INR',
      method: 'upi',
    });
    const payment = await this.store.createPendingPayment({
      id: paymentId,
      tenantId,
      citizenSubject,
      applicationId,
      feeCode,
      amountPaise,
      method: 'upi',
      gateway: gatewayResult.gateway,
      gatewayOrderId: gatewayResult.gatewayOrderId,
      redirectUrl: gatewayResult.redirectUrl,
      idempotencyKey: `desk-payment:${applicationId}:${feeCode}`,
      requestFingerprint: `desk:${applicationId}:${feeCode}:${amountPaise}`,
      expiresAt: this.nextDay(),
    });

    await this.applications.updateFeeLineSettlementForTenant(
      tenantId,
      applicationId,
      feeCode,
      {
        status: 'pending',
        payment_id: payment.id,
        amount_paise: amountPaise,
      },
      {
        payment_redirect_url: payment.redirect_url,
        active_payment_id: payment.id,
      },
    );

    return payment;
  }

  async receiptForOwnedPayment(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    readScope?: ApplicationReadScope,
  ): Promise<ReceiptCitizenDto> {
    const receipt = await this.store.findReceiptForPayment(principal, paymentId, readScope);
    if (!receipt) {
      throw new NotFoundException('Receipt not available for this payment');
    }

    return receipt;
  }

  /**
   * Daily finance reconciliation groundwork — tenant scoped, RBAC guarded.
   *
   * Rows are keyed by Kolkata business date on `posted_at` (issuer timezone per ADR roadmap).
   */
  async exportReconciliationCsv(
    principal: AuthenticatedPrincipal,
    businessDateIso: string,
  ): Promise<string> {
    this.assertReconciliationAuthorized(principal);

    let bounds: { startUtc: Date; endUtc: Date };
    try {
      bounds = indianBusinessDayUtcBounds(businessDateIso);
    } catch {
      throw new BadRequestException('business_date must be YYYY-MM-DD');
    }

    const rows = await this.prisma.glPosting.findMany({
      where: {
        tenantId: principal.tenantId,
        postedAt: {
          gte: bounds.startUtc,
          lte: bounds.endUtc,
        },
      },
      orderBy: {
        postedAt: 'asc',
      },
      include: {
        receipt: true,
        payment: {
          select: {
            id: true,
            applicationId: true,
            gatewayOrderId: true,
            gatewayPaymentId: true,
          },
        },
      },
    });

    const header = [
      'tenant_id',
      'business_date_ist',
      'gl_posting_id',
      'receipt_number',
      'payment_id',
      'application_id',
      'service_code',
      'revenue_head_code',
      'amount_paise',
      'debit_account_code',
      'credit_account_code',
      'settlement_reference',
      'gateway',
      'posted_at_utc',
    ];

    const lines = [
      header.join(','),
      ...rows.map((row) =>
        [
          csvEscape(row.tenantId),
          csvEscape(businessDateIso),
          csvEscape(row.id),
          csvEscape(row.receipt.receiptNumber),
          csvEscape(row.paymentId),
          csvEscape(row.payment.applicationId ?? ''),
          csvEscape(row.receipt.serviceCode),
          csvEscape(row.revenueHeadCode),
          csvEscape(row.amountPaise),
          csvEscape(row.debitAccountCode),
          csvEscape(row.creditAccountCode),
          csvEscape(row.settlementReference),
          csvEscape(row.gateway),
          csvEscape(row.postedAt.toISOString()),
        ].join(','),
      ),
    ];

    return `${lines.join('\n')}\n`;
  }

  list(
    principal: AuthenticatedPrincipal,
    readScope?: ApplicationReadScope,
  ): Promise<PaymentResponse[]> {
    return this.store.listByPrincipal(principal, readScope);
  }

  getById(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    readScope?: ApplicationReadScope,
  ): Promise<PaymentResponse> {
    return this.getOwnedPayment(principal, paymentId, readScope);
  }

  private assertReconciliationAuthorized(principal: AuthenticatedPrincipal): void {
    const privileged = principal.roles.some((role) => RECONCILIATION_EXPORT_ROLES.has(role));
    const testBypass =
      process.env.NODE_ENV === 'test' && process.env.ALLOW_FINANCE_EXPORT_FOR_TESTS === 'true';

    if (!privileged && !testBypass) {
      throw new ForbiddenException(
        'Finance reconciliation exports require tenant/state admin privileges',
      );
    }
  }

  private async getOwnedPayment(
    principal: AuthenticatedPrincipal,
    paymentId: string,
    readScope?: ApplicationReadScope,
  ): Promise<PaymentResponse> {
    const payment = await this.store.findByIdForPrincipal(principal, paymentId, readScope);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  private fingerprint(dto: InitiatePaymentDto, feeCode: FeeLineCode): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          application_id: dto.application_id,
          fee_code: feeCode,
          amount_paise: dto.amount_paise,
          method: dto.method,
        }),
      )
      .digest('hex');
  }

  private nextDay(): Date {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  /**
   * EN-19/EN-22 — generate the lease-receipt PDF for a freshly-minted
   * Receipt row. No-op when the LeaseReceiptsModule is not in the DI
   * graph (unit tests that don't wire it). Failures are logged, not
   * thrown: the invoice flip below must still happen so the tenant
   * sees a settled invoice even if PDF generation is misconfigured.
   */
  private async tryGenerateLeaseReceipt(tenantId: string, receiptId: string): Promise<void> {
    if (!this.leaseReceipts) return;
    try {
      await this.leaseReceipts.generateForReceipt(tenantId, receiptId, RECEIPT_VERIFY_PUBLIC_BASE);
    } catch (err) {
      this.logger.error(
        `[LEASE RECEIPT] Failed to generate PDF for receipt=${receiptId} tenant=${tenantId}: ${(err as Error).message}`,
      );
    }
  }
}
