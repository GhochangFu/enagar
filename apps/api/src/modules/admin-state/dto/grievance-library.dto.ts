import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { LocalizedLabelDto } from '../../admin-tenant/dto/grievance-config.dto';

export class UpsertGlobalGrievanceCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code!: string;

  @ValidateNested()
  @Type(() => LocalizedLabelDto)
  name!: LocalizedLabelDto;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  docket_code?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class PatchGlobalGrievanceCategoryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedLabelDto)
  name?: LocalizedLabelDto;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  docket_code?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpsertGlobalGrievanceSubtypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code!: string;

  @ValidateNested()
  @Type(() => LocalizedLabelDto)
  name!: LocalizedLabelDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class PatchGlobalGrievanceSubtypeDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedLabelDto)
  name?: LocalizedLabelDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class AdoptGrievanceCatalogueDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  category_codes!: string[];
}
