import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { ServicesService } from '../services/services.service';

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
import type { ApplicationReadScope } from '../applications/dto';
import type { EffectiveServiceSummary } from '../services/service-catalogue.seed';

function csvEscape(value: string | number): string {
  const asString = String(value);
  if (/[",\n\r]/.test(asString)) {
    return `"${asString.replace(/"/g, '""')}"`;
  }
  return asString;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly services: ServicesService,
    @Inject('IPaymentGateway')
    private readonly gateway: IPaymentGateway,
    @Inject(PAYMENT_STORE)
    private readonly store: PaymentStore,
    private readonly prisma: PrismaService,
  ) {}

  async initiate(
    principal: AuthenticatedPrincipal,
    dto: InitiatePaymentDto,
    idempotencyKey: string | undefined,
  ): Promise<PaymentResponse> {
    const normalizedIdempotencyKey = idempotencyKey?.trim();
    if (!normalizedIdempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const application = await this.applications.getOwnedApplication(principal, dto.application_id);
    if (application.payment_status === 'not_required') {
      throw new BadRequestException('Application does not require payment');
    }
    if (application.payment_status === 'paid') {
      throw new BadRequestException('Application is already paid');
    }

    const businessTenantCode = application.tenant_code?.trim();
    if (!businessTenantCode) {
      throw new BadRequestException('Application is missing tenant_code');
    }
    const businessTenantId = application.tenant_id;

    const service = await this.services.getTenantService(
      businessTenantCode,
      application.service_code,
    );
    const expectedAmountPaise = this.getFixedAmountPaise(service);
    if (dto.amount_paise !== expectedAmountPaise) {
      throw new BadRequestException('Payment amount does not match the application fee');
    }

    const fingerprint = this.fingerprint(dto);
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

    const activePayment = await this.store.findActivePaymentByApplication(application.id);
    if (activePayment) {
      throw new ConflictException('Application already has an active payment attempt');
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
      amountPaise: dto.amount_paise,
      method: dto.method,
      gateway: gatewayResult.gateway,
      gatewayOrderId: gatewayResult.gatewayOrderId,
      redirectUrl: gatewayResult.redirectUrl,
      idempotencyKey: normalizedIdempotencyKey,
      requestFingerprint: fingerprint,
      expiresAt: this.nextDay(),
    });
    await this.applications.recordPaymentStatus(principal, application.id, 'pending');

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

    await this.applications.recordPaymentStatus(principal, application.id, 'paid');

    return ledger;
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
          csvEscape(row.payment.applicationId),
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

  private getFixedAmountPaise(service: EffectiveServiceSummary): number {
    if (service.fee_type !== 'fixed') {
      throw new BadRequestException(
        'Only fixed-fee application payments are enabled in Sprint 3.1A',
      );
    }

    const amountPaise = service.fee_config.amount_paise;
    if (typeof amountPaise !== 'number' || !Number.isInteger(amountPaise) || amountPaise <= 0) {
      throw new BadRequestException('Service fee is not payable through Phase 3.1A');
    }
    return amountPaise;
  }

  private fingerprint(dto: InitiatePaymentDto): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          application_id: dto.application_id,
          amount_paise: dto.amount_paise,
          method: dto.method,
        }),
      )
      .digest('hex');
  }

  private nextDay(): Date {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
}
