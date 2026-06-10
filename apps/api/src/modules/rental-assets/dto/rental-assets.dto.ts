import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export enum RentalAssetType {
  HOARDING = 'HOARDING',
  MARKET_STALL = 'MARKET_STALL',
  LAND = 'LAND',
  COMMUNITY_HALL_LONG_TERM = 'COMMUNITY_HALL_LONG_TERM',
  OTHER = 'OTHER',
}

export enum RentalAssetStatus {
  AVAILABLE = 'AVAILABLE',
  RENTED = 'RENTED',
  MAINTENANCE = 'MAINTENANCE',
  RESERVED = 'RESERVED',
}

export enum RatePeriod {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum LeaseAgreementStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
}

export class CreateRentalAssetDto {
  @IsEnum(RentalAssetType)
  assetType!: RentalAssetType;

  @IsObject()
  name!: Record<string, string>;

  @IsObject()
  location!: Record<string, unknown>;

  @IsInt()
  @Min(0)
  baseLeaseRatePaise!: number;

  @IsEnum(RatePeriod)
  ratePeriod!: RatePeriod;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateLeaseAgreementDto {
  @IsString()
  assetId!: string;

  @IsString()
  @ValidateIf((o) => o.tradeLicenseNo === undefined || o.tradeLicenseNo === '')
  tradeLicenseNo!: string;

  @IsString()
  lessorName!: string;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @IsOptional()
  @IsInt()
  @Min(0)
  securityDepositPaise?: number;

  @IsOptional()
  @IsString()
  agreementDocumentKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  lessorPhone?: string;
}

export class UpdateLeaseAgreementDto {
  /**
   * Optional patch payload for a lease agreement. Only `lessorPhone` is exposed
   * today — name/license/rate changes should go through a deliberate
   * amendment flow with audit, not a silent overwrite from the grid.
   */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  lessorPhone?: string;
}

export class UpdateLeaseStatusDto {
  @IsEnum(LeaseAgreementStatus)
  status!: LeaseAgreementStatus;
}

export class QueryRentalAssetsDto {
  @IsOptional()
  @IsEnum(RentalAssetStatus)
  status?: RentalAssetStatus;
}
