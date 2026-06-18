import { createHash, randomUUID } from 'node:crypto';

import { StubEvMeterProvider, type IEvMeterProvider } from '@enagar/smart-city-adapters';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  isCitizenSelfServicePrincipal,
  resolveCitizenMunicipalityForWrite,
} from '../../common/auth/citizen-scope';
import { PrismaService } from '../../common/database/prisma.service';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';
import { ensureMunicipalCitizenRow } from '../citizen/ensure-municipal-citizen-row';
import { PAYMENT_STORE } from '../payments/payment-store';
import { tenantSeeds } from '../tenants/tenant.seed';

import { computeEvSessionAmountPaise } from './ev-charging-amount.util';
import { evChargingHoldExpiresAt, isEvChargingHoldExpired } from './ev-charging-hold.util';

import type {
  ConfirmEvSessionPaymentDto,
  EvChargingCreateHoldDto,
  EvChargingSessionActionDto,
  EvChargingTenantQueryDto,
  InitiateEvSessionPaymentDto,
  UpsertEvChargerDto,
} from './dto/ev-charging.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { EvSessionStatus, Prisma } from '../../generated/prisma';
import type { PaymentResponse } from '../payments/dto';
import type { IPaymentGateway } from '../payments/payment-gateway';
import type { PaymentStore } from '../payments/payment-store';

const EV_CHARGING_PAYMENT_FEE_CODE = 'ev_charging';

export type EvChargerListItem = {
  code: string;
  name: Prisma.JsonValue;
  location: Prisma.JsonValue;
  connector_type: string;
  max_kw: string;
  rate_paise_per_kwh: number;
  is_active: boolean;
  available: boolean;
};

export type EvSessionCitizenResponse = {
  session_id: string;
  charger_code: string;
  vehicle_number?: string | null;
  status: string;
  hold_expires_at?: string;
  started_at?: string | null;
  ended_at?: string | null;
  kwh_consumed?: number | null;
  amount_paise?: number | null;
  rate_paise_per_kwh?: number;
  payment?: PaymentResponse | null;
};

export type TenantAdminEvChargerRow = {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  location: Prisma.JsonValue;
  connector_type: string;
  max_kw: string;
  rate_paise_per_kwh: number;
  is_active: boolean;
  updated_at: string;
};

