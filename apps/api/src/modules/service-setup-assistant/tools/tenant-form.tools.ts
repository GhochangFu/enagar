import { createBlankFormSchemaDraft, validateFormSchema } from '@enagar/forms';
import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/database/prisma.service';
import {
  isUsableFormSchema,
  resolveOnboardingFormSchema,
} from '../../admin-state/tenant-service-onboarding-forms';
import { AdminTenantService } from '../../admin-tenant/admin-tenant.service';

import {
  insertProposedFields,
  normalizeLlmProposedFields,
  summarizeFieldChanges,
} from './normalize-proposed-fields';

import type { SetupToolContext, SetupToolDefinition, SetupToolResult } from './tool.types';
import type { EnagarFormSchema } from '@enagar/forms';

function asFormSchema(value: unknown, label: string): EnagarFormSchema {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be an object`);
  }
  return value as EnagarFormSchema;
}

function asRawFieldList(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException('fields must be an array');
  }
  return value;
}

@Injectable()
export class TenantFormTools {
  constructor(
    private readonly adminTenant: AdminTenantService,
    private readonly prisma: PrismaService,
  ) {}

  definitions(): SetupToolDefinition[] {
    return [
      {
        name: 'applyFormDraft',
        description: 'Validate and persist the full citizen form schema draft for this service.',
        execute: (ctx, args) => this.applyFormDraft(ctx, args),
      },
      {
        name: 'loadGlobalTemplate',
        description:
          'Load the linked State global form template schema for preview (does not persist).',
        execute: (ctx) => this.loadGlobalTemplate(ctx),
      },
      {
        name: 'proposeFormFields',
        description: 'Merge proposed fields into the current draft schema and save when valid.',
        execute: (ctx, args) => this.proposeFormFields(ctx, args),
      },
    ];
  }

  private async applyFormDraft(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const serviceId = ctx.serviceId;
    if (!serviceId) {
      throw new BadRequestException('Tenant form tools require serviceId');
    }
    const formSchema = asFormSchema(args.form_schema, 'form_schema');
    const uiSchema =
      args.ui_schema && typeof args.ui_schema === 'object' && !Array.isArray(args.ui_schema)
        ? (args.ui_schema as Record<string, unknown>)
        : {};

    const saved = await this.adminTenant.saveFormDraft(ctx.principal, serviceId, {
      form_schema: formSchema,
      ui_schema: uiSchema,
    });

    const fieldCount =
      saved.form_schema &&
      typeof saved.form_schema === 'object' &&
      !Array.isArray(saved.form_schema) &&
      Array.isArray((saved.form_schema as unknown as EnagarFormSchema).fields)
        ? (saved.form_schema as unknown as EnagarFormSchema).fields.length
        : 0;

    return {
      success: true,
      summary: `Form draft saved (${fieldCount} fields).`,
      draftUpdated: 'form',
      data: { field_count: fieldCount },
    };
  }

  private async loadGlobalTemplate(ctx: SetupToolContext): Promise<SetupToolResult> {
    const serviceId = ctx.serviceId;
    if (!serviceId) {
      throw new BadRequestException('Tenant form tools require serviceId');
    }

    const row = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: ctx.tenantId },
      include: { globalService: { select: { code: true, formSchema: true } } },
    });
    if (!row?.globalServiceId || !row.globalService) {
      return {
        success: false,
        summary: 'This service is not linked to a State global template.',
      };
    }
    if (!isUsableFormSchema(row.globalService.formSchema)) {
      return {
        success: false,
        summary: 'State global template has no usable citizen form yet.',
      };
    }

    const schema = resolveOnboardingFormSchema(row.code, row.name, row.globalService.formSchema);
    return {
      success: true,
      summary: `Loaded global template ${row.globalService.code} (${schema.fields.length} fields).`,
      data: {
        global_code: row.globalService.code,
        form_schema: schema,
        field_count: schema.fields.length,
      },
    };
  }

  private async proposeFormFields(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const serviceId = ctx.serviceId;
    if (!serviceId) {
      throw new BadRequestException('Tenant form tools require serviceId');
    }

    const rawFields = asRawFieldList(args.fields);
    const designer = await this.adminTenant.getServiceDesigner(ctx.principal, serviceId);
    const serviceCode = designer.service.code;
    const baseSchema = designer.form_draft?.form_schema;
    const base =
      baseSchema && typeof baseSchema === 'object' && !Array.isArray(baseSchema)
        ? (baseSchema as unknown as EnagarFormSchema)
        : createBlankFormSchemaDraft(serviceCode, designer.service.name as { en?: string });
    const inserts = normalizeLlmProposedFields(rawFields, base.fields);
    const merged: EnagarFormSchema = {
      ...base,
      fields: insertProposedFields(base.fields, inserts),
    };
    const validation = validateFormSchema(merged);
    if (!validation.ok) {
      return {
        success: false,
        summary: `Proposed schema is invalid: ${validation.issues.map((i) => i.message).join('; ')}`,
        data: { issues: validation.issues },
      };
    }

    await this.adminTenant.saveFormDraft(ctx.principal, serviceId, {
      form_schema: merged,
      ui_schema: {},
    });

    const changeSummary = summarizeFieldChanges(base.fields, inserts);
    const parts: string[] = [];
    if (changeSummary.added > 0) {
      parts.push(`added ${changeSummary.added}`);
    }
    if (changeSummary.moved > 0) {
      parts.push(`moved ${changeSummary.moved}`);
    }
    if (changeSummary.updated > 0) {
      parts.push(`updated ${changeSummary.updated}`);
    }
    const actionLabel = parts.length > 0 ? parts.join(', ') : `saved ${inserts.length} field(s)`;

    return {
      success: true,
      summary: `Form draft ${actionLabel} (${merged.fields.length} total fields).`,
      draftUpdated: 'form',
      data: { form_schema: merged, field_count: merged.fields.length },
    };
  }
}
