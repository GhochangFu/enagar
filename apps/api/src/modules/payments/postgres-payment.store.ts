import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import type { PaymentMethod, PaymentResponse, PaymentStatus } from './dto';
import type {
  CreatePendingPaymentInput,
  ExistingIdempotencyRecord,
  PaymentStore,
} from './payment-store';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

interface PaymentRow {
  id: string;
  tenantId: string;
  citizenSubject: string;
  applicationId: string;
  amountPaise: number;
  currency: string;
  method: string;
  status: string;
  gateway: string;
  gatewayOrderId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PaymentTransactionClient {
  payment: {
    create(args: unknown): Promise<PaymentRow>;
    findFirst(args: unknown): Promise<PaymentRow | null>;
    findUnique(args: unknown): Promise<PaymentRow | null>;
    findMany(args: unknown): Promise<PaymentRow[]>;
  };
  paymentIdempotencyKey: {
    create(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<{ requestFingerprint: string; paymentId: string } | null>;
  };
}

/**
 * Postgres-backed store for the Phase 3.1A payment tables.
 *
 * This is intentionally not the active provider yet because the current
 * ApplicationService still creates applications in memory. Enabling this store
 * requires the store contracts to be async and the application rows to be
 * persisted first so the payment FK remains meaningful.
 */
@Injectable()
export class PostgresPaymentStore implements PaymentStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async findIdempotencyRecord(
    principal: AuthenticatedPrincipal,
    idempotencyKey: string,
  ): Promise<ExistingIdempotencyRecord | null> {
    const record = await this.db.paymentIdempotencyKey.findUnique({
      where: {
        tenantId_citizenSubject_idempotencyKey: {
          tenantId: principal.tenantId,
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

  async findActivePaymentByApplication(applicationId: string): Promise<PaymentResponse | null> {
    const payment = await this.db.payment.findFirst({
      where: {
        applicationId,
        status: 'requires_action',
      },
    });
    return payment ? toPaymentResponse(payment) : null;
  }

  async createPendingPayment(input: CreatePendingPaymentInput): Promise<PaymentResponse> {
    const payment = await this.db.$transaction(async (client: PaymentTransactionClient) => {
      const created = await client.payment.create({
        data: {
          id: input.id,
          tenantId: input.tenantId,
          citizenSubject: input.citizenSubject,
          applicationId: input.applicationId,
          amountPaise: input.amountPaise,
          currency: 'INR',
          method: input.method,
          status: 'requires_action',
          gateway: input.gateway,
          gatewayOrderId: input.gatewayOrderId,
        },
      });

      await client.paymentIdempotencyKey.create({
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

    return toPaymentResponse(payment);
  }

  async listByPrincipal(principal: AuthenticatedPrincipal): Promise<PaymentResponse[]> {
    const payments = await this.db.payment.findMany({
      where: {
        tenantId: principal.tenantId,
        citizenSubject: principal.subject,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return payments.map(toPaymentResponse);
  }

  async findByIdForPrincipal(
    principal: AuthenticatedPrincipal,
    paymentId: string,
  ): Promise<PaymentResponse | null> {
    const payment = await this.db.payment.findUnique({
      where: {
        id: paymentId,
      },
    });
    if (
      !payment ||
      payment.tenantId !== principal.tenantId ||
      payment.citizenSubject !== principal.subject
    ) {
      return null;
    }
    return toPaymentResponse(payment);
  }
}

function toPaymentResponse(row: PaymentRow): PaymentResponse {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    citizen_subject: row.citizenSubject,
    application_id: row.applicationId,
    amount_paise: row.amountPaise,
    currency: 'INR',
    method: row.method as PaymentMethod,
    status: row.status as PaymentStatus,
    gateway: 'stub',
    gateway_order_id: row.gatewayOrderId,
    redirect_url: `/payments/stub/complete?payment_id=${row.id}&order_id=${row.gatewayOrderId}`,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}
