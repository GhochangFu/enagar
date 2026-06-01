import { BOC_POLICIES, MUNICIPAL_SIGNOFF_POLICIES } from '@enagar/workflow';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsInt,
  Min,
} from 'class-validator';

import { PAYMENT_SCHEDULES } from '../admin-tenant-config.contracts';

export class PatchTenantServiceConfigDto {
  @IsOptional()
  @IsObject()
  fee_rule?: Record<string, unknown>;

  @IsOptional()
  @IsIn([...PAYMENT_SCHEDULES])
  payment_schedule?: (typeof PAYMENT_SCHEDULES)[number];

  @IsOptional()
  @IsObject()
  fee_lines?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  required_documents?: unknown[];

  @IsOptional()
  @IsString()
  revenue_head_code?: string;

  @IsOptional()
  @IsIn([...BOC_POLICIES])
  boc_policy?: (typeof BOC_POLICIES)[number];

  @IsOptional()
  @IsIn([...MUNICIPAL_SIGNOFF_POLICIES])
  municipal_signoff_policy?: (typeof MUNICIPAL_SIGNOFF_POLICIES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  municipal_signoff_threshold_paise?: number;
}

export class UpsertRevenueHeadDto {
  @IsString()
  code!: string;

  @IsObject()
  name!: Record<string, unknown>;

  @IsString()
  accounting_code!: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpsertAddressMasterDto {
  @IsOptional()
  @IsString()
  borough_code?: string;

  @IsOptional()
  @IsString()
  borough_name?: string;

  @IsString()
  ward_number!: string;

  @IsOptional()
  @IsString()
  ward_name?: string;

  @IsOptional()
  @IsString()
  mouza?: string;

  @IsString()
  locality_name!: string;

  @IsOptional()
  @IsString()
  pincode?: string;
}

export class ImportAddressMasterCsvDto {
  @IsString()
  csv!: string;

  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;
}

export class UpsertTariffDto {
  @IsString()
  code!: string;

  @IsString()
  category!: string;

  @IsObject()
  name!: Record<string, unknown>;

  @IsObject()
  rate_config!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
