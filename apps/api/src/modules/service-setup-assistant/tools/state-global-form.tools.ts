import { createBlankFormSchemaDraft, validateFormSchema } from '@enagar/forms';
import { BadRequestException, Injectable } from '@nestjs/common';

import { AdminStateService } from '../../admin-state/admin-state.service';

import { insertProposedFields, normalizeLlmProposedFields } from './normalize-proposed-fields';

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
export class StateGlobalFormTools {
  constructor(private readonly adminState: AdminStateService) {}

  definitions(): SetupToolDefinition[] {
    return [
      {
        name: 'applyGlobalFormSchema',
        description: 'Validate and persist the global citizen form schema for this catalogue code.',
        execute: (ctx, args) => this.applyGlobalFormSchema(ctx, args),
      },
      {
        name: 'proposeGlobalFormFields',
        description:
          'Merge proposed fields into the global form schema in memory only; does not persist.',
        execute: (ctx, args) => this.proposeGlobalFormFields(ctx, args),
      },
    ];
  }

  private async applyGlobalFormSchema(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const code = ctx.globalServiceCode;
    if (!code) {
      throw new BadRequestException('State form tools require globalServiceCode');
    }
    const formSchema = asFormSchema(args.form_schema, 'form_schema');
    const saved = await this.adminState.patchGlobalFormSchema(
      ctx.principal,
      code,
      formSchema as unknown as Record<string, unknown>,
    );
    const fieldCount = Array.isArray(
      (saved.form_schema as unknown as EnagarFormSchema | null)?.fields,
    )
      ? (saved.form_schema as unknown as EnagarFormSchema).fields.length
      : 0;
    return {
      success: true,
      summary: `Global form template saved for ${code}.`,
      draftUpdated: 'form',
      data: {
        code: saved.code,
        field_count: fieldCount,
      },
    };
  }

  private async proposeGlobalFormFields(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const code = ctx.globalServiceCode;
    if (!code) {
      throw new BadRequestException('State form tools require globalServiceCode');
    }

    const rawFields = asRawFieldList(args.fields);
    const template = await this.adminState.getGlobalServiceTemplate(ctx.principal, code);
    const title =
      template.name && typeof template.name === 'object' && !Array.isArray(template.name)
        ? String((template.name as { en?: string }).en ?? code)
        : code;
    const base = this.isUsable(template.form_schema)
      ? (template.form_schema as unknown as EnagarFormSchema)
      : createBlankFormSchemaDraft(code, { en: title });
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

    return {
      success: true,
      summary: `Proposed ${inserts.length} field(s); ${merged.fields.length} total fields in preview.`,
      data: { form_schema: merged, field_count: merged.fields.length },
    };
  }

  private isUsable(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const record = value as Record<string, unknown>;
    return Array.isArray(record.fields) && record.fields.length > 0;
  }
}