export type TenantAdminEvSessionRow = {
  id: string;
  charger_code: string;
  citizen_id: string;
  vehicle_number: string | null;
  status: string;
  hold_expires_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  kwh_consumed: number | null;
  amount_paise: number | null;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class EvChargingService {
  private readonly meterProvider: IEvMeterProvider;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('IPaymentGateway')
    private readonly gateway: IPaymentGateway,
    @Inject(PAYMENT_STORE)
    private readonly store: PaymentStore,
  ) {
    this.meterProvider = new StubEvMeterProvider();
  }

  async listChargersForCitizen(
    principal: AuthenticatedPrincipal,
    query: EvChargingTenantQueryDto,
  ): Promise<{ chargers: EvChargerListItem[] }> {
    const { tenantId } = this.resolveCitizenTenant(principal, query.tenant_code);
    await this.assertEvChargingEnabled(tenantId);
    await this.releaseExpiredEvSessionHolds(tenantId);

    const chargers = await this.prisma.evCharger.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: 'asc' },
    });
    const busyChargerIds = await this.listBusyChargerIds(tenantId);

    return {
      chargers: chargers.map((charger) => ({
        code: charger.code,
        name: charger.name,
        location: charger.location,
        connector_type: charger.connectorType,
        max_kw: charger.maxKw.toString(),
        rate_paise_per_kwh: charger.ratePaisePerKwh,
        is_active: charger.isActive,
        available: !busyChargerIds.has(charger.id),
      })),
    };
  }

  async createHoldForCitizen(
    principal: AuthenticatedPrincipal,
    chargerCode: string,
    dto: EvChargingCreateHoldDto,
  ): Promise<EvSessionCitizenResponse> {
    const { tenantId } = this.resolveCitizenTenant(principal, dto.tenant_code);
    await this.assertEvChargingEnabled(tenantId);
    await this.releaseExpiredEvSessionHolds(tenantId);

    const charger = await this.getActiveChargerByCode(tenantId, chargerCode);
    await this.assertChargerAvailable(tenantId, charger.id);

    const citizenId = await ensureMunicipalCitizenRow(this.prisma, principal.subject, tenantId);
    await this.assertCitizenHasNoActiveSession(tenantId, citizenId);

    const vehicleNumber = dto.vehicle_number.trim().toUpperCase();
    const holdExpiresAt = evChargingHoldExpiresAt();
    const session = await this.prisma.evSession.create({
      data: {
        tenantId,
        chargerId: charger.id,
        citizenId,
        vehicleNumber,
        status: 'HELD',
        holdExpiresAt,
      },
      include: { charger: { select: { code: true } } },
    });

    return this.toCitizenSessionResponse(session, charger.ratePaisePerKwh, null);
  }

  async startSessionForCitizen(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    dto: EvChargingSessionActionDto,
  ): Promise<EvSessionCitizenResponse> {
    const { tenantId } = this.resolveCitizenTenant(principal, dto.tenant_code);
    await this.assertEvChargingEnabled(tenantId);

    const session = await this.getOwnedSession(principal, sessionId, tenantId);
    if (session.status !== 'HELD') {
      throw new ConflictException('EV session is not awaiting start');
    }
    if (isEvChargingHoldExpired(session.holdExpiresAt)) {
      throw new ConflictException('EV charger hold has expired');
    }

    const startedAt = new Date();
    const updated = await this.prisma.evSession.update({
      where: { id: session.id },
      data: {
        status: 'CHARGING',
        startedAt,
        holdExpiresAt: null,
      },
      include: {
        charger: { select: { code: true, ratePaisePerKwh: true } },
      },
    });
    await this.meterProvider.startMeter(updated.id);

    return this.toCitizenSessionResponse(updated, updated.charger.ratePaisePerKwh, null);
  }

  async stopSessionForCitizen(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    dto: EvChargingSessionActionDto,
  ): Promise<EvSessionCitizenResponse> {
    const { tenantId } = this.resolveCitizenTenant(principal, dto.tenant_code);
    await this.assertEvChargingEnabled(tenantId);

    const session = await this.getOwnedSession(principal, sessionId, tenantId);
    if (session.status !== 'CHARGING' || session.endedAt) {
      throw new ConflictException('EV session is not actively charging');
    }

    const kwhConsumed = await this.meterProvider.stopMeter(session.id);
    const amountPaise = computeEvSessionAmountPaise(kwhConsumed, session.charger.ratePaisePerKwh);
    const endedAt = new Date();
    const updated = await this.prisma.evSession.update({
      where: { id: session.id },
      data: {
        endedAt,
        kwhConsumed: kwhConsumed.toFixed(3),
        amountPaise,
      },
      include: {
        charger: { select: { code: true, ratePaisePerKwh: true } },
      },
    });

    return this.toCitizenSessionResponse(updated, updated.charger.ratePaisePerKwh, null);
  }

  async initiatePaymentForCitizen(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    dto: InitiateEvSessionPaymentDto,
    idempotencyKey: string | undefined,
  ): Promise<EvSessionCitizenResponse> {
    const normalizedKey = idempotencyKey?.trim();
    if (!normalizedKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const { tenantId } = this.resolveCitizenTenant(principal, dto.tenant_code);
    await this.assertEvChargingEnabled(tenantId);

    const session = await this.getOwnedSession(principal, sessionId, tenantId);
    if (session.status !== 'CHARGING' || !session.endedAt || session.amountPaise == null) {
      throw new ConflictException('EV session is not ready for payment');
    }

    const amountPaise = session.amountPaise;
    const fingerprint = createHash('sha256')
      .update(`${session.id}:${amountPaise}:${dto.method}:ev-charging`)
      .digest('hex');

    const existing = await this.store.findIdempotencyRecord(
      principal,
      normalizedKey,
      session.tenantId,
    );
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new ConflictException('Idempotency-Key was already used for a different payment');
      }
      const payment = await this.store.findByIdForPrincipal(principal, existing.paymentId);
      if (!payment) {
        throw new NotFoundException('Idempotent payment not found');
      }
      return this.toCitizenSessionResponse(session, session.charger.ratePaisePerKwh, payment);
    }

    const active = await this.store.findActivePaymentByEvSession(session.id);
    if (active) {
      return this.toCitizenSessionResponse(session, session.charger.ratePaisePerKwh, active);
    }

    const paymentId = randomUUID();
    const gatewayResult = await this.gateway.initiate({
      paymentId,
      tenantId: session.tenantId,
      applicationId: session.id,
      amountPaise,
      currency: 'INR',
      method: dto.method,
    });
    const payment = await this.store.createPendingPayment({
      id: paymentId,
      tenantId: session.tenantId,
      citizenSubject: principal.subject,
      evSessionId: session.id,
      feeCode: EV_CHARGING_PAYMENT_FEE_CODE,
      amountPaise,
      method: dto.method,
      gateway: gatewayResult.gateway,
      gatewayOrderId: gatewayResult.gatewayOrderId,
      redirectUrl: gatewayResult.redirectUrl,
      idempotencyKey: normalizedKey,
      requestFingerprint: fingerprint,
      expiresAt: this.nextDay(),
    });

    return this.toCitizenSessionResponse(session, session.charger.ratePaisePerKwh, payment);
  }

  async confirmPaymentForCitizen(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    dto: ConfirmEvSessionPaymentDto,
  ): Promise<EvSessionCitizenResponse> {
    const { tenantId } = this.resolveCitizenTenant(principal, dto.tenant_code);
    await this.assertEvChargingEnabled(tenantId);

    const session = await this.getOwnedSession(principal, sessionId, tenantId);
    if (session.status !== 'CHARGING' || !session.endedAt || session.amountPaise == null) {
      throw new ConflictException('EV session is not awaiting payment confirmation');
    }

    const payment = dto.payment_id
      ? await this.store.findByIdForPrincipal(principal, dto.payment_id)
      : await this.store.findActivePaymentByEvSession(session.id);

    if (!payment || payment.status !== 'settled') {
      throw new BadRequestException('Payment must be settled before confirmation');
    }
    if (payment.amount_paise !== session.amountPaise) {
      throw new BadRequestException('Payment amount does not match session total');
    }

    const updated = await this.prisma.evSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        paymentId: payment.id,
      },
      include: {
        charger: { select: { code: true, ratePaisePerKwh: true } },
      },
    });

    return this.toCitizenSessionResponse(updated, updated.charger.ratePaisePerKwh, payment);
  }

  async listForAdmin(principal: AuthenticatedPrincipal): Promise<{
    chargers: TenantAdminEvChargerRow[];
    sessions: TenantAdminEvSessionRow[];
  }> {
    assertTenantPortalStaff(principal);
    const [chargers, sessions] = await Promise.all([
      this.prisma.evCharger.findMany({
        where: { tenantId: principal.tenantId },
        orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
      }),
      this.prisma.evSession.findMany({
        where: { tenantId: principal.tenantId },
        include: { charger: { select: { code: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      chargers: chargers.map(toAdminChargerRow),
      sessions: sessions.map(toAdminSessionRow),
    };
  }

  async listSessionsForAdmin(principal: AuthenticatedPrincipal): Promise<{
    sessions: TenantAdminEvSessionRow[];
  }> {
    assertTenantPortalStaff(principal);
    const sessions = await this.prisma.evSession.findMany({
      where: { tenantId: principal.tenantId },
      include: { charger: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { sessions: sessions.map(toAdminSessionRow) };
  }

  async upsertCharger(
    principal: AuthenticatedPrincipal,
    dto: UpsertEvChargerDto,
  ): Promise<TenantAdminEvChargerRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.code, 'charger code');
    assertLocaleLabel(dto.name, 'charger name');

    const row = await this.prisma.evCharger.upsert({
      where: { tenantId_code: { tenantId: principal.tenantId, code: dto.code.trim() } },
      create: {
        tenantId: principal.tenantId,
        code: dto.code.trim(),
        name: dto.name as Prisma.InputJsonValue,
        location: (dto.location ?? {}) as Prisma.InputJsonValue,
        connectorType: dto.connector_type,
        maxKw: dto.max_kw.toFixed(2),
        ratePaisePerKwh: dto.rate_paise_per_kwh,
        isActive: dto.is_active ?? true,
      },
      update: {
        name: dto.name as Prisma.InputJsonValue,
        location: (dto.location ?? {}) as Prisma.InputJsonValue,
        connectorType: dto.connector_type,
        maxKw: dto.max_kw.toFixed(2),
        ratePaisePerKwh: dto.rate_paise_per_kwh,
        isActive: dto.is_active ?? true,
      },
    });

    return toAdminChargerRow(row);
  }

  private async releaseExpiredEvSessionHolds(tenantId: string): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.evSession.findMany({
      where: {
        tenantId,
        status: 'HELD',
        holdExpiresAt: { lte: now },
      },
      select: { id: true },
    });

    if (expired.length === 0) {
      return;
    }

    await this.prisma.evSession.updateMany({
      where: { id: { in: expired.map((row) => row.id) } },
      data: { status: 'CANCELLED' },
    });
  }

  private async listBusyChargerIds(tenantId: string): Promise<Set<string>> {
    const active = await this.prisma.evSession.findMany({
      where: {
        tenantId,
        status: { in: ['HELD', 'CHARGING'] },
      },
      select: { chargerId: true },
    });
    return new Set(active.map((row) => row.chargerId));
  }

  private async assertChargerAvailable(tenantId: string, chargerId: string): Promise<void> {
    const busy = await this.prisma.evSession.findFirst({
      where: {
        tenantId,
        chargerId,
        status: { in: ['HELD', 'CHARGING'] },
      },
      select: { id: true },
    });
    if (busy) {
      throw new ConflictException('Charger is not available');
    }
  }

  private async assertCitizenHasNoActiveSession(
    tenantId: string,
    citizenId: string,
  ): Promise<void> {
    const active = await this.prisma.evSession.findFirst({
      where: {
        tenantId,
        citizenId,
        status: { in: ['HELD', 'CHARGING'] },
      },
      select: { id: true },
    });
    if (active) {
      throw new ConflictException('You already have an active EV charging session');
    }
  }

  private async getActiveChargerByCode(tenantId: string, code: string) {
    const charger = await this.prisma.evCharger.findUnique({
      where: { tenantId_code: { tenantId, code: code.trim() } },
    });
    if (!charger || !charger.isActive) {
      throw new NotFoundException('EV charger not found');
    }
    return charger;
  }

  private async getOwnedSession(
    principal: AuthenticatedPrincipal,
    sessionId: string,
    tenantId: string,
  ) {
    const session = await this.prisma.evSession.findUnique({
      where: { id: sessionId },
      include: {
        charger: { select: { code: true, ratePaisePerKwh: true } },
        citizen: { select: { keycloakSubject: true } },
      },
    });
    if (!session || session.tenantId !== tenantId) {
      throw new NotFoundException('EV session not found');
    }
    if (session.citizen.keycloakSubject !== principal.subject) {
      throw new ForbiddenException('You can only manage your own EV charging session');
    }
    return session;
  }

  private resolveCitizenTenant(principal: AuthenticatedPrincipal, tenantCodeRaw: string) {
    if (!isCitizenSelfServicePrincipal(principal)) {
      throw new ForbiddenException('Citizen access required');
    }
    const { tenantId, tenantCode } = resolveCitizenMunicipalityForWrite(
      principal,
      tenantSeeds,
      tenantCodeRaw,
    );
    if (tenantCode.toUpperCase() !== tenantCodeRaw.trim().toUpperCase()) {
      throw new BadRequestException('tenant_code must match active municipality scope');
    }
    return { tenantId, tenantCode };
  }

  private async assertEvChargingEnabled(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { config: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const config =
      tenant.config && typeof tenant.config === 'object' && !Array.isArray(tenant.config)
        ? (tenant.config as Record<string, unknown>)
        : {};
    const smartCity =
      config.smart_city &&
      typeof config.smart_city === 'object' &&
      !Array.isArray(config.smart_city)
        ? (config.smart_city as Record<string, unknown>)
        : {};
    const evCharging =
      smartCity.ev_charging &&
      typeof smartCity.ev_charging === 'object' &&
      !Array.isArray(smartCity.ev_charging)
        ? (smartCity.ev_charging as Record<string, unknown>)
        : {};
    if (evCharging.enabled === false) {
      throw new ForbiddenException('EV charging is not enabled for this municipality');
    }
  }

  private toCitizenSessionResponse(
    session: {
      id: string;
      status: EvSessionStatus;
      vehicleNumber?: string | null;
      holdExpiresAt: Date | null;
      startedAt: Date | null;
      endedAt: Date | null;
      kwhConsumed: Prisma.Decimal | null;
      amountPaise: number | null;
      charger: { code: string };
    },
    ratePaisePerKwh: number,
    payment: PaymentResponse | null,
  ): EvSessionCitizenResponse {
    return {
      session_id: session.id,
      charger_code: session.charger.code,
      vehicle_number: session.vehicleNumber ?? null,
      status: mapCitizenSessionStatus(session),
      hold_expires_at: session.holdExpiresAt?.toISOString(),
      started_at: session.startedAt?.toISOString() ?? null,
      ended_at: session.endedAt?.toISOString() ?? null,
      kwh_consumed: session.kwhConsumed ? Number(session.kwhConsumed) : null,
      amount_paise: session.amountPaise,
      rate_paise_per_kwh: ratePaisePerKwh,
      payment,
    };
  }

  private nextDay(): Date {
    const expires = new Date();
    expires.setUTCDate(expires.getUTCDate() + 1);
    return expires;
  }
}

function mapCitizenSessionStatus(session: {
  status: EvSessionStatus;
  endedAt: Date | null;
}): string {
  if (session.status === 'CHARGING' && session.endedAt) {
    return 'awaiting_payment';
  }
  return session.status;
}

function toAdminChargerRow(row: {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  location: Prisma.JsonValue;
  connectorType: string;
  maxKw: Prisma.Decimal;
  ratePaisePerKwh: number;
  isActive: boolean;
  updatedAt: Date;
}): TenantAdminEvChargerRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    location: row.location,
    connector_type: row.connectorType,
    max_kw: row.maxKw.toString(),
    rate_paise_per_kwh: row.ratePaisePerKwh,
    is_active: row.isActive,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toAdminSessionRow(row: {
  id: string;
  status: EvSessionStatus;
  vehicleNumber?: string | null;
  holdExpiresAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  kwhConsumed: Prisma.Decimal | null;
  amountPaise: number | null;
  paymentId: string | null;
  citizenId: string;
  createdAt: Date;
  updatedAt: Date;
  charger: { code: string };
}): TenantAdminEvSessionRow {
  return {
    id: row.id,
    charger_code: row.charger.code,
    citizen_id: row.citizenId,
    vehicle_number: row.vehicleNumber ?? null,
    status: mapCitizenSessionStatus(row),
    hold_expires_at: row.holdExpiresAt?.toISOString() ?? null,
    started_at: row.startedAt?.toISOString() ?? null,
    ended_at: row.endedAt?.toISOString() ?? null,
    kwh_consumed: row.kwhConsumed ? Number(row.kwhConsumed) : null,
    amount_paise: row.amountPaise,
    payment_id: row.paymentId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function assertCode(value: string, label: string): void {
  const trimmed = value.trim();
  if (!trimmed || !/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new BadRequestException(`${label} must be a non-empty alphanumeric code`);
  }
}

function assertLocaleLabel(value: Record<string, unknown>, label: string): void {
  if (!value || typeof value !== 'object' || typeof value.en !== 'string' || !value.en.trim()) {
    throw new BadRequestException(`${label} requires at least an English (en) label`);
  }
}
