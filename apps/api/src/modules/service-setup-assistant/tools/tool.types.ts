import type { AuthenticatedPrincipal } from '../../../common/auth/jwt-claims';
import type { SetupAssistantScope, SetupAssistantStep, SetupSessionDto } from '@enagar/types';

export type SetupToolPersona = 'tenant' | 'state';

export type SetupToolContext = {
  principal: AuthenticatedPrincipal;
  session: SetupSessionDto;
  tenantId: string;
  serviceId?: string;
  globalServiceCode?: string;
  step: SetupAssistantStep;
  scope: SetupAssistantScope;
};

export type SetupToolResult = {
  success: boolean;
  summary: string;
  draftUpdated?: 'form' | 'workflow' | 'config';
  data?: unknown;
};

export type SetupToolDefinition = {
  name: string;
  description: string;
  execute: (ctx: SetupToolContext, args: Record<string, unknown>) => Promise<SetupToolResult>;
};
