import { createBlankFormSchemaDraft, validateFormSchema } from '@enagar/forms';
import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/database/prisma.service';
import {
  isUsableFormSchema,
  resolveOnboardingFormSchema,
} from '../../admin-state/tenant-service-onboarding-forms';
import { AdminTenantService } from '../../admin-tenant/admin-tenant.service';

import type { SetupToolContext, SetupToolDefinition, SetupToolResult } from './tool.types';
import type { EnagarFormField, EnagarFormSchema } from '@enagar/forms';

function asFormSchema(value: unknown, label: string): EnagarFormSchema {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be an object`);
  }
  return value as EnagarFormSchema;
}

function asFormFields(value: unknown): EnagarFormField[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException('fields must be an array');
  }
  return value as EnagarFormField[];
}

function mergeFormFields(base: EnagarFormSchema, fields: EnagarFormField[]): EnagarFormSchema {
  const byId = new Map(base.fields.map((field) => [field.id, field]));
  for (const field of fields) {
    byId.set(field.id, field);
  }
  return { ...base, fields: Array.from(byId.values()) };
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
        description:
          'Merge proposed fields into the current draft schema in memory only; does not persist.',
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

    const fields = asFormFields(args.fields);
    const designer = await this.adminTenant.getServiceDesigner(ctx.principal, serviceId);
    const serviceCode = designer.service.code;
    const baseSchema = designer.form_draft?.form_schema;
    const base =
      baseSchema && typeof baseSchema === 'object' && !Array.isArray(baseSchema)
        ? (baseSchema as unknown as EnagarFormSchema)
        : createBlankFormSchemaDraft(serviceCode, designer.service.name as { en?: string });
    const merged = mergeFormFields(base, fields);
    const validation = validateFormSchema(merged);
    if (!validation.ok) {
      return {
        success: false,
        summary: `Proposed schema is invalid: ${validation.issues.map((i) => i.message).join('; ')}`,
        data: { issues: validation.issues },
      };
    }

    return {
      success: true,
      summary: `Proposed ${fields.length} field(s); ${merged.fields.length} total fields in preview.`,
      data: { form_schema: merged, field_count: merged.fields.length },
    };
  }
}
