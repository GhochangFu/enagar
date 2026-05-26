import { IsBoolean, IsIn } from 'class-validator';

export class ChatbotConsentDto {
  @IsIn(['llm', 'kb_only'])
  mode!: 'llm' | 'kb_only';

  @IsBoolean()
  accepted!: boolean;
}
