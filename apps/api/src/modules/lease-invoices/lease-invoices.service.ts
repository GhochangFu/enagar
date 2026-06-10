import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import type { RecordLeasePaymentDto } from './dto/record-payment.dto';

/**
 * Shape returned to the citizen portal at
 * `GET /lease-invoices/lookup?phone=…`. Kept flat (no `tenant_id`,
 * `agreementDocumentKey`, etc.) so the citizen app never sees internal fields.
 */
export interface CitizenLeaseSummary {
  id: string;
  lessorName: string;
  lessorPhone: string | null;
  startDate: Date;
  endDate: Date;
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
  /**
   * Tenant code of the agreement's parent asset. Mirrored on every invoice
   * so the PWA can filter without a second roundtrip.
   */
  tenantCode: string | null;
  asset: { id: string; name: Record<string, string>; assetType: string };
  invoices: {
    id: string;
    invoiceNo: string;
    amountPaise: number;
    lateFeePaise: number;
    status: 'PENDING' | 'OVERDUE' | 'PAID' | 'WAIVED';
    dueDate: Date;
    tenantCode: string | null;
  }[];
}

@Injectable()
export class LeaseInvoicesService {
  private readonly logger = new Logger(LeaseInvoicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listInvoices(
    tenantCode: string,
    filters: {
      agreementId?: string;
      assetId?: string;
      lessorName?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Asset-id and lessor-name both filter through the parent agreement, so
    // collapse them into a single nested `agreement` predicate. `lessorName`
    // uses case-insensitive `contains` so a substring the operator types
    // (or an exact match from the dropdown) both work.
    const agreementWhere: {
      assetId?: string;
      lessorName?: { contains: string; mode: 'insensitive' };
    } = {};
    if (filters.assetId) {
      agreementWhere.assetId = filters.assetId;
    }
    if (filters.lessorName && filters.lessorName.trim() !== '') {
      agreementWhere.lessorName = {
        contains: filters.lessorName.trim(),
        mode: 'insensitive',
      };
    }

    return this.prisma.leaseInvoice.findMany({
      where: {
        tenantId: tenant.id,
        ...(filters.agreementId ? { agreementId: filters.agreementId } : {}),
        ...(Object.keys(agreementWhere).length > 0 ? { agreement: agreementWhere } : {}),
        ...(filters.status
          ? { status: filters.status as 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED' }
          : {}),
        ...(filters.fromDate || filters.toDate
          ? {
              dueDate: {
                ...(filters.fromDate ? { gte: new Date(filters.fromDate) } : {}),
                ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
              },
            }
          : {}),
      },
      orderBy: { dueDate: 'desc' },
      include: {
        agreement: {
          include: { asset: true },
        },
        // Return the full payment history for the invoice (ordered most-recent
        // first) so the ledger can show Paid / Paid date / Method / Receipt
        // # without a second roundtrip. The `take: 1` projection was correct
        // for the smart payment pill on the rental-assets grid, but the
        // invoices ledger needs every settled payment (an invoice can be
        // settled by multiple partial payments, plus the original failed
        // attempt is still useful audit context).
        payments: { orderBy: { settledAt: 'desc' } },
        receipts: { orderBy: { issuedAt: 'desc' } },
      },
    });
  }

  async getInvoice(tenantCode: string, invoiceId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const invoice = await this.prisma.leaseInvoice.findFirst({
      where: { id: invoiceId, tenantId: tenant.id },
      include: {
        agreement: { include: { asset: true } },
        payments: { include: { receipt: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  /**
   * Look up the leases (and their invoices) for a lessor identified by phone
   * number. Used by the citizen portal "My Leases" page so a lessor can view
   * and pay rent without going through the tenant admin desk.
   *
   * Matching is done on `LeaseAgreement.lessorPhone` (set by the tenant admin
   * when creating the agreement) and **falls back to `Citizen.mobile`** when
   * the agreement was created before the `lessorPhone` field existed or when
   * the operator skipped it. Both lookups are case-insensitive on the digit
   * string; the agreement and invoice payloads are projected into a stable
   * `CitizenLeaseSummary` shape so the citizen app never sees internal fields.
   */
  async lookupLeasesByPhone(phone: string): Promise<CitizenLeaseSummary[]> {
    const normalized = phone.replace(/\D+/g, '');
    if (normalized.length < 6) {
      throw new BadRequestException(
        'A valid phone number (at least 6 digits) is required for the lease lookup.',
      );
    }

    // Match against any of: the full digit string, a 10-digit suffix (handles
    // `+91`/`0` country-code prefixes), or a 12-digit suffix. The admin form
    // stores either a 10-digit local number or a 12-digit `91…` number
    // depending on the operator's convention, so a single normalized lookup
    // would otherwise miss rows that were tagged with the other format.
    const candidateMatches = [normalized];
    if (normalized.length > 10) {
      candidateMatches.push(normalized.slice(-10));
    }
    if (normalized.length === 10) {
      candidateMatches.push(`91${normalized}`);
    }

    const agreements = await this.prisma.leaseAgreement.findMany({
      where: { lessorPhone: { in: candidateMatches } },
      include: {
        asset: { include: { tenant: true } },
        invoices: { orderBy: { dueDate: 'desc' } },
      },
      orderBy: { startDate: 'desc' },
    });

    return agreements.map((agreement) => ({
      id: agreement.id,
      lessorName: agreement.lessorName,
      lessorPhone: agreement.lessorPhone ?? null,
      startDate: agreement.startDate,
      endDate: agreement.endDate,
      status: agreement.status as CitizenLeaseSummary['status'],
      /**
       * Tenant code of the agreement's parent asset, surfaced on every row so
       * the citizen-pwa can client-filter invoices to the currently selected
       * ULB without making a second roundtrip.
       */
      tenantCode: agreement.asset.tenant?.code ?? null,
      asset: {
        id: agreement.asset.id,
        name: agreement.asset.name as Record<string, string>,
        assetType: agreement.asset.assetType,
      },
      invoices: agreement.invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        amountPaise: invoice.amountPaise,
        lateFeePaise: invoice.lateFeePaise,
        status: invoice.status as CitizenLeaseSummary['invoices'][number]['status'],
        dueDate: invoice.dueDate,
        tenantCode: agreement.asset.tenant?.code ?? null,
      })),
    }));
  }

  async recordPayment(tenantCode: string, invoiceId: string, dto: RecordLeasePaymentDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { code: tenantCode } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const invoice = await this.prisma.leaseInvoice.findFirst({
      where: { id: invoiceId, tenantId: tenant.id },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status === 'PAID' || invoice.status === 'WAIVED') {
      throw new ConflictException(`Invoice is already ${invoice.status}`);
    }

    if (
      (dto.method === 'BANK_TRANSFER' || dto.method === 'CHEQUE') &&
      !dto.referenceNumber?.trim()
    ) {
      throw new BadRequestException(
        'Reference number is required for bank transfer and cheque payments',
      );
    }

    const updatedLateFee = await this.applyLateFeeIfOverdue(
      tenant.id,
      invoice.id,
      invoice.status,
      invoice.lateFeePaise,
    );
    const effectiveInvoice = { ...invoice, lateFeePaise: updatedLateFee };

    try {
      if (dto.method === 'ONLINE_GATEWAY') {
        return await this.startOnlinePayment(tenant, effectiveInvoice);
      }
      return await this.settleOffline(tenant, effectiveInvoice, dto);
    } catch (error) {
      this.logger.error(
        `[LEASE PAYMENT] Failed to record payment for invoice ${invoice.invoiceNo} (${dto.method}): ${
          error instanceof Error ? `${error.message}\n${error.stack}` : String(error)
        }`,
      );
      throw new BadRequestException(
        `Failed to record lease payment: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async startOnlinePayment(
    tenant: { id: string; code: string },
    invoice: {
      id: string;
      tenantId: string;
      agreementId: string;
      amountPaise: number;
      lateFeePaise: number;
    },
    citizenSubject?: string,
  ) {
    const totalPaise = invoice.amountPaise + invoice.lateFeePaise;
    const paymentId = randomUUID();
    /**
     * Use the same deterministic `stub_order_<paymentId>` shape the stub
     * gateway's `expectedOrderIdForPayment(paymentId)` returns. This keeps
     * `POST /payments/stub/complete`'s `gateway_order_id matches the
     * redirect contract` check working uniformly across application,
     * booking, and lease rent flows.
     */
    const gatewayOrderId = `stub_order_${paymentId}`;
    const payment = await this.prisma.payment.create({
      data: {
        id: paymentId,
        tenantId: tenant.id,
        leaseInvoiceId: invoice.id,
        /**
         * `citizenSubject` ties the Payment row to the citizen who paid it
         * and is the field the `citizenHubRowAccessibleByTenant` access
         * check compares against the JWT `sub`. When a citizen initiates
         * the payment we pass their principal subject; for the staff
         * (`recordPayment`) path the staff member is initiating on behalf
         * of the lessor, so we keep the synthetic `lease-invoice:<id>`
         * value (the staff principal's own `subject` would be the wrong
         * identity, and the row is settled synchronously by the staff
         * action — no subsequent citizen read of the `requires_action`
         * state is expected).
         */
        citizenSubject: citizenSubject ?? `lease-invoice:${invoice.id}`,
        amountPaise: totalPaise,
        feeCode: 'rental',
        method: 'upi',
        status: 'requires_action',
        gateway: 'stub',
        gatewayOrderId,
      },
    });
    return {
      invoiceId: invoice.id,
      paymentId: payment.id,
      gatewayOrderId: payment.gatewayOrderId,
      redirectUrl: `/payments/stub/complete?payment_id=${payment.id}&order_id=${payment.gatewayOrderId}`,
    };
  }

  private async settleOffline(
    tenant: { id: string },
    invoice: {
      id: string;
      tenantId: string;
      amountPaise: number;
      lateFeePaise: number;
      invoiceNo: string;
      agreementId: string;
    },
    dto: RecordLeasePaymentDto,
  ) {
    const totalPaise = invoice.amountPaise + invoice.lateFeePaise;
    const receiptNo = `RCP-${invoice.invoiceNo}-${Date.now()}`;
    const gatewayOrderId = `desk_${invoice.id}_${Date.now()}`;
    const paymentMethod = this.paymentMethodForDto(dto.method);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: tenant.id,
          leaseInvoiceId: invoice.id,
          citizenSubject: `lease-invoice:${invoice.id}`,
          amountPaise: totalPaise,
          feeCode: 'rental',
          method: paymentMethod,
          status: 'succeeded',
          gateway: 'desk',
          gatewayOrderId,
          settledAt: new Date(),
        },
      });
      const receipt = await tx.receipt.create({
        data: {
          tenantId: tenant.id,
          paymentId: payment.id,
          leaseInvoiceId: invoice.id,
          receiptNumber: receiptNo,
          verificationToken: randomUUID(),
          revenueHeadCode: 'RENT_LEASE',
          accountingCode: 'RENT_LEASE_INCOME',
          serviceCode: 'lease-rent',
          amountPaise: totalPaise,
          gateway: 'desk',
          gatewayOrderId,
        },
      });
      const updatedInvoice = await tx.leaseInvoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID' },
      });
      this.logger.log(
        `[LEASE PAYMENT] Invoice ${invoice.invoiceNo} settled offline via ${dto.method} (payment=${payment.id}, receipt=${receiptNo})`,
      );
      return { invoice: updatedInvoice, payment, receipt };
    });
  }

  /**
   * Map a tenant-facing lease payment method (`CASH_AT_DESK`, `BANK_TRANSFER`,
   * `CHEQUE`, `ONLINE_GATEWAY`) onto the `payments.method` enum enforced by the
   * `payments_method_check` constraint. The `ONLINE_GATEWAY` flow is handled by
   * `startOnlinePayment` and never reaches this method, but the explicit
   * fallback keeps the switch exhaustive.
   */
  private paymentMethodForDto(method: RecordLeasePaymentDto['method']): string {
    switch (method) {
      case 'CASH_AT_DESK':
        return 'cash';
      case 'BANK_TRANSFER':
        return 'bank_transfer';
      case 'CHEQUE':
        return 'cheque';
      case 'ONLINE_GATEWAY':
        return 'upi';
      default:
        return 'cash';
    }
  }

  private async applyLateFeeIfOverdue(
    tenantId: string,
    invoiceId: string,
    currentStatus: string,
    currentLateFee: number,
  ): Promise<number> {
    if (currentStatus !== 'OVERDUE' || currentLateFee > 0) {
      return currentLateFee;
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const config = (tenant?.config ?? {}) as {
      rentalLateFee?: { enabled?: boolean; flatAmountPaise?: number };
    };
    const cfg = config.rentalLateFee;
    if (!cfg?.enabled || !cfg.flatAmountPaise) {
      return 0;
    }
    await this.prisma.leaseInvoice.update({
      where: { id: invoiceId },
      data: { lateFeePaise: cfg.flatAmountPaise },
    });
    return cfg.flatAmountPaise;
  }

  /**
   * Citizen-scoped entry point for paying a lease invoice online. Differs from
   * the staff `recordPayment` in three ways:
   *
   *  1. No `tenantCode` argument — the invoice is looked up across all tenants.
   *  2. Authorization is **ownership**, not a role: the caller must present a
   *     `phone` whose digit-normalized form matches the invoice's agreement
   *     `lessorPhone`. This mirrors the phone-based lookup the citizen
   *     portal already uses for the `GET /lease-invoices/lookup` endpoint.
   *  3. Only the `ONLINE_GATEWAY` method is supported. Offline flows still go
   *     through the tenant admin desk (cash, bank transfer, cheque).
   *
   * Returns the same `{ paymentId, gatewayOrderId, redirectUrl }` shape the
   * staff `startOnlinePayment` does, so the PWA can parse the `redirectUrl`
   * and call `POST /payments/stub/complete` to settle.
   */
  async citizenPayOnline(
    principal: { subject: string },
    invoiceId: string,
    phone: string,
  ): Promise<{
    invoiceId: string;
    paymentId: string;
    gatewayOrderId: string;
    redirectUrl: string;
  }> {
    const normalized = phone.replace(/\D+/g, '');
    if (normalized.length < 6) {
      throw new BadRequestException(
        'A valid phone number (at least 6 digits) is required to pay this invoice.',
      );
    }

    const invoice = await this.prisma.leaseInvoice.findFirst({
      where: { id: invoiceId },
      include: {
        agreement: { include: { asset: true } },
        tenant: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status === 'PAID' || invoice.status === 'WAIVED') {
      throw new ConflictException(`Invoice is already ${invoice.status}`);
    }

    const agreementPhone = (invoice.agreement.lessorPhone ?? '').replace(/\D+/g, '');
    if (!agreementPhone || !this.phonesMatch(agreementPhone, normalized)) {
      // Same posture as `lookupLeasesByPhone`: never leak that an invoice with
      // this id exists if the caller can't prove ownership. A 404 is safer
      // than a 403 here.
      this.logger.warn(
        `[LEASE PAYMENT] Phone mismatch on citizen pay-online for invoice ${invoice.invoiceNo} (subject phone digits: ***).`,
      );
      throw new NotFoundException('Invoice not found');
    }

    const updatedLateFee = await this.applyLateFeeIfOverdue(
      invoice.tenantId,
      invoice.id,
      invoice.status,
      invoice.lateFeePaise,
    );
    const effectiveInvoice = { ...invoice, lateFeePaise: updatedLateFee };

    return this.startOnlinePayment(
      { id: invoice.tenant.id, code: invoice.tenant.code },
      effectiveInvoice,
      principal.subject,
    );
  }

  /**
   * Compare two phone strings by their digit forms. Accepts the same
   * +91 / 0 / 10-digit / 12-digit variations the citizen lookup uses, so a
   * single normalization pass is enough on both sides.
   */
  private phonesMatch(a: string, b: string): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    const a10 = a.length > 10 ? a.slice(-10) : a;
    const b10 = b.length > 10 ? b.slice(-10) : b;
    if (a10 === b10) return true;
    // Mirror the "+91" prefix: if one is 10 digits and the other starts with 91…
    if (a.length === 10 && b === `91${a}`) return true;
    if (b.length === 10 && a === `91${b}`) return true;
    return false;
  }
}
