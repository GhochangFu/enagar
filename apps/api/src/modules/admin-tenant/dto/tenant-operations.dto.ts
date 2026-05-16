import { IsArray, IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertTenantBannerDto {
  @IsString()
  code!: string;

  @IsString()
  severity!: string;

  @IsObject()
  title!: Record<string, unknown>;

  @IsObject()
  body!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  link_url?: string;

  @IsOptional()
  @IsString()
  starts_at?: string;

  @IsOptional()
  @IsString()
  ends_at?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class PatchTenantSettingsDto {
  @IsOptional()
  @IsObject()
  branding?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  feature_flags?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  languages_enabled?: unknown[];

  @IsOptional()
  @IsString()
  default_language?: string;

  @IsOptional()
  @IsString()
  contact_phone?: string;

  @IsOptional()
  @IsString()
  contact_email?: string;
}

export class UpsertNotificationTemplateDto {
  @IsString()
  code!: string;

  @IsString()
  channel!: string;

  @IsString()
  locale!: string;

  @IsString()
  trigger!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsArray()
  variables?: unknown[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpsertKbArticleDto {
  @IsString()
  slug!: string;

  @IsObject()
  title!: Record<string, unknown>;

  @IsObject()
  body!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  tags?: unknown[];

  @IsString()
  status!: string;
}

export class UpsertStaffDto {
  @IsString()
  keycloak_user_id!: string;

  @IsString()
  username!: string;

  @IsString()
  display_name!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsArray()
  role_codes!: unknown[];

  @IsOptional()
  @IsString()
  ward_number?: string;
}

export class UpsertRoleStageMapDto {
  @IsString()
  workflow_code!: string;

  @IsString()
  stage_code!: string;

  @IsString()
  role_code!: string;

  @IsOptional()
  @IsBoolean()
  can_view?: boolean;

  @IsOptional()
  @IsBoolean()
  can_act?: boolean;
}
