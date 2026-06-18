import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { paymentMethods, type PaymentMethod } from '../../payments/dto';

export class WaterMeterTenantQueryDto {
  @IsString()
  tenant_code!: string;
}

export class InitiateWaterMeterRechargeDto extends WaterMeterTenantQueryDto {
  @IsInt()
  @Min(100)
  @Max(100_000_00)
  amount_paise!: number;

  @IsIn(paymentMethods)
  method!: PaymentMethod;
}

export class UpsertWaterMeterAccountDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(80)
  meter_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  consumer_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  consumer_phone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  balance_paise?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  last_reading_litres?: number;

  @IsOptional()
  @IsString()
  last_reading_at?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ImportWaterMeterAccountsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertWaterMeterAccountDto)
  accounts!: UpsertWaterMeterAccountDto[];
}
