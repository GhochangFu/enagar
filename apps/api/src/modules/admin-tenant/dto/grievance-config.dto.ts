import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LocalizedLabelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  en!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  hi?: string;
}

export class UpsertGrievanceCategoryDto {
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
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  global_category_code?: string | null;
}

export class PatchGrievanceCategoryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedLabelDto)
  name?: LocalizedLabelDto;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpsertGrievanceSubtypeDto {
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

export class PatchGrievanceSubtypeDto {
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

export class SlaPolicyRowDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category_match?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  grievance_priority_match?: string | null;

  @IsInt()
  @Min(1)
  @Max(24 * 365)
  hours_to_resolve!: number;
}

export class ReplaceSlaPoliciesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SlaPolicyRowDto)
  policies!: SlaPolicyRowDto[];
}

export class GrievanceRoutingRuleRowDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsInt()
  @Min(0)
  @Max(9999)
  sort_order!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category_match?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  grievance_priority_match?: string | null;

  @IsOptional()
  @IsUUID('4')
  ward_id?: string | null;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  target_role_code!: string;

  @IsOptional()
  @IsUUID('4')
  assign_user_id?: string | null;
}

export class ReplaceGrievanceRoutingRulesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GrievanceRoutingRuleRowDto)
  rules!: GrievanceRoutingRuleRowDto[];
}
