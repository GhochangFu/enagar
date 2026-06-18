import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { paymentMethods } from '../../payments/dto';

export const evConnectorTypes = ['CCS2', 'TYPE2', 'CHADEMO'] as const;
export type EvConnectorType = (typeof evConnectorTypes)[number];

export class EvChargingTenantQueryDto {
  @IsString()
  tenant_code!: string;
}

export class EvChargingCreateHoldDto {
  @IsString()
  tenant_code!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(20)
  vehicle_number!: string;
}

export class EvChargingSessionActionDto extends EvChargingTenantQueryDto {}

export class InitiateEvSessionPaymentDto extends EvChargingTenantQueryDto {
  @IsIn(paymentMethods)
  method!: 'upi' | 'card' | 'netbanking';
}

export class ConfirmEvSessionPaymentDto extends EvChargingTenantQueryDto {
  @IsOptional()
  @IsString()
  payment_id?: string;
}

export class UpsertEvChargerDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsObject()
  name!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  location?: Record<string, unknown>;

  @IsIn(evConnectorTypes)
  connector_type!: EvConnectorType;

  @IsNumber()
  @Min(0.01)
  max_kw!: number;

  @IsInt()
  @Min(1)
  rate_paise_per_kwh!: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
