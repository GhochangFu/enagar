import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { paymentMethods } from '../../payments/dto';

export class UpsertSmartZoneDto {
  @IsString()
  code!: string;

  @IsObject()
  name!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  ward_number?: string;

  @IsOptional()
  @IsObject()
  geo?: Record<string, unknown>;

  @IsInt()
  @Min(1)
  capacity_bays!: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  pricing_matrix?: Record<string, unknown>;
}

export class SmartParkingQuoteDto {
  @IsString()
  tenant_code!: string;

  @IsString()
  zone_code!: string;

  @IsString()
  bay_code!: string;

  @IsString()
  starts_at!: string;

  @IsString()
  ends_at!: string;

  @IsOptional()
  @IsString()
  vehicle_type?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(20)
  vehicle_number!: string;
}

export class SmartParkingZonesQueryDto {
  @IsString()
  tenant_code!: string;
}

export class SmartParkingZoneBaysQueryDto extends SmartParkingZonesQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class SmartParkingCreateHoldDto extends SmartParkingQuoteDto {}

export class InitiateSmartParkingHoldPaymentDto {
  @IsIn(paymentMethods)
  method!: 'upi' | 'card' | 'netbanking';
}

export class ConfirmSmartParkingHoldDto {
  @IsOptional()
  @IsString()
  payment_id?: string;
}

export class UpsertParkingBayDto {
  @IsString()
  zone_code!: string;

  @IsString()
  bay_code!: string;

  @IsOptional()
  @IsIn(['FREE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'])
  status?: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE';
}

export class BulkCreateParkingBaysDto {
  @IsString()
  zone_code!: string;

  @IsInt()
  @Min(1)
  count!: number;

  @IsOptional()
  @IsString()
  prefix?: string;
}

export class UpdateParkingBayDto {
  @IsOptional()
  @IsIn(['FREE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'])
  status?: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE';
}
