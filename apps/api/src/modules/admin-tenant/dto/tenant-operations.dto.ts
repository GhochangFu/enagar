import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

function toOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  return String(value);
}

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

export class RequeueKbArticleDto {
  @IsString()
  slug!: string;
}

export class CreateBrandingAssetUploadIntentDto {
  @IsString()
  code!: string;

  @IsString()
  kind!: string;

  @IsString()
  mime_type!: string;

  @IsString()
  size_bytes!: string;

  @IsString()
  original_name!: string;
}

export class UpsertBrandingAssetDto {
  @IsString()
  code!: string;

  @IsString()
  kind!: string;

  @IsString()
  storage_key!: string;

  @IsString()
  public_url!: string;

  @IsString()
  mime_type!: string;

  @IsString()
  size_bytes!: string;

  @IsOptional()
  @IsString()
  width?: string;

  @IsOptional()
  @IsString()
  height?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpsertBookableAssetDto {
  @IsString()
  code!: string;

  @IsObject()
  name!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  asset_type?: string;

  @IsOptional()
  @IsObject()
  location?: Record<string, unknown>;

  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  capacity?: string;

  @IsOptional()
  @IsString()
  rate_unit?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  base_rate_paise?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  security_deposit_paise?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalString(value))
  @IsString()
  slot_step_minutes?: string;

  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpsertBookableAvailabilityDto {
  @IsString()
  asset_code!: string;

  @IsString()
  kind!: string;

  @IsString()
  starts_at!: string;

  @IsString()
  ends_at!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkBookableAvailabilityDto {
  @IsString()
  asset_code!: string;

  @IsString()
  @IsIn(['available', 'blackout'])
  kind!: 'available' | 'blackout';

  /** IST civil dates inclusive, YYYY-MM-DD. */
  @IsString()
  from_date!: string;

  @IsString()
  to_date!: string;

  /** IST local times HH:mm (e.g. 09:00). */
  @IsString()
  start_time!: string;

  @IsString()
  end_time!: string;

  /** IST weekday numbers: 0 = Sunday … 6 = Saturday. Default Mon–Fri when omitted. */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @IsOptional()
  @IsString()
  note?: string;

  /** When true (default), skip windows that already exist for the same slot. */
  @IsOptional()
  @IsBoolean()
  skip_existing?: boolean;
}

export class UpsertBookingReservationDto {
  @IsString()
  asset_code!: string;

  @IsString()
  holder_name!: string;

  @IsOptional()
  @IsString()
  holder_mobile?: string;

  @IsOptional()
  @IsString()
  booking_no?: string;

  @IsOptional()
  @IsString()
  citizen_id?: string;

  @IsOptional()
  @IsString()
  deposit_id?: string;

  @IsOptional()
  @IsString()
  docket_no?: string;

  @IsString()
  starts_at!: string;

  @IsString()
  ends_at!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;
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

export class CreateStaffInviteDto {
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

  @IsArray()
  role_codes!: unknown[];

  @IsOptional()
  @IsString()
  ward_number?: string;
}

/** Tenant Admin — create staff with Keycloak identity (no email invite). */
export class CreateStaffDto {
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

  @IsArray()
  role_codes!: unknown[];

  @IsOptional()
  @IsString()
  ward_number?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsArray()
  designation_ids?: string[];
}

export class ImportStaffCsvDto {
  @IsString()
  csv!: string;

  @IsOptional()
  dry_run?: boolean;
}

export class UpdateStaffInviteDto {
  @IsString()
  invite_id!: string;

  @IsString()
  action!: string;
}

export class DeskBocResolutionDto {
  @IsString()
  resolution_number!: string;

  @IsString()
  resolution_date!: string;
}

export class DeskApplicationTransitionDto {
  @IsString()
  verb!: string;

  @IsOptional()
  @IsString()
  comment?: string;

  /** When `boc_policy` is `officer_may_require` at `technical-scrutiny`, sets `requires_boc_resolution`. */
  @IsOptional()
  @IsBoolean()
  require_boc?: boolean;

  @IsOptional()
  @Type(() => DeskBocResolutionDto)
  @ValidateNested()
  boc_resolution?: DeskBocResolutionDto;
}

export class DeskWorkOrderAssignDto {
  @IsOptional()
  @IsString()
  vendor_id?: string | null;

  @IsOptional()
  @IsString()
  assigned_user_id?: string | null;
}

export class DeskGrievanceAssignDto {
  @IsString()
  user_id!: string;
}

export class DeskGrievanceStatusDto {
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class DeskCommentDto {
  @IsString()
  body!: string;
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
