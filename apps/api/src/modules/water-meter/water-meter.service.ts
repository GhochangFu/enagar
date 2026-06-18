import { createHash, randomUUID } from 'node:crypto';

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

import type {
  ImportWaterMeterAccountsDto,
  InitiateWaterMeterRechargeDto,
  UpsertWaterMeterAccountDto,
  WaterMeterTenantQueryDto,
} from './dto/water-meter.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { PaymentResponse } from '../payments/dto';
import type { IPaymentGateway } from '../payments/payment-gateway';
import type { PaymentStore } from '../payments/payment-store';

const WATER_RECHARGE_FEE_CODE = 'water_recharge';

export type WaterMeterLookupResponse = {
  meter_id: string;
  consumer_name: string;
  balance_paise: number;
  last_reading_litres: number | null;
  last_reading_at: string | null;
};

export type WaterMeterRechargeResponse = {
  recharge_id: string;
  meter_id: string;
  amount_paise: number;
  status: string;
  balance_after_paise: number | null;
  payment: PaymentResponse | null;
};

export type TenantAdminWaterMeterAccountRow = WaterMeterLookupResponse & {
  id: string;
  consumer_phone: string | null;
  is_active: boolean;
  updated_at: string;
};

export type TenantAdminWaterMeterRechargeRow = {
  id: string;
  meter_id: string;
  citizen_subject: string;
  amount_paise: number;
  status: string;
  payment_id: string | null;
  balance_after_paise: number | null;
  created_at: string;
  credited_at: string | null;
};

