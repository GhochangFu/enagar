import { IsArray, IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertTenantDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  district!: string;

  @IsOptional()
  ward_count?: number;

  @IsString()
  theme_color!: string;

  @IsOptional()
  @IsString()
  logo_url?: string;

  @IsArray()
  languages_enabled!: unknown[];

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  inherit_default_services?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateImpersonationTokenDto {
  @IsString()
  tenant_code!: string;

  @IsString()
  reason!: string;
}
