import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export type LanguageCode = 'en' | 'bn' | 'hi';

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
}
