import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export type LanguageCode = 'en' | 'bn' | 'hi';

export interface PinnedServicePreference {
  tenant_code: string;
  service_code: string;
}

export interface CitizenPreferencesResponse {
  pinned_tenant_codes: string[];
  pinned_services: PinnedServicePreference[];
}

export class RegisterCitizenDto {
  @ApiProperty({ example: '9876543210' })
  @IsString()
  @Matches(/^[6-9]\d{9}$/)
  mobile!: string;

  @ApiPropertyOptional({ example: 'Aritra Sen' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: ['en', 'bn', 'hi'], default: 'en' })
  @IsOptional()
  @IsIn(['en', 'bn', 'hi'])
  language_pref?: LanguageCode;
}

export class UpdateCitizenProfileDto {
  @ApiPropertyOptional({ example: 'Aritra Sen' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: '64/PARK-ST/12B' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  holding_number?: string;
}

export class UpdateCitizenLanguageDto {
  @ApiProperty({ enum: ['en', 'bn', 'hi'] })
  @IsIn(['en', 'bn', 'hi'])
  language_pref!: LanguageCode;
}

export class SelectTenantDto {
  @ApiProperty({ example: 'KMC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  tenant_code!: string;
}

export interface CitizenProfileResponse {
  id: string;
  keycloak_subject: string;
  tenant_id: string;
  tenant_code?: string;
  mobile: string;
  name: string | null;
  holding_number: string | null;
  language_pref: LanguageCode;
  selected_tenant_code?: string;
  pinned_tenant_codes: string[];
  pinned_services: PinnedServicePreference[];
}

export class PinnedServicePreferenceDto {
  @ApiProperty({ example: 'KMC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  tenant_code!: string;

  @ApiProperty({ example: 'birth-cert' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  service_code!: string;
}

/** Master Sprint 5.4 — Expo / FCM / web push subscription blob persisted for notification-worker fan-out. */
export class RegisterPushTokenDto {
  @ApiProperty({ enum: ['ios', 'android', 'web'] })
  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';

  @ApiProperty({
    description: 'Native push token or serialised Web Push `PushSubscription` JSON.',
    maxLength: 8192,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(8192)
  token!: string;
}

/** Sprint 4.16 — pinned ULBs (≤15) and favourite `{ tenant_code, service_code }` pairs (server-validated). */
export class PatchCitizenPreferencesDto {
  @ApiPropertyOptional({ description: 'Replace ordered favourite ULB codes.', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one pinned municipality is required' })
  @ArrayMaxSize(15)
  @ArrayUnique({ message: 'Duplicate municipality codes are not allowed' })
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  pinned_tenant_codes?: string[];

  @ApiPropertyOptional({
    description: 'Replace shortcut service pairs.',
    type: [PinnedServicePreferenceDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => PinnedServicePreferenceDto)
  pinned_services?: PinnedServicePreferenceDto[];
}

/** Sprint 2.2 hub dashboard — counts grouped per catalogued ULB. */
export interface CitizenHubDashboardMunicipalityBucket {
  tenant_id: string;
  tenant_code: string;
  theme_color: string;
  application_count: number;
  payment_count: number;
  grievance_count: number;
}

export interface CitizenHubDashboardResponse {
  generated_at: string;
  municipality_scope: string | null;
  municipalities: CitizenHubDashboardMunicipalityBucket[];
  /** Distinct active `service.code` values unioned across all operational ULBs (catalogue semantics). Sprint 4.16. */
  distinct_active_service_codes: number;
}

/** Persisted inbox row — API mirrors `notifications` table (Phase 4 backlog SLA breach pings). */
export type CitizenNotificationResponse = {
  id: string;
  type: string;
  title: string;
  body: string;
  deep_link: string | null;
  is_read: boolean;
  sent_at: string;
  read_at: string | null;
};
