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

import { CITIZEN_MUNICIPALITY_SCOPE_HEADER } from '../../common/auth/citizen-scope';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { InitiatePaymentDto, StubCompletePaymentDto } from './dto';
import { PaymentsService } from './payments.service';

import type { LedgerSettlementDto, PaymentResponse, ReceiptCitizenDto } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { ApplicationReadScope } from '../applications/dto';

function readScopeFromHeader(value?: string): ApplicationReadScope | undefined {
  const trimmed = value?.trim();
  return trimmed ? { municipalityTenantCode: trimmed } : undefined;
}

@ApiTags('payments')
@ApiBearerAuth()
@ApiHeader({
  name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  description:
    'Optional ULB scope for portal JWT on read routes (hub: omit; workspace: municipal code). Ignored for non-portal principals.',
  required: false,
})
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
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): Promise<PaymentResponse[]> {
    return this.payments.list(principal, readScopeFromHeader(municipalityTenantCode));
  }

  @Get(':paymentId/receipt')
  @ApiOperation({
    summary: 'Citizen receipt issuance metadata for a settled payment',
  })
  receiptForPayment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('paymentId') paymentId: string,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): Promise<ReceiptCitizenDto> {
    return this.payments.receiptForOwnedPayment(
      principal,
      paymentId,
      readScopeFromHeader(municipalityTenantCode),
    );
  }

  @Get(':id')
  getById(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ): Promise<PaymentResponse> {
    return this.payments.getById(principal, id, readScopeFromHeader(municipalityTenantCode));
  }
}
