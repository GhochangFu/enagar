import { IsArray, IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class PatchTenantServiceConfigDto {
  @IsOptional()
  @IsObject()
  fee_rule?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  required_documents?: unknown[];

  @IsOptional()
  @IsString()
  revenue_head_code?: string;
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
