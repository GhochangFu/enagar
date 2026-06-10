import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewDocumentDto {
  @IsEnum(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