@Injectable()
export class WaterMeterService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('IPaymentGateway')
    private readonly gateway: IPaymentGateway,
    @Inject(PAYMENT_STORE)
    private readonly store: PaymentStore,
  ) {}

  async lookupForCitizen(
    principal: AuthenticatedPrincipal,
    meterId: string,
    query: WaterMeterTenantQueryDto,
  ): Promise<WaterMeterLookupResponse> {
    const { tenantId } = this.resolveCitizenTenant(principal, query.tenant_code);
    await this.assertIotWaterEnabled(tenantId);
    const { account, citizenId } = await this.getAuthorizedAccount(principal, tenantId, meterId);

    if (!account.citizenId) {
      await this.prisma.waterMeterAccount.update({
        where: { id: account.id },
        data: { citizenId },
      });
    }

    return toLookupResponse(account);
  }

  async initiateRechargeForCitizen(
    principal: AuthenticatedPrincipal,
    meterId: string,
    dto: InitiateWaterMeterRechargeDto,
    idempotencyKey: string | undefined,
  ): Promise<WaterMeterRechargeResponse> {
    const normalizedKey = idempotencyKey?.trim();
    if (!normalizedKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    const amountPaise = assertRechargeAmount(dto.amount_paise);
    const { tenantId } = this.resolveCitizenTenant(principal, dto.tenant_code);
    await this.assertIotWaterEnabled(tenantId);
    const { account } = await this.getAuthorizedAccount(principal, tenantId, meterId);

    const fingerprint = createHash('sha256')
      .update(`${account.id}:${amountPaise}:${dto.method}:iot-water`)
      .digest('hex');
    const existing = await this.store.findIdempotencyRecord(principal, normalizedKey, tenantId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new ConflictException('Idempotency-Key was already used for a different payment');
      }
      const payment = await this.store.findByIdForPrincipal(principal, existing.paymentId);
      if (!payment?.water_meter_recharge_id) {
        throw new NotFoundException('Idempotent water recharge payment not found');
      }
      const recharge = await this.getRechargeForPayment(payment.water_meter_recharge_id, tenantId);
      return toRechargeResponse(recharge, account.meterId, payment);
    }

    const recharge = await this.prisma.waterMeterRecharge.create({
      data: {
        tenantId,
        accountId: account.id,
        citizenSubject: principal.subject,
        amountPaise,
        status: 'PENDING',
      },
    });

    try {
      const activePayment = await this.store.findActivePaymentByWaterMeterRecharge(recharge.id);
      if (activePayment) {
        return toRechargeResponse(recharge, account.meterId, activePayment);
      }

      const paymentId = randomUUID();
      const gatewayResult = await this.gateway.initiate({
        paymentId,
        tenantId,
        applicationId: recharge.id,
        amountPaise,
        currency: 'INR',
        method: dto.method,
      });
      const payment = await this.store.createPendingPayment({
        id: paymentId,
        tenantId,
        citizenSubject: principal.subject,
        waterMeterRechargeId: recharge.id,
        feeCode: WATER_RECHARGE_FEE_CODE,
        amountPaise,
        method: dto.method,
        gateway: gatewayResult.gateway,
        gatewayOrderId: gatewayResult.gatewayOrderId,
        redirectUrl: gatewayResult.redirectUrl,
        idempotencyKey: normalizedKey,
        requestFingerprint: fingerprint,
        expiresAt: this.nextDay(),
      });

      return toRechargeResponse(recharge, account.meterId, payment);
    } catch (error) {
      await this.prisma.waterMeterRecharge.delete({ where: { id: recharge.id } }).catch(() => {});
      throw error;
    }
  }

  async listForAdmin(principal: AuthenticatedPrincipal): Promise<{
    accounts: TenantAdminWaterMeterAccountRow[];
    recharges: TenantAdminWaterMeterRechargeRow[];
  }> {
    assertTenantPortalStaff(principal);
    const [accounts, recharges] = await Promise.all([
      this.prisma.waterMeterAccount.findMany({
        where: { tenantId: principal.tenantId },
        orderBy: [{ isActive: 'desc' }, { meterId: 'asc' }],
      }),
      this.prisma.waterMeterRecharge.findMany({
        where: { tenantId: principal.tenantId },
        include: { account: { select: { meterId: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return {
      accounts: accounts.map(toAdminAccountRow),
      recharges: recharges.map(toAdminRechargeRow),
    };
  }

  async upsertAccount(
    principal: AuthenticatedPrincipal,
    dto: UpsertWaterMeterAccountDto,
  ): Promise<TenantAdminWaterMeterAccountRow> {
    assertTenantPortalStaff(principal);
    const row = await this.upsertAccountForTenant(principal.tenantId, dto);
    return toAdminAccountRow(row);
  }

  async importAccounts(
    principal: AuthenticatedPrincipal,
    dto: ImportWaterMeterAccountsDto,
  ): Promise<{ imported: number; accounts: TenantAdminWaterMeterAccountRow[] }> {
    assertTenantPortalStaff(principal);
    const accounts: TenantAdminWaterMeterAccountRow[] = [];
    for (const account of dto.accounts) {
      const row = await this.upsertAccountForTenant(principal.tenantId, account);
      accounts.push(toAdminAccountRow(row));
    }
    return { imported: accounts.length, accounts };
  }

  private async getAuthorizedAccount(
    principal: AuthenticatedPrincipal,
    tenantId: string,
    meterId: string,
  ) {
    const citizenId = await ensureMunicipalCitizenRow(this.prisma, principal.subject, tenantId);
    const citizen = await this.prisma.citizen.findUnique({
      where: { id: citizenId },
      select: { id: true, mobile: true },
    });
    if (!citizen) {
      throw new ForbiddenException('Citizen profile not found');
    }

    const account = await this.prisma.waterMeterAccount.findUnique({
      where: { tenantId_meterId: { tenantId, meterId: meterId.trim().toUpperCase() } },
    });
    if (!account || !account.isActive) {
      throw new NotFoundException('Water meter not found');
    }
    if (normalizePhone(account.consumerPhone) !== normalizePhone(citizen.mobile)) {
      throw new ForbiddenException('Water meter is not linked to your registered mobile number');
    }
    return { account, citizenId: citizen.id };
  }

  private async getRechargeForPayment(rechargeId: string, tenantId: string) {
    const recharge = await this.prisma.waterMeterRecharge.findFirst({
      where: { id: rechargeId, tenantId },
    });
    if (!recharge) {
      throw new NotFoundException('Water recharge not found');
    }
    return recharge;
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

  private async assertIotWaterEnabled(tenantId: string): Promise<void> {
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
    const iotWater =
      smartCity.iot_water &&
      typeof smartCity.iot_water === 'object' &&
      !Array.isArray(smartCity.iot_water)
        ? (smartCity.iot_water as Record<string, unknown>)
        : {};
    if (iotWater.enabled === false) {
      throw new ForbiddenException('IoT water recharge is not enabled for this municipality');
    }
  }

  private async upsertAccountForTenant(tenantId: string, dto: UpsertWaterMeterAccountDto) {
    const meterId = dto.meter_id.trim().toUpperCase();
    if (meterId.length < 3) {
      throw new BadRequestException('Meter ID must be at least 3 characters');
    }
    const lastReadingAt = dto.last_reading_at ? new Date(dto.last_reading_at) : null;
    if (dto.last_reading_at && Number.isNaN(lastReadingAt?.getTime())) {
      throw new BadRequestException('last_reading_at must be a valid date');
    }

    return this.prisma.waterMeterAccount.upsert({
      where: { tenantId_meterId: { tenantId, meterId } },
      create: {
        tenantId,
        meterId,
        consumerName: dto.consumer_name.trim(),
        consumerPhone: normalizePhone(dto.consumer_phone),
        balancePaise: dto.balance_paise ?? 0,
        lastReadingLitres: dto.last_reading_litres ?? null,
        lastReadingAt,
        isActive: dto.is_active ?? true,
      },
      update: {
        consumerName: dto.consumer_name.trim(),
        consumerPhone: normalizePhone(dto.consumer_phone),
        ...(dto.balance_paise !== undefined ? { balancePaise: dto.balance_paise } : {}),
        lastReadingLitres: dto.last_reading_litres ?? null,
        lastReadingAt,
        isActive: dto.is_active ?? true,
      },
    });
  }

  private nextDay(): Date {
    const expires = new Date();
    expires.setUTCDate(expires.getUTCDate() + 1);
    return expires;
  }
}

function assertRechargeAmount(amountPaise: number): number {
  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw new BadRequestException('Recharge amount must be at least ₹1.00');
  }
  if (amountPaise > 100_000_00) {
    throw new BadRequestException('Recharge amount exceeds the ₹100,000 limit');
  }
  return amountPaise;
}

function normalizePhone(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (!digits) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function toLookupResponse(row: {
  meterId: string;
  consumerName: string;
  balancePaise: number;
  lastReadingLitres: number | null;
  lastReadingAt: Date | null;
}): WaterMeterLookupResponse {
  return {
    meter_id: row.meterId,
    consumer_name: row.consumerName,
    balance_paise: row.balancePaise,
    last_reading_litres: row.lastReadingLitres,
    last_reading_at: row.lastReadingAt?.toISOString() ?? null,
  };
}

function toRechargeResponse(
  row: {
    id: string;
    amountPaise: number;
    status: string;
    balanceAfterPaise: number | null;
  },
  meterId: string,
  payment: PaymentResponse | null,
): WaterMeterRechargeResponse {
  return {
    recharge_id: row.id,
    meter_id: meterId,
    amount_paise: row.amountPaise,
    status: row.status,
    balance_after_paise: row.balanceAfterPaise,
    payment,
  };
}

function toAdminAccountRow(row: {
  id: string;
  meterId: string;
  consumerName: string;
  consumerPhone: string | null;
  balancePaise: number;
  lastReadingLitres: number | null;
  lastReadingAt: Date | null;
  isActive: boolean;
  updatedAt: Date;
}): TenantAdminWaterMeterAccountRow {
  return {
    id: row.id,
    ...toLookupResponse(row),
    consumer_phone: row.consumerPhone,
    is_active: row.isActive,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toAdminRechargeRow(row: {
  id: string;
  account: { meterId: string };
  citizenSubject: string;
  amountPaise: number;
  status: string;
  paymentId: string | null;
  balanceAfterPaise: number | null;
  createdAt: Date;
  creditedAt: Date | null;
}): TenantAdminWaterMeterRechargeRow {
  return {
    id: row.id,
    meter_id: row.account.meterId,
    citizen_subject: row.citizenSubject,
    amount_paise: row.amountPaise,
    status: row.status,
    payment_id: row.paymentId,
    balance_after_paise: row.balanceAfterPaise,
    created_at: row.createdAt.toISOString(),
    credited_at: row.creditedAt?.toISOString() ?? null,
  };
}
