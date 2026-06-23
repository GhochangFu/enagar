import { BadRequestException, Injectable } from '@nestjs/common';

import { AdminTenantService } from '../../admin-tenant/admin-tenant.service';
import { ReadinessChecklistService } from '../readiness-checklist.service';

import type { SetupToolContext, SetupToolDefinition, SetupToolResult } from './tool.types';
import type { SetupReadinessItem } from '@enagar/types';

@Injectable()
export class ReviewTools {
  constructor(
    private readonly readiness: ReadinessChecklistService,
    private readonly adminTenant: AdminTenantService,
  ) {}

  definitions(): SetupToolDefinition[] {
    return [
      {
        name: 'getReadinessChecklist',
        description: 'Return publish readiness checklist for form, workflow, and config.',
        execute: (ctx) => this.getReadinessChecklist(ctx),
      },
      {
        name: 'explainBlockers',
        description: 'Explain amber/red checklist items in plain language.',
        execute: (ctx) => this.explainBlockers(ctx),
      },
      {
        name: 'previewCitizenForm',
        description: 'Return current form schema for citizen preview (read-only).',
        execute: (ctx) => this.previewCitizenForm(ctx),
      },
    ];
  }

  static explainItems(items: SetupReadinessItem[]): string[] {
    return items
      .filter((item) => item.status !== 'green')
      .map((item) => {
        const prefix = item.status === 'red' ? 'Blocker' : 'Warning';
        return `${prefix} — ${item.label}: ${item.message ?? 'Needs attention'}`;
      });
  }

  private requireServiceId(ctx: SetupToolContext): string {
    if (!ctx.serviceId) {
      throw new BadRequestException('Review tools require serviceId');
    }
    return ctx.serviceId;
  }

  private async getReadinessChecklist(ctx: SetupToolContext): Promise<SetupToolResult> {
    const serviceId = this.requireServiceId(ctx);
    const checklist = await this.readiness.forService(ctx.tenantId, serviceId);
    return {
      success: true,
      summary: checklist.ready_to_publish
        ? 'Service is ready to publish'
        : 'Service has outstanding readiness items',
      data: checklist,
    };
  }

  private async explainBlockers(ctx: SetupToolContext): Promise<SetupToolResult> {
    const serviceId = this.requireServiceId(ctx);
    const checklist = await this.readiness.forService(ctx.tenantId, serviceId);
    const explanations = ReviewTools.explainItems(checklist.items);
    return {
      success: true,
      summary:
        explanations.length > 0
          ? `${explanations.length} item(s) need attention`
          : 'No blockers — all checklist items are green',
      data: { explanations, checklist },
    };
  }

  private async previewCitizenForm(ctx: SetupToolContext): Promise<SetupToolResult> {
    const serviceId = this.requireServiceId(ctx);
    const designer = await this.adminTenant.getServiceDesigner(ctx.principal, serviceId);
    const schema = designer.form_draft?.form_schema ?? designer.starter_form_schema ?? null;
    if (!schema) {
      return {
        success: false,
        summary: 'No form draft or starter schema available',
      };
    }
    return {
      success: true,
      summary: 'Loaded form schema for preview',
      data: { form_schema: schema },
    };
  }
}
