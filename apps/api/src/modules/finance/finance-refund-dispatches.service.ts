import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { assertDepositTransition, type DepositStatus } from './deposit-lifecycle';
import { assertFinanceStaff } from './finance-auth';
import {
  assertRefundDispatchTransition,
  type RefundDispatchStatus,
  isRefundDispatchStatus,
} from './refund-dispatch-lifecycle';

import type {
  CompleteRefundDispatchDto,
  RejectRefundDispatchDto,
  RefundDispatchNoteDto,
  RefundDispatchResponse,
} from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { RefundDispatch as RefundRow } from '../../generated/prisma';

@Injectable()
export class FinanceRefundDispatchesService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(row: RefundRow): RefundDispatchResponse {
    if (!isRefundDispatchStatus(row.status)) {
      throw new Error(`Unknown refund dispatch status: ${row.status}`);
    }
    return {
      id: row.id,
      tenant_id: row.tenantId,
      deposit_id: row.depositId,
      amount_paise: row.amountPaise,
      status: row.status as RefundDispatchStatus,
      requested_by_subject: row.requestedBySubject,
      reviewed_by_subject: row.reviewedBySubject,
      review_note: row.reviewNote,
      psp_completion_note: row.pspCompletionNote,
      rejected_reason: row.rejectedReason,
      completed_at: row.completedAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  async findById(
    principal: AuthenticatedPrincipal,
    dispatchId: string,
  ): Promise<RefundDispatchResponse> {
    assertFinanceStaff(principal);
    const row = await this.prisma.refundDispatch.findFirst({
      where: { id: dispatchId, tenantId: principal.tenantId },
    });
    if (!row) {
      throw new NotFoundException('Refund dispatch not found');
    }
    return this.toResponse(row);
  }

  async submitFromEligibleDeposit(
    principal: AuthenticatedPrincipal,
    depositId: string,
    dto?: RefundDispatchNoteDto,
  ): Promise<RefundDispatchResponse> {
    assertFinanceStaff(principal);
    return this.prisma.$transaction(async (tx) => {
      const deposit = await tx.deposit.findFirst({
        where: { id: depositId, tenantId: principal.tenantId },
      });
      if (!deposit) {
        throw new NotFoundException('Deposit not found');
      }
      if ((deposit.status as DepositStatus) !== 'eligible_for_release') {
        throw new BadRequestException(
          'Deposit must be eligible_for_release before opening a refund dispatch',
        );
      }
      try {
        assertDepositTransition(deposit.status as DepositStatus, 'refund_pending_review');
      } catch (e) {
        throw new BadRequestException(e instanceof Error ? e.message : String(e));
      }
      const open = await tx.refundDispatch.findFirst({
        where: {
          depositId,
          tenantId: principal.tenantId,
          status: { notIn: ['rejected', 'completed_without_psp'] },
        },
      });
      if (open) {
        throw new ConflictException('Deposit already has an open refund dispatch');
      }

      await tx.deposit.update({
        where: { id: depositId },
        data: { status: 'refund_pending_review' },
      });
      const created = await tx.refundDispatch.create({
        data: {
          tenantId: principal.tenantId,
          depositId,
          amountPaise: deposit.amountPaise,
          status: 'pending_review',
          requestedBySubject: principal.subject,
          reviewNote: dto?.note ?? null,
        },
      });
      return this.toResponse(created);
    });
  }

  async approve(
    principal: AuthenticatedPrincipal,
    dispatchId: string,
    dto?: RefundDispatchNoteDto,
  ): Promise<RefundDispatchResponse> {
    assertFinanceStaff(principal);
    return this.prisma.$transaction(async (tx) => {
      const dispatch = await tx.refundDispatch.findFirst({
        where: { id: dispatchId, tenantId: principal.tenantId },
      });
      if (!dispatch) {
        throw new NotFoundException('Refund dispatch not found');
      }
      if (dispatch.status !== 'pending_review') {
        throw new BadRequestException('Only pending_review dispatches can be approved');
      }
      try {
        assertRefundDispatchTransition('pending_review', 'approved');
      } catch (e) {
        throw new BadRequestException(e instanceof Error ? e.message : String(e));
      }
      const deposit = await tx.deposit.findFirst({
        where: {
          id: dispatch.depositId,
          tenantId: principal.tenantId,
          status: 'refund_pending_review',
        },
      });
      if (!deposit) {
        throw new ConflictException(
          'Deposit is not awaiting review or does not belong to this tenant',
        );
      }
      try {
        assertDepositTransition(deposit.status as DepositStatus, 'refund_approved');
      } catch (e) {
        throw new BadRequestException(e instanceof Error ? e.message : String(e));
      }
      await tx.deposit.update({
        where: { id: deposit.id },
        data: { status: 'refund_approved' },
      });
      const updated = await tx.refundDispatch.update({
        where: { id: dispatchId },
        data: {
          status: 'approved',
          reviewedBySubject: principal.subject,
          reviewNote: dto?.note ?? dispatch.reviewNote,
          pspCompletionNote:
            'PSP disbursement intentionally deferred until Sprint 3.1B credentials.',
        },
      });
      return this.toResponse(updated);
    });
  }

  async reject(
    principal: AuthenticatedPrincipal,
    dispatchId: string,
    dto: RejectRefundDispatchDto,
  ): Promise<RefundDispatchResponse> {
    assertFinanceStaff(principal);
    return this.prisma.$transaction(async (tx) => {
      const dispatch = await tx.refundDispatch.findFirst({
        where: { id: dispatchId, tenantId: principal.tenantId },
      });
      if (!dispatch) {
        throw new NotFoundException('Refund dispatch not found');
      }
      if (dispatch.status !== 'pending_review') {
        throw new BadRequestException('Only pending_review dispatches can be rejected');
      }
      try {
        assertRefundDispatchTransition('pending_review', 'rejected');
      } catch (e) {
        throw new BadRequestException(e instanceof Error ? e.message : String(e));
      }
      const deposit = await tx.deposit.findFirst({
        where: {
          id: dispatch.depositId,
          tenantId: principal.tenantId,
          status: 'refund_pending_review',
        },
      });
      if (!deposit) {
        throw new ConflictException('Deposit state inconsistent with rejection');
      }
      try {
        assertDepositTransition(deposit.status as DepositStatus, 'eligible_for_release');
      } catch (e) {
        throw new BadRequestException(e instanceof Error ? e.message : String(e));
      }
      await tx.deposit.update({
        where: { id: deposit.id },
        data: { status: 'eligible_for_release' },
      });
      const updated = await tx.refundDispatch.update({
        where: { id: dispatchId },
        data: {
          status: 'rejected',
          rejectedReason: dto.reason,
          reviewedBySubject: principal.subject,
        },
      });
      return this.toResponse(updated);
    });
  }

  async completeWithoutPsp(
    principal: AuthenticatedPrincipal,
    dispatchId: string,
    dto?: CompleteRefundDispatchDto,
  ): Promise<RefundDispatchResponse> {
    assertFinanceStaff(principal);
    return this.prisma.$transaction(async (tx) => {
      const dispatch = await tx.refundDispatch.findFirst({
        where: { id: dispatchId, tenantId: principal.tenantId },
      });
      if (!dispatch) {
        throw new NotFoundException('Refund dispatch not found');
      }
      if (dispatch.status !== 'approved') {
        throw new BadRequestException('Only approved dispatches can be completed internally');
      }
      try {
        assertRefundDispatchTransition('approved', 'completed_without_psp');
      } catch (e) {
        throw new BadRequestException(e instanceof Error ? e.message : String(e));
      }
      const deposit = await tx.deposit.findFirst({
        where: {
          id: dispatch.depositId,
          tenantId: principal.tenantId,
          status: 'refund_approved',
        },
      });
      if (!deposit) {
        throw new ConflictException('Deposit must be refund_approved to settle dispatch');
      }
      try {
        assertDepositTransition(deposit.status as DepositStatus, 'refunded');
      } catch (e) {
        throw new BadRequestException(e instanceof Error ? e.message : String(e));
      }
      await tx.deposit.update({
        where: { id: deposit.id },
        data: { status: 'refunded' },
      });
      const baseNote = 'Ledger / PSP disbursement stubs only — no live refund RPC in Sprint 3.3A.';
      const updated = await tx.refundDispatch.update({
        where: { id: dispatchId },
        data: {
          status: 'completed_without_psp',
          completedAt: new Date(),
          pspCompletionNote: [baseNote, dto?.psp_note].filter(Boolean).join(' '),
        },
      });
      return this.toResponse(updated);
    });
  }
}
