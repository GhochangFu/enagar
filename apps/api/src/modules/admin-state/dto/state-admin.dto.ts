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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  service_category_codes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  grievance_category_codes?: string[];

  @IsOptional()
  @IsString()
  tenant_admin_username?: string;

  @IsOptional()
  @IsString()
  tenant_admin_email?: string;

  @IsOptional()
  @IsString()
  tenant_admin_password?: string;

  @IsOptional()
  @IsString()
  tenant_admin_first_name?: string;

  @IsOptional()
  @IsString()
  tenant_admin_last_name?: string;
}

export class CreateImpersonationTokenDto {
  @IsString()
  tenant_code!: string;

  @IsString()
  reason!: string;
}

export class UpsertGlobalServiceTemplateDto {
  @IsString()
  code!: string;

  @IsString()
  category_code!: string;

  @IsObject()
  name!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  description?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  workflow_pattern?: string;

  @IsOptional()
  default_sla_days?: number;

  @IsOptional()
  @IsObject()
  fee_config?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  required_documents?: unknown[];

  @IsOptional()
  @IsObject()
  form_schema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  workflow_config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  lifecycle_status?: string;

  @IsOptional()
  @IsString()
  curator_notes?: string;
}

export class GlobalServiceLifecycleDto {
  @IsString()
  code!: string;

  @IsString()
  action!: string;
}

export class UpsertStateIntegrationDto {
  @IsString()
  provider_key!: string;

  @IsString()
  environment!: string;

  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  required_docs?: unknown[];
}
