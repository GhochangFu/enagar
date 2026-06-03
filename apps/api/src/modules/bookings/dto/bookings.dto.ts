import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

import { paymentMethods } from '../../payments/dto';

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

  @IsString()
  asset_code!: string;

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
