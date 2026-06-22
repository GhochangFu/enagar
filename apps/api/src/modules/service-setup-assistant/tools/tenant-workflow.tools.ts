import {
  validateWorkflowDefinition,
  workflowForPattern,
  type WorkflowDefinition,
} from '@enagar/workflow';
import { BadRequestException, Injectable } from '@nestjs/common';

import { AdminTenantService } from '../../admin-tenant/admin-tenant.service';

import {
  bindWorkflowToService,
  formatWorkflowStagesForPrompt,
  mergeWorkflowDraft,
} from './workflow-merge.utils';
import { resolveWorkflowTemplate } from './workflow-setup-templates';

import type { SetupToolContext, SetupToolDefinition, SetupToolResult } from './tool.types';

function asWorkflowDefinition(value: unknown, label: string): WorkflowDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be an object`);
  }
  return value as WorkflowDefinition;
}

function resolveBaseWorkflow(
  designer: Awaited<ReturnType<AdminTenantService['getServiceDesigner']>>,
): WorkflowDefinition {
  const draft = designer.workflow_draft?.definition;
  if (draft && typeof draft === 'object' && !Array.isArray(draft)) {
    return draft as unknown as WorkflowDefinition;
  }
  const pattern = designer.workflow_pattern ?? 'cert-issuance';
  const starter = workflowForPattern(pattern);
  return bindWorkflowToService(starter, designer.service.code, starter.version ?? 1);
}

@Injectable()
export class TenantWorkflowTools {
  constructor(private readonly adminTenant: AdminTenantService) {}

  definitions(): SetupToolDefinition[] {
    return [
      {
        name: 'applyWorkflowDraft',
        description: 'Validate and persist the full workflow draft for this service.',
        execute: (ctx, args) => this.applyWorkflowDraft(ctx, args),
      },
      {
        name: 'replaceWorkflowDraft',
        description: 'Replace the entire workflow draft (start over / new template body).',
        execute: (ctx, args) => this.replaceWorkflowDraft(ctx, args),
      },
      {
        name: 'mergeWorkflowDraft',
        description: 'Merge stages and transitions into the current workflow draft by stage code.',
        execute: (ctx, args) => this.mergeWorkflowDraft(ctx, args),
      },
      {
        name: 'applyWorkflowTemplate',
        description:
          'Seed workflow from template id: linear_approval, scrutiny, or booking; saves when valid.',
        execute: (ctx, args) => this.applyWorkflowTemplate(ctx, args),
      },
    ];
  }

  static formatCurrentWorkflowForPrompt(workflow: WorkflowDefinition | null | undefined): string {
    return formatWorkflowStagesForPrompt(workflow ?? undefined);
  }

  private async applyWorkflowDraft(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const serviceId = ctx.serviceId;
    if (!serviceId) {
      throw new BadRequestException('Tenant workflow tools require serviceId');
    }
    const workflow = asWorkflowDefinition(args.workflow, 'workflow');
    return this.saveWorkflow(ctx, serviceId, workflow, 'saved workflow draft');
  }

  private async replaceWorkflowDraft(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const serviceId = ctx.serviceId;
    if (!serviceId) {
      throw new BadRequestException('Tenant workflow tools require serviceId');
    }
    const workflow = asWorkflowDefinition(args.workflow, 'workflow');
    return this.saveWorkflow(ctx, serviceId, workflow, 'replaced workflow draft');
  }

  private async mergeWorkflowDraft(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const serviceId = ctx.serviceId;
    if (!serviceId) {
      throw new BadRequestException('Tenant workflow tools require serviceId');
    }
    const patch = asWorkflowDefinition(args.workflow, 'workflow');
    const designer = await this.adminTenant.getServiceDesigner(ctx.principal, serviceId);
    const base = resolveBaseWorkflow(designer);
    const merged = mergeWorkflowDraft(base, patch);
    return this.saveWorkflow(ctx, serviceId, merged, 'merged workflow draft');
  }

  private async applyWorkflowTemplate(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const serviceId = ctx.serviceId;
    if (!serviceId) {
      throw new BadRequestException('Tenant workflow tools require serviceId');
    }
    const templateId = typeof args.template_id === 'string' ? args.template_id : '';
    if (!templateId.trim()) {
      throw new BadRequestException('template_id is required');
    }
    const designer = await this.adminTenant.getServiceDesigner(ctx.principal, serviceId);
    const version = designer.workflow_draft?.version ?? 1;
    const workflow = resolveWorkflowTemplate(templateId, designer.service.code, version);
    if (!workflow) {
      return {
        success: false,
        summary: `Unknown workflow template "${templateId}". Use linear_approval, scrutiny, or booking.`,
      };
    }
    return this.saveWorkflow(
      ctx,
      serviceId,
      workflow,
      `applied template ${templateId.trim().toLowerCase()}`,
    );
  }

  private async saveWorkflow(
    ctx: SetupToolContext,
    serviceId: string,
    workflow: WorkflowDefinition,
    actionLabel: string,
  ): Promise<SetupToolResult> {
    const validation = validateWorkflowDefinition(workflow);
    if (!validation.ok) {
      return {
        success: false,
        summary: `Workflow is invalid: ${validation.issues.map((issue) => issue.message).join('; ')}`,
        data: { issues: validation.issues },
      };
    }

    const saved = await this.adminTenant.saveWorkflowDraft(ctx.principal, serviceId, { workflow });
    const stageCount = saved.definition?.stages?.length ?? 0;
    const transitionCount = saved.definition?.transitions?.length ?? 0;

    return {
      success: true,
      summary: `${actionLabel} (${stageCount} stages, ${transitionCount} transitions).`,
      draftUpdated: 'workflow',
      data: {
        stage_count: stageCount,
        transition_count: transitionCount,
        workflow: saved.definition,
      },
    };
  }
}
