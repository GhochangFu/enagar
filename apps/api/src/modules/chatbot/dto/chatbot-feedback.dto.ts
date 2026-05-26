import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ChatbotFeedbackDto {
  @IsString()
  @MaxLength(64)
  session_id!: string;

  @IsInt()
  @IsIn([1, -1])
  rating!: 1 | -1;

  @IsOptional()
  @IsUUID()
  assistant_message_id?: string;
}
