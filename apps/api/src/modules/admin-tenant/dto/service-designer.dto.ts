import { IsObject, IsOptional } from 'class-validator';

import type { EnagarFormSchema } from '@enagar/forms';
import type { WorkflowDefinition } from '@enagar/workflow';

export class SaveServiceFormDraftDto {
  @IsObject()
  form_schema!: EnagarFormSchema;

  @IsOptional()
  @IsObject()
  ui_schema?: Record<string, unknown>;
}

export class SaveServiceWorkflowDraftDto {
  @IsObject()
  workflow!: WorkflowDefinition;
}
