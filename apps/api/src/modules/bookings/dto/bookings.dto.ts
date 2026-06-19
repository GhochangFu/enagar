import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

import { paymentMethods } from '../../payments/dto';

import { isHealthFleetServiceCode } from '../health-fleet.util';

import type { PaymentMethod } from '../../payments/dto';

export class BookingTenantQueryDto {
  @IsString()
  tenant_code!: string;
}

export class BookingListAssetsQueryDto extends BookingTenantQueryDto {
  /** When set, return only assets linked on this tenant service (e.g. community-hall). */
  @IsOptional()
  @IsString()
  service_code?: string;
}

export class BookingAssetSlotsQueryDto extends BookingTenantQueryDto {
  @IsString()
  from!: string;

  @IsString()
  to!: string;

  /** When set, only assets linked on the tenant service may be queried. */
  @IsOptional()
  @IsString()
  service_code?: string;
}

export class BookingFleetAvailabilityQueryDto extends BookingTenantQueryDto {
  @IsString()
  service_code!: string;

  @IsString()
  from!: string;

  @IsString()
  to!: string;
}

export class BookingFleetQuoteDto {
  @IsString()
  tenant_code!: string;

  @IsString()
  service_code!: string;

  @IsString()
  starts_at!: string;

  @IsString()
  ends_at!: string;
}

export class BookingQuoteDto {
  @IsString()
  tenant_code!: string;

  @IsOptional()
  @IsString()
  service_code?: string;

  @IsString()
  asset_code!: string;

  @IsString()
  starts_at!: string;

  @IsString()
  ends_at!: string;
}

export class BookingCreateHoldDto {
  @IsString()
  tenant_code!: string;

  @IsOptional()
  @IsString()
  service_code?: string;

  /** Required for hall/LED; omit for health fleet pool (ambulance/hearse). */
  @ValidateIf((dto: BookingCreateHoldDto) => !isHealthFleetServiceCode(dto.service_code))
  @IsString()
  asset_code?: string;

  @IsString()
  starts_at!: string;

  @IsString()
  ends_at!: string;

  @IsOptional()
  @IsString()
  holder_name?: string;

  @IsOptional()
  @IsString()
  holder_mobile?: string;

  @IsOptional()
  @IsBoolean()
  emergency?: boolean;

  @IsOptional()
  @IsObject()
  pickup_address?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  bpl_declared?: boolean;
}

export class BookingConfirmHoldDto {
  @IsOptional()
  @IsUUID()
  deposit_id?: string;

  @IsOptional()
  @IsUUID()
  application_id?: string;
}

export class BookingLinkApplicationDto {
  @IsUUID()
  application_id!: string;
}

export class InitiateBookingHoldPaymentDto {
  @IsString()
  @IsIn(paymentMethods)
  method!: PaymentMethod;

  /** When true, stub payment amount includes hourly rent plus security deposit (default: deposit only). */
  @IsOptional()
  @IsBoolean()
  include_rent?: boolean;
}

export class BookingCancelDto {
  @IsOptional()
  @IsString()
  cancel_reason?: string;
}

export class BookingListQueryDto {
  @IsOptional()
  @IsIn(['confirmed', 'hold', 'cancelled'])
  status?: 'confirmed' | 'hold' | 'cancelled';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
