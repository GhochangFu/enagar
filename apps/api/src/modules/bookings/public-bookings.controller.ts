import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/auth/public.decorator';

import { BookingsService } from './bookings.service';
import {
  BookingAssetSlotsQueryDto,
  BookingFleetAvailabilityQueryDto,
  BookingListAssetsQueryDto,
} from './dto/bookings.dto';

@ApiTags('bookings')
@Public()
@Controller('public/bookings')
export class PublicBookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('assets')
  @ApiOperation({
    summary:
      'List active bookable assets for a municipality (optional service_code scopes to linked halls)',
  })
  listAssets(@Query() query: BookingListAssetsQueryDto) {
    return this.bookings.listAssetsForTenant(query.tenant_code, query.service_code);
  }

  @Get('assets/:code/slots')
  @ApiOperation({ summary: 'Hourly slot grid for an asset (Sprint 8.1B)' })
  listSlots(@Param('code') assetCode: string, @Query() query: BookingAssetSlotsQueryDto) {
    return this.bookings.listAssetSlots(
      query.tenant_code,
      assetCode,
      query.from,
      query.to,
      query.service_code,
    );
  }

  @Get('fleet-availability')
  @ApiOperation({
    summary:
      'Pooled slot grid for health fleet services (ambulance/hearse) with available_units count (Sprint 8.5E)',
  })
  listFleetAvailability(@Query() query: BookingFleetAvailabilityQueryDto) {
    return this.bookings.listFleetAvailability(
      query.tenant_code,
      query.service_code,
      query.from,
      query.to,
    );
  }
}
