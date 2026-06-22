import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SetupAssistantMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  message!: string;
}
