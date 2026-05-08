import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { InitiatePaymentDto } from './dto';
import { PaymentsService } from './payments.service';

import type { PaymentResponse } from './dto';
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

  @Get()
  list(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<PaymentResponse[]> {
    return this.payments.list(principal);
  }

  @Get(':id')
  getById(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ): Promise<PaymentResponse> {
    return this.payments.getById(principal, id);
  }
}
