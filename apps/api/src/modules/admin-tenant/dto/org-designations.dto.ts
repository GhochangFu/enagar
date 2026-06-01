import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
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

import { LocalizedLabelDto } from './grievance-config.dto';

export class UpsertTenantDepartmentDto {
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

export class PatchTenantDepartmentDto {
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

export class UpsertTenantDesignationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  code!: string;

  @ValidateNested()
  @Type(() => LocalizedLabelDto)
  name!: LocalizedLabelDto;

  @IsIn(['department', 'municipality'])
  scope!: 'department' | 'municipality';

  @IsOptional()
  @IsUUID()
  department_id?: string | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_department_head?: boolean;

  @IsOptional()
  @IsBoolean()
  can_reject_municipal?: boolean;
}

export class PatchTenantDesignationDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedLabelDto)
  name?: LocalizedLabelDto;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_department_head?: boolean;

  @IsOptional()
  @IsBoolean()
  can_reject_municipal?: boolean;
}

export class UpsertDesignationStageMapDto {
  @IsString()
  workflow_code!: string;

  @IsString()
  stage_code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  designation_code!: string;

  @IsOptional()
  @IsBoolean()
  can_view?: boolean;

  @IsOptional()
  @IsBoolean()
  can_act?: boolean;
}

export class ReplaceUserDesignationsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  designation_ids!: string[];
}
