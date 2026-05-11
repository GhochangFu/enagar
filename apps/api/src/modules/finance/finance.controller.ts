import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import {
  CompleteRefundDispatchDto,
  CreateChallanDto,
  CreateDepositDto,
  ForfeitDepositDto,
  RejectRefundDispatchDto,
  RefundDispatchNoteDto,
  WaiveChallanDto,
} from './dto';
import { FinanceChallansService } from './finance-challans.service';
import { FinanceDepositsService } from './finance-deposits.service';
import { FinanceRefundDispatchesService } from './finance-refund-dispatches.service';

import type { ChallanResponse, DepositResponse, RefundDispatchResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('finance (Sprint 3.3A — deposits, refund approvals, challans)')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly deposits: FinanceDepositsService,
    private readonly refunds: FinanceRefundDispatchesService,
    private readonly challans: FinanceChallansService,
  ) {}

  @Post('deposits')
  @ApiOperation({ summary: 'Record a refundable deposit (staff finance roles)' })
  createDeposit(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateDepositDto,
  ): Promise<DepositResponse> {
    return this.deposits.create(principal, dto);
  }

  @Get('deposits/:id')
  getDeposit(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') depositId: string,
  ): Promise<DepositResponse> {
    return this.deposits.getById(principal, depositId);
  }

  @Post('deposits/:id/mark-eligible-for-release')
  @ApiOperation({ summary: 'Move deposit held → eligible_for_release' })
  markDepositEligible(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') depositId: string,
  ): Promise<DepositResponse> {
    return this.deposits.markEligibleForRelease(principal, depositId);
  }

  @Post('deposits/:id/forfeit')
  forfeitDeposit(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') depositId: string,
    @Body() dto: ForfeitDepositDto,
  ): Promise<DepositResponse> {
    return this.deposits.forfeit(principal, depositId, dto);
  }

  @Post('deposits/:depositId/refund-dispatch')
  @ApiOperation({ summary: 'Open refund workflow (deposit must be eligible_for_release)' })
  createRefundDispatch(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('depositId') depositId: string,
    @Body() dto: RefundDispatchNoteDto = {},
  ): Promise<RefundDispatchResponse> {
    return this.refunds.submitFromEligibleDeposit(principal, depositId, dto);
  }

  @Get('refund-dispatches/:id')
  getRefundDispatch(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') dispatchId: string,
  ): Promise<RefundDispatchResponse> {
    return this.refunds.findById(principal, dispatchId);
  }

  @Post('refund-dispatches/:id/approve')
  approveRefund(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') dispatchId: string,
    @Body() dto: RefundDispatchNoteDto = {},
  ): Promise<RefundDispatchResponse> {
    return this.refunds.approve(principal, dispatchId, dto);
  }

  @Post('refund-dispatches/:id/reject')
  rejectRefund(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') dispatchId: string,
    @Body() dto: RejectRefundDispatchDto,
  ): Promise<RefundDispatchResponse> {
    return this.refunds.reject(principal, dispatchId, dto);
  }

  @Post('refund-dispatches/:id/complete-internal')
  @ApiOperation({
    summary: 'Complete refund dispatch without PSP (Sprint 3.3A stub)',
    description:
      'Marks completed_without_psp + deposit refunded — no aggregator RPC until Sprint 3.1B.',
  })
  completeRefundInternal(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') dispatchId: string,
    @Body() dto: CompleteRefundDispatchDto = {},
  ): Promise<RefundDispatchResponse> {
    return this.refunds.completeWithoutPsp(principal, dispatchId, dto);
  }

  @Post('challans')
  issueChallan(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: CreateChallanDto,
  ): Promise<ChallanResponse> {
    return this.challans.create(principal, dto);
  }

  @Get('challans/:id')
  getChallan(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') challanId: string,
  ): Promise<ChallanResponse> {
    return this.challans.getById(principal, challanId);
  }

  @Post('challans/:id/mark-paid-internal')
  @ApiOperation({ summary: 'Mark challan paid without linking a PSP settlement' })
  markChallanPaidInternal(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') challanId: string,
  ): Promise<ChallanResponse> {
    return this.challans.markPaidWithoutPaymentLink(principal, challanId);
  }

  @Post('challans/:id/waive')
  waiveChallan(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') challanId: string,
    @Body() dto: WaiveChallanDto,
  ): Promise<ChallanResponse> {
    return this.challans.waive(principal, challanId, dto);
  }

  @Post('challans/:id/reopen-after-dispute')
  reopenDisputed(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') challanId: string,
  ): Promise<ChallanResponse> {
    return this.challans.reopenDisputed(principal, challanId);
  }
}
