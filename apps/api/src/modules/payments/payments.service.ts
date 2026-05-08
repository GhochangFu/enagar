import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ApplicationsService } from '../applications/applications.service';
import { ServicesService } from '../services/services.service';

import { PAYMENT_STORE } from './payment-store';

import type { InitiatePaymentDto, PaymentResponse } from './dto';
import type { IPaymentGateway } from './payment-gateway';
import type { PaymentStore } from './payment-store';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { EffectiveServiceSummary } from '../services/service-catalogue.seed';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly services: ServicesService,
    @Inject('IPaymentGateway')
    private readonly gateway: IPaymentGateway,
    @Inject(PAYMENT_STORE)
    private readonly store: PaymentStore,
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

    const service = this.services.getTenantService(
      this.requireTenantCode(principal),
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
      tenantId: principal.tenantId,
      applicationId: application.id,
      amountPaise: dto.amount_paise,
      currency: 'INR',
      method: dto.method,
    });
    const payment = await this.store.createPendingPayment({
      id: paymentId,
      tenantId: principal.tenantId,
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

  list(principal: AuthenticatedPrincipal): Promise<PaymentResponse[]> {
    return this.store.listByPrincipal(principal);
  }

  getById(principal: AuthenticatedPrincipal, paymentId: string): Promise<PaymentResponse> {
    return this.getOwnedPayment(principal, paymentId);
  }

  private async getOwnedPayment(
    principal: AuthenticatedPrincipal,
    paymentId: string,
  ): Promise<PaymentResponse> {
    const payment = await this.store.findByIdForPrincipal(principal, paymentId);
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

  private requireTenantCode(principal: AuthenticatedPrincipal): string {
    if (!principal.tenantCode) {
      throw new BadRequestException('Tenant code claim is required');
    }
    return principal.tenantCode;
  }

  private nextDay(): Date {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
}
