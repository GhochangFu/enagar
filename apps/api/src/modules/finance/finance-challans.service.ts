import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { assertChallanTransition, type ChallanStatus, isChallanStatus } from './challan-lifecycle';
import { assertFinanceStaff } from './finance-auth';

import type { ChallanResponse, CreateChallanDto, WaiveChallanDto } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Challan as ChallanRow } from '../../generated/prisma';

@Injectable()
export class FinanceChallansService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(row: ChallanRow): ChallanResponse {
    if (!isChallanStatus(row.status)) {
      throw new Error(`Unknown challan status: ${row.status}`);
    }
    return {
      id: row.id,
      tenant_id: row.tenantId,
      challan_no: row.challanNo,
      issued_to_name: row.issuedToName,
      issued_to_mobile: row.issuedToMobile,
      citizen_id: row.citizenId,
      violation_code: row.violationCode,
      issued_by_user_id: row.issuedByUserId,
      issued_at: row.issuedAt.toISOString(),
      amount_paise: row.amountPaise,
      status: row.status as ChallanStatus,
      paid_at: row.paidAt?.toISOString() ?? null,
      paid_payment_id: row.paidPaymentId,
      waived_reason: row.waivedReason,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateChallanDto): Promise<ChallanResponse> {
    assertFinanceStaff(principal);
    if (dto.citizen_id) {
      const citizen = await this.prisma.citizen.findFirst({
        where: { id: dto.citizen_id, tenantId: principal.tenantId },
      });
      if (!citizen) {
        throw new BadRequestException('citizen_id not found in tenant');
      }
    }
    if (dto.issued_by_user_id) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.issued_by_user_id, tenantId: principal.tenantId },
      });
      if (!user) {
        throw new BadRequestException('issued_by_user_id not found in tenant');
      }
    }

    try {
      const row = await this.prisma.challan.create({
        data: {
          tenantId: principal.tenantId,
          challanNo: dto.challan_no,
          issuedToName: dto.issued_to_name ?? null,
          issuedToMobile: dto.issued_to_mobile ?? null,
          citizenId: dto.citizen_id ?? null,
          violationCode: dto.violation_code,
          amountPaise: dto.amount_paise,
          issuedByUserId: dto.issued_by_user_id ?? null,
        },
      });
      return this.toResponse(row);
    } catch (err) {
      this.rethrowDuplicate(err);
      throw err;
    }
  }

  async getById(principal: AuthenticatedPrincipal, challanId: string): Promise<ChallanResponse> {
    assertFinanceStaff(principal);
    const row = await this.requireChallan(principal.tenantId, challanId);
    return this.toResponse(row);
  }

  async markPaidWithoutPaymentLink(
    principal: AuthenticatedPrincipal,
    challanId: string,
  ): Promise<ChallanResponse> {
    assertFinanceStaff(principal);
    const row = await this.requireChallan(principal.tenantId, challanId);
    const from = row.status as ChallanStatus;
    if (from !== 'issued' && from !== 'disputed') {
      throw new BadRequestException('Challan must be issued or disputed to settle without PSP');
    }
    try {
      assertChallanTransition(from, 'paid');
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : String(e));
    }
    const updated = await this.prisma.challan.update({
      where: { id: challanId },
      data: {
        status: 'paid',
        paidAt: new Date(),
      },
    });
    return this.toResponse(updated);
  }

  async waive(
    principal: AuthenticatedPrincipal,
    challanId: string,
    dto: WaiveChallanDto,
  ): Promise<ChallanResponse> {
    assertFinanceStaff(principal);
    const row = await this.requireChallan(principal.tenantId, challanId);
    const from = row.status as ChallanStatus;
    if (from === 'paid' || from === 'waived') {
      throw new BadRequestException('Paid or waived challans cannot transition');
    }
    try {
      assertChallanTransition(from, 'waived');
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : String(e));
    }
    const updated = await this.prisma.challan.update({
      where: { id: challanId },
      data: {
        status: 'waived',
        waivedReason: dto.reason,
      },
    });
    return this.toResponse(updated);
  }

  async reopenDisputed(
    principal: AuthenticatedPrincipal,
    challanId: string,
  ): Promise<ChallanResponse> {
    assertFinanceStaff(principal);
    const row = await this.requireChallan(principal.tenantId, challanId);
    try {
      assertChallanTransition(row.status as ChallanStatus, 'issued');
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : String(e));
    }
    const updated = await this.prisma.challan.update({
      where: { id: challanId },
      data: {
        status: 'issued',
        waivedReason: null,
      },
    });
    return this.toResponse(updated);
  }

  private async requireChallan(tenantId: string, challanId: string): Promise<ChallanRow> {
    const row = await this.prisma.challan.findFirst({
      where: { id: challanId, tenantId },
    });
    if (!row) {
      throw new NotFoundException('Challan not found');
    }
    return row;
  }

  private rethrowDuplicate(err: unknown): void {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      throw new BadRequestException('challan_no already exists for tenant');
    }
  }
}
