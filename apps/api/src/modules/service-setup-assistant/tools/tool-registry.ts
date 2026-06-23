import { BadRequestException, Injectable } from '@nestjs/common';

import { IntentTools } from './intent.tools';
import { ReviewTools } from './review.tools';
import { StateGlobalFormTools } from './state-global-form.tools';
import { TenantConfigTools } from './tenant-config.tools';
import { TenantFormTools } from './tenant-form.tools';
import { TenantWorkflowTools } from './tenant-workflow.tools';

import type {
  SetupToolContext,
  SetupToolDefinition,
  SetupToolPersona,
  SetupToolResult,
} from './tool.types';
import type { SetupAssistantScope, SetupAssistantStep } from '@enagar/types';

@Injectable()
export class SetupToolRegistry {
  private readonly tenantFormTools: Map<string, SetupToolDefinition>;
  private readonly tenantWorkflowTools: Map<string, SetupToolDefinition>;
  private readonly tenantConfigTools: Map<string, SetupToolDefinition>;
  private readonly intentTools: Map<string, SetupToolDefinition>;
  private readonly reviewTools: Map<string, SetupToolDefinition>;
  private readonly stateTools: Map<string, SetupToolDefinition>;

  constructor(
    tenantFormTools: TenantFormTools,
    tenantWorkflowTools: TenantWorkflowTools,
    tenantConfigTools: TenantConfigTools,
    intentTools: IntentTools,
    reviewTools: ReviewTools,
    stateGlobalFormTools: StateGlobalFormTools,
  ) {
    this.tenantFormTools = new Map(tenantFormTools.definitions().map((tool) => [tool.name, tool]));
    this.tenantWorkflowTools = new Map(
      tenantWorkflowTools.definitions().map((tool) => [tool.name, tool]),
    );
    this.tenantConfigTools = new Map(
      tenantConfigTools.definitions().map((tool) => [tool.name, tool]),
    );
    this.intentTools = new Map(intentTools.definitions().map((tool) => [tool.name, tool]));
    this.reviewTools = new Map(reviewTools.definitions().map((tool) => [tool.name, tool]));
    this.stateTools = new Map(stateGlobalFormTools.definitions().map((tool) => [tool.name, tool]));
  }

  getToolsForStep(
    persona: SetupToolPersona,
    scope: SetupAssistantScope,
    step: SetupAssistantStep,
  ): SetupToolDefinition[] {
    if (persona === 'state') {
      if (step !== 2 || (scope !== 'full' && scope !== 'form')) {
        return [];
      }
      return Array.from(this.stateTools.values());
    }

    if (step === 1 && scope === 'full') {
      return Array.from(this.intentTools.values());
    }
    if (step === 2 && (scope === 'full' || scope === 'form')) {
      return Array.from(this.tenantFormTools.values());
    }
    if (step === 3 && (scope === 'full' || scope === 'workflow')) {
      return Array.from(this.tenantWorkflowTools.values());
    }
    if (step === 4 && (scope === 'full' || scope === 'payment')) {
      return Array.from(this.tenantConfigTools.values());
    }
    if (step === 5) {
      return Array.from(this.reviewTools.values());
    }
    return [];
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
    const registry = this.registryForStep(persona, ctx.step);
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

  private registryForStep(
    persona: SetupToolPersona,
    step: SetupAssistantStep,
  ): Map<string, SetupToolDefinition> {
    if (persona === 'state') {
      return this.stateTools;
    }
    switch (step) {
      case 1:
        return this.intentTools;
      case 2:
        return this.tenantFormTools;
      case 3:
        return this.tenantWorkflowTools;
      case 4:
        return this.tenantConfigTools;
      case 5:
        return this.reviewTools;
      default: {
        const exhaustive: never = step;
        return exhaustive as never;
      }
    }
  }
}
