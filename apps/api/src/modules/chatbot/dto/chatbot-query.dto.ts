import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChatbotQueryDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  session_id?: string;

  @IsOptional()
  @IsIn(['en', 'bn', 'hi'])
  language?: 'en' | 'bn' | 'hi';
}
