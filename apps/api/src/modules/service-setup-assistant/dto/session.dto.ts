import { IsIn, IsInt, Min, Max } from 'class-validator';

import type { SetupAssistantScope } from '@enagar/types';

export class CreateSetupSessionDto {
  @IsIn(['full', 'form', 'workflow', 'payment', 'review'])
  scope!: SetupAssistantScope;
}

export class PatchSetupSessionStepDto {
  @IsInt()
  @Min(1)
  @Max(5)
  current_step!: number;
}
