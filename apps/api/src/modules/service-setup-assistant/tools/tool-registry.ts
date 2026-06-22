import { BadRequestException, Injectable } from '@nestjs/common';

import { StateGlobalFormTools } from './state-global-form.tools';
import { TenantFormTools } from './tenant-form.tools';

import type {
  SetupToolContext,
  SetupToolDefinition,
  SetupToolPersona,
  SetupToolResult,
} from './tool.types';
import type { SetupAssistantScope, SetupAssistantStep } from '@enagar/types';

@Injectable()
export class SetupToolRegistry {
  private readonly tenantTools: Map<string, SetupToolDefinition>;
  private readonly stateTools: Map<string, SetupToolDefinition>;

  constructor(tenantFormTools: TenantFormTools, stateGlobalFormTools: StateGlobalFormTools) {
    this.tenantTools = new Map(tenantFormTools.definitions().map((tool) => [tool.name, tool]));
    this.stateTools = new Map(stateGlobalFormTools.definitions().map((tool) => [tool.name, tool]));
  }

  getToolsForStep(
    persona: SetupToolPersona,
    scope: SetupAssistantScope,
    step: SetupAssistantStep,
  ): SetupToolDefinition[] {
    if (step !== 2) {
      return [];
    }
    if (scope !== 'full' && scope !== 'form') {
      return [];
    }
    const registry = persona === 'tenant' ? this.tenantTools : this.stateTools;
    return Array.from(registry.values());
  }

  async executeTool(
    persona: SetupToolPersona,
    name: string,
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const allowed = this.getToolsForStep(persona, ctx.scope, ctx.step);
    if (!allowed.some((tool) => tool.name === name)) {
      throw new BadRequestException(`Tool "${name}" is not allowed for this step`);
    }
    const registry = persona === 'tenant' ? this.tenantTools : this.stateTools;
    const tool = registry.get(name);
    if (!tool) {
      throw new BadRequestException(`Unknown tool "${name}"`);
    }
    return tool.execute(ctx, args);
  }

  formatToolsForPrompt(
    persona: SetupToolPersona,
    scope: SetupAssistantScope,
    step: SetupAssistantStep,
  ): string {
    const tools = this.getToolsForStep(persona, scope, step);
    if (tools.length === 0) {
      return 'No tools available for this step.';
    }
    return tools.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n');
  }
}
