import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  MAX_HOARDING_DURATION_MONTHS,
  MAX_HOARDING_MATRIX_ROWS,
  MIN_HOARDING_DURATION_MONTHS,
} from '../hoarding-rate.util';

export class HoardingWardRateDto {
  @IsString()
  ward_code!: string;

  @IsInt()
  @Min(0)
  rate_paise_per_sqft_per_month!: number;
}

export class ReplaceHoardingRateMatrixDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  flat_rate_paise_per_sqft_per_month?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_HOARDING_MATRIX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => HoardingWardRateDto)
  ward_rates?: HoardingWardRateDto[];
}

export class PreviewHoardingQuoteDto {
  @IsString()
  ward_code!: string;

  @IsNumber()
  @Min(0.01)
  width_ft!: number;

  @IsNumber()
  @Min(0.01)
  height_ft!: number;

  @IsInt()
  @Min(MIN_HOARDING_DURATION_MONTHS)
  @Max(MAX_HOARDING_DURATION_MONTHS)
  duration_months!: number;
}

export class CitizenHoardingTenantQueryDto {
  @IsString()
  tenant_code!: string;
}

export class CitizenHoardingQuoteDto extends PreviewHoardingQuoteDto {
  @IsString()
  tenant_code!: string;
}
