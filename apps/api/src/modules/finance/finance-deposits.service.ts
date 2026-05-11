import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { assertDepositTransition, type DepositStatus, isDepositStatus } from './deposit-lifecycle';
import { assertFinanceStaff } from './finance-auth';

import type { CreateDepositDto, DepositResponse, ForfeitDepositDto } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Deposit as DepositRow } from '../../generated/prisma';

@Injectable()
export class FinanceDepositsService {
  constructor(private readonly prisma: PrismaService) {}

  toResponse(row: DepositRow): DepositResponse {
    if (!isDepositStatus(row.status)) {
      throw new Error(`Unknown deposit status in DB: ${row.status}`);
    }
    return {
      id: row.id,
      tenant_id: row.tenantId,
      citizen_id: row.citizenId,
      application_id: row.applicationId,
      deposit_type: row.depositType,
      reference_code: row.referenceCode,
      amount_paise: row.amountPaise,
      capture_payment_id: row.capturePaymentId,
      expected_release_at: row.expectedReleaseAt?.toISOString() ?? null,
      status: row.status as DepositStatus,
      forfeiture_reason: row.forfeitureReason,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  async getById(principal: AuthenticatedPrincipal, depositId: string): Promise<DepositResponse> {
    assertFinanceStaff(principal);
    const row = await this.prisma.deposit.findFirst({
      where: { id: depositId, tenantId: principal.tenantId },
    });
    if (!row) {
      throw new NotFoundException('Deposit not found');
    }
    return this.toResponse(row);
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateDepositDto): Promise<DepositResponse> {
    assertFinanceStaff(principal);
    const citizen = await this.prisma.citizen.findFirst({
      where: { id: dto.citizen_id, tenantId: principal.tenantId },
    });
    if (!citizen) {
      throw new BadRequestException('Citizen not found in tenant');
    }
    if (dto.application_id) {
      const application = await this.prisma.application.findFirst({
        where: { id: dto.application_id, tenantId: principal.tenantId },
      });
      if (!application) {
        throw new BadRequestException('Application not found in tenant');
      }
      if (application.citizenId !== dto.citizen_id) {
        throw new BadRequestException('Application does not belong to citizen');
      }
    }
    if (dto.capture_payment_id) {
      const payment = await this.prisma.payment.findFirst({
        where: {
          id: dto.capture_payment_id,
          tenantId: principal.tenantId,
        },
      });
      if (!payment) {
        throw new BadRequestException('capture_payment_id payment not found in tenant');
      }
    }

    try {
      const row = await this.prisma.deposit.create({
        data: {
          tenantId: principal.tenantId,
          citizenId: dto.citizen_id,
          applicationId: dto.application_id ?? null,
          depositType: dto.deposit_type,
          referenceCode: dto.reference_code ?? null,
          amountPaise: dto.amount_paise,
          expectedReleaseAt: dto.expected_release_at ? new Date(dto.expected_release_at) : null,
          capturePaymentId: dto.capture_payment_id ?? null,
        },
      });
      return this.toResponse(row);
    } catch (err) {
      this.rethrowUnique(err);
      throw err;
    }
  }

  async markEligibleForRelease(
    principal: AuthenticatedPrincipal,
    depositId: string,
  ): Promise<DepositResponse> {
    assertFinanceStaff(principal);
    const row = await this.requireDeposit(principal.tenantId, depositId);
    try {
      assertDepositTransition(row.status as DepositStatus, 'eligible_for_release');
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid transition');
    }
    const updated = await this.prisma.deposit.update({
      where: { id: depositId },
      data: { status: 'eligible_for_release' },
    });
    return this.toResponse(updated);
  }

  async forfeit(
    principal: AuthenticatedPrincipal,
    depositId: string,
    dto: ForfeitDepositDto,
  ): Promise<DepositResponse> {
    assertFinanceStaff(principal);
    const row = await this.requireDeposit(principal.tenantId, depositId);
    const from = row.status as DepositStatus;
    if (from !== 'held' && from !== 'eligible_for_release') {
      throw new BadRequestException(
        'Deposit can only be forfeited while held or eligible for release',
      );
    }
    try {
      assertDepositTransition(from, 'forfeited');
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Invalid transition');
    }
    const updated = await this.prisma.deposit.update({
      where: { id: depositId },
      data: {
        status: 'forfeited',
        forfeitureReason: dto.reason,
      },
    });
    return this.toResponse(updated);
  }

  private async requireDeposit(tenantId: string, depositId: string): Promise<DepositRow> {
    const row = await this.prisma.deposit.findFirst({
      where: { id: depositId, tenantId },
    });
    if (!row) {
      throw new NotFoundException('Deposit not found');
    }
    return row;
  }

  private rethrowUnique(err: unknown): void {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      throw new BadRequestException('capture_payment_id is already linked to another deposit');
    }
  }
}
