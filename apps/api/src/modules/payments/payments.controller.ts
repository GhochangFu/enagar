import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { InitiatePaymentDto, StubCompletePaymentDto } from './dto';
import { PaymentsService } from './payments.service';

import type { LedgerSettlementDto, PaymentResponse, ReceiptCitizenDto } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('initiate')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this citizen payment initiation attempt.',
  })
  initiate(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: InitiatePaymentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<PaymentResponse> {
    return this.payments.initiate(principal, dto, idempotencyKey);
  }

  @Post('stub/complete')
  @ApiOperation({
    summary: 'Complete deterministic stub capture (Sprint 3.2)',
    description:
      'Simulates gateway capture for the stub PSP. Blocked in production unless ALLOW_STUB_PAYMENT_SETTLEMENT=true. Issues receipt + GL postings when persisting through Postgres.',
  })
  completeStub(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: StubCompletePaymentDto,
  ): Promise<LedgerSettlementDto> {
    return this.payments.completeStubPayment(principal, dto);
  }

  @Get('reconciliation/export')
  @ApiOperation({
    summary: 'CSV export of GL postings for reconciliation (RBAC)',
    description:
      'Filters `gl_postings.posted_at` to the India/Kolkata business calendar day (query `business_date`).',
  })
  @ApiQuery({
    name: 'business_date',
    required: true,
    example: '2026-05-11',
  })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="enagar-reconciliation-export.csv"')
  reconciliationExport(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query('business_date') businessDate: string | undefined,
  ): Promise<string> {
    const normalized = businessDate?.trim();
    if (!normalized) {
      throw new BadRequestException('business_date query parameter is required');
    }
    return this.payments.exportReconciliationCsv(principal, normalized);
  }

  @Get()
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<PaymentResponse[]> {
    return this.payments.list(principal);
  }

  @Get(':paymentId/receipt')
  @ApiOperation({
    summary: 'Citizen receipt issuance metadata for a settled payment',
  })
  receiptForPayment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('paymentId') paymentId: string,
  ): Promise<ReceiptCitizenDto> {
    return this.payments.receiptForOwnedPayment(principal, paymentId);
  }

  @Get(':id')
  getById(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ): Promise<PaymentResponse> {
    return this.payments.getById(principal, id);
  }
}
