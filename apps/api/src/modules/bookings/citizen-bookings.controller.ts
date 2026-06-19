import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CITIZEN_MUNICIPALITY_SCOPE_HEADER } from '../../common/auth/citizen-scope';
import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';

import { BookingsDepositPaymentService } from './bookings-deposit-payment.service';
import { BookingsService } from './bookings.service';
import {
  BookingCancelDto,
  BookingConfirmHoldDto,
  BookingCreateHoldDto,
  BookingFleetQuoteDto,
  BookingLinkApplicationDto,
  BookingListQueryDto,
  BookingQuoteDto,
  InitiateBookingHoldPaymentDto,
} from './dto/bookings.dto';

import type { ApplicationReadScope } from '../applications/dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

function readScopeFromHeader(value?: string): ApplicationReadScope | undefined {
  const trimmed = value?.trim();
  return trimmed ? { municipalityTenantCode: trimmed } : undefined;
}

@ApiTags('bookings')
@ApiBearerAuth()
@ApiHeader({
  name: CITIZEN_MUNICIPALITY_SCOPE_HEADER,
  description: 'Active ULB when using a portal (WBPORTAL) citizen JWT.',
  required: false,
})
@Controller('citizen/bookings')
export class CitizenBookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly bookingPayments: BookingsDepositPaymentService,
  ) {}

  @Post('quote')
  @ApiOperation({ summary: 'Quote rent and deposit for a slot range (Sprint 8.1B)' })
  quote(@Body() dto: BookingQuoteDto) {
    return this.bookings.quote(dto);
  }

  @Post('fleet/quote')
  @ApiOperation({ summary: 'Quote health fleet slot without selecting a vehicle (Sprint 8.5E)' })
  fleetQuote(@Body() dto: BookingFleetQuoteDto) {
    return this.bookings.fleetQuote(dto);
  }

  @Post('holds')
  @ApiOperation({ summary: 'Place a hold on a free slot (Sprint 8.1B)' })
  createHold(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() dto: BookingCreateHoldDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.bookings.createHold(principal, dto, municipalityTenantCode);
  }

  @Post('holds/:id/initiate-payment')
  @ApiOperation({ summary: 'Initiate stub payment for booking security deposit (Sprint 8.1C)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique key for this booking deposit payment attempt.',
  })
  initiateHoldPayment(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') holdId: string,
    @Body() dto: InitiateBookingHoldPaymentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.bookingPayments.initiateForHold(
      principal,
      holdId,
      dto,
      idempotencyKey,
      municipalityTenantCode,
    );
  }

  @Post('holds/:id/link-application')
  @ApiOperation({
    summary: 'Link a community-hall application to a hold after fees are paid (clerk review path)',
  })
  linkApplication(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') holdId: string,
    @Body() dto: BookingLinkApplicationDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.bookings.linkApplicationToHold(
      principal,
      holdId,
      dto.application_id,
      municipalityTenantCode,
    );
  }

  @Post('holds/:id/confirm')
  @ApiOperation({ summary: 'Confirm a hold after deposit capture (Sprint 8.1C)' })
  confirmHold(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') holdId: string,
    @Body() dto: BookingConfirmHoldDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.bookings.confirmHold(principal, holdId, dto, municipalityTenantCode);
  }

  @Get()
  @ApiOperation({ summary: 'List citizen bookings (Sprint 8.5F2)' })
  list(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() query: BookingListQueryDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.bookings.listReservationsForCitizen(principal, readScopeFromHeader(municipalityTenantCode), {
      status: query.status,
      limit: query.limit,
    });
  }

  @Get(':ref/confirmation.pdf')
  @Header('content-type', 'application/pdf')
  @ApiOperation({
    summary:
      'Download booking confirmation PDF (Sprint 8.1D). Use reservation id or booking no with / as --',
  })
  confirmationPdf(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('ref') ref: string,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.bookings.exportConfirmationPdf(principal, ref, municipalityTenantCode).then(
      (buffer) =>
        new StreamableFile(buffer, {
          type: 'application/pdf',
          disposition: 'attachment; filename="booking-confirmation.pdf"',
        }),
    );
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel own booking (Sprint 8.1B)' })
  cancel(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param('id') reservationId: string,
    @Body() dto: BookingCancelDto,
    @Headers(CITIZEN_MUNICIPALITY_SCOPE_HEADER) municipalityTenantCode?: string,
  ) {
    return this.bookings.cancelReservation(principal, reservationId, dto, municipalityTenantCode);
  }
}
