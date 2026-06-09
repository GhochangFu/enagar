import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { CitizenPayOnlineDto } from './dto/citizen-pay-online.dto';
import { LookupLeasesDto } from './dto/lookup-leases.dto';
import { QueryLeaseInvoicesDto } from './dto/query-invoices.dto';
import { RecordLeasePaymentDto } from './dto/record-payment.dto';
import { assertLeaseInvoiceStaffAccess } from './lease-invoices.roles';
import { LeaseInvoicesService } from './lease-invoices.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('lease-invoices')
@ApiBearerAuth()
@Controller('lease-invoices')
export class LeaseInvoicesController {
  constructor(private readonly service: LeaseInvoicesService) {}

  /**
   * Citizen-facing lookup. No staff role check — any authenticated principal
   * (including a lessor with the `citizen` role) can fetch the leases whose
   * `lessorPhone` matches the supplied phone. Declared **before** the
   * `:id` route so the literal `lookup` segment wins over the param matcher.
   */
  @Get('lookup')
  lookup(@Query() query: LookupLeasesDto) {
    return this.service.lookupLeasesByPhone(query.phone);
  }

  /**
   * Citizen-scoped online payment. Authorization is **ownership**: the
   * caller's `phone` must match the invoice's agreement `lessorPhone`. There
   * is no staff-role guard and no `tenantCode` path argument — the invoice's
   * tenant is resolved server-side from the lookup result.
   *
   * Declared **before** `:id/pay` so the literal `pay-as-citizen` segment
   * wins over the param matcher.
   */
  @Post(':id/pay-as-citizen')
  payAsCitizen(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: CitizenPayOnlineDto,
  ) {
    return this.service.citizenPayOnline(principal, id, dto.phone);
  }

  @Get()
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: QueryLeaseInvoicesDto,
  ) {
    assertLeaseInvoiceStaffAccess(principal);
    return this.service.listInvoices(principal.tenantCode!, query);
  }

  @Get(':id')
  get(@CurrentPrincipal() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    assertLeaseInvoiceStaffAccess(principal);
    return this.service.getInvoice(principal.tenantCode!, id);
  }

  @Post(':id/pay')
  pay(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: RecordLeasePaymentDto,
  ) {
    assertLeaseInvoiceStaffAccess(principal);
    return this.service.recordPayment(principal.tenantCode!, id, dto);
  }
}
