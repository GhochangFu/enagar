import { BadRequestException, Injectable } from '@nestjs/common';

import {
  assertValidDocumentChecklist,
  assertValidFeeRule,
  normalizeDocumentChecklist,
  PAYMENT_SCHEDULES,
  type DocumentChecklistItem,
  type FeeRule,
  type PaymentSchedule,
} from '../../admin-tenant/admin-tenant-config.contracts';
import { AdminTenantService } from '../../admin-tenant/admin-tenant.service';

import type { SetupToolContext, SetupToolDefinition, SetupToolResult } from './tool.types';
import type { PatchTenantServiceConfigDto } from '../../admin-tenant/dto/service-config.dto';

const ARCHETYPE_VALUES = [
  'linear_approval',
  'scrutiny',
  'certificate',
  'booking',
  'municipal_ladder',
] as const;

function asFeeRule(value: unknown): FeeRule {
  assertValidFeeRule(value);
  return value;
}

function asDocuments(value: unknown): DocumentChecklistItem[] {
  const normalized = normalizeDocumentChecklist(value);
  assertValidDocumentChecklist(normalized);
  return normalized;
}

function asPaymentSchedule(value: unknown): PaymentSchedule {
  const schedule = String(value);
  if (!PAYMENT_SCHEDULES.includes(schedule as PaymentSchedule)) {
    throw new BadRequestException(
      `payment_schedule must be one of: ${PAYMENT_SCHEDULES.join(', ')}`,
    );
  }
  return schedule as PaymentSchedule;
}

@Injectable()
export class TenantConfigTools {
  constructor(private readonly adminTenant: AdminTenantService) {}

  definitions(): SetupToolDefinition[] {
    return [
      {
        name: 'listRevenueHeads',
        description: 'List active revenue heads available for fee mapping (read-only).',
        execute: (ctx) => this.listRevenueHeads(ctx),
      },
      {
        name: 'proposeFeeRule',
        description: 'Propose and save a fee rule (free, fixed, slab, computed, or external).',
        execute: (ctx, args) => this.proposeFeeRule(ctx, args),
      },
      {
        name: 'setPaymentSchedule',
        description: 'Set payment timing: upfront_only, deferred_only, or upfront_and_deferred.',
        execute: (ctx, args) => this.setPaymentSchedule(ctx, args),
      },
      {
        name: 'setRequiredDocuments',
        description: 'Set the citizen document checklist for this service.',
        execute: (ctx, args) => this.setRequiredDocuments(ctx, args),
      },
      {
        name: 'setGovernancePolicies',
        description: 'Set BOC policy, municipal signoff policy, and optional threshold (paise).',
        execute: (ctx, args) => this.setGovernancePolicies(ctx, args),
      },
      {
        name: 'applyServiceConfig',
        description:
          'Validate and persist fee rule, documents, revenue head, payment schedule, and governance policies.',
        execute: (ctx, args) => this.applyServiceConfig(ctx, args),
      },
    ];
  }

  static formatRevenueHeadsForPrompt(
    heads: Array<{ code: string; name: unknown; is_active?: boolean }>,
  ): string {
    if (heads.length === 0) {
      return 'No revenue heads configured. Ask the admin to create one in Masters or use a free fee rule.';
    }
    return heads
      .filter((head) => head.is_active !== false)
      .map((head) => {
        const label =
          head.name && typeof head.name === 'object' && !Array.isArray(head.name)
            ? String((head.name as Record<string, string>).en ?? head.code)
            : head.code;
        return `- ${head.code}: ${label}`;
      })
      .join('\n');
  }

  static formatConfigForPrompt(config: {
    fee_rule: unknown;
    fee_preview_paise: number | null;
    payment_schedule: string;
    required_documents: unknown;
    revenue_head: { code: string } | null;
    boc_policy: string | null;
    municipal_signoff_policy: string | null;
    bookable_asset_codes: string[];
  }): string {
    const docCount = Array.isArray(config.required_documents)
      ? config.required_documents.length
      : 0;
    const feeType =
      config.fee_rule && typeof config.fee_rule === 'object' && !Array.isArray(config.fee_rule)
        ? String((config.fee_rule as { type?: string }).type ?? 'unknown')
        : 'none';
    return [
      `Fee type: ${feeType}`,
      `Fee preview (paise): ${config.fee_preview_paise ?? 'n/a'}`,
      `Payment schedule: ${config.payment_schedule}`,
      `Required documents: ${docCount}`,
      `Revenue head: ${config.revenue_head?.code ?? 'not set'}`,
      `BOC policy: ${config.boc_policy ?? 'default'}`,
      `Municipal signoff: ${config.municipal_signoff_policy ?? 'default'}`,
      `Bookable assets: ${config.bookable_asset_codes.join(', ') || 'none'}`,
    ].join('\n');
  }

  private requireServiceId(ctx: SetupToolContext): string {
    if (!ctx.serviceId) {
      throw new BadRequestException('Tenant config tools require serviceId');
    }
    return ctx.serviceId;
  }

  private async listRevenueHeads(ctx: SetupToolContext): Promise<SetupToolResult> {
    const heads = await this.adminTenant.listRevenueHeads(ctx.principal);
    return {
      success: true,
      summary: `Found ${heads.length} revenue head(s)`,
      data: heads.map((head) => ({
        code: head.code,
        name: head.name,
        accounting_code: head.accounting_code,
        is_active: head.is_active,
      })),
    };
  }

  private async proposeFeeRule(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const serviceId = this.requireServiceId(ctx);
    const feeRule = asFeeRule(args.fee_rule);
    return this.patchConfig(ctx, serviceId, { fee_rule: feeRule }, 'saved fee rule');
  }

  private async setPaymentSchedule(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const serviceId = this.requireServiceId(ctx);
    const payment_schedule = asPaymentSchedule(args.payment_schedule);
    return this.patchConfig(
      ctx,
      serviceId,
      { payment_schedule },
      `set payment schedule to ${payment_schedule}`,
    );
  }

  private async setRequiredDocuments(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const serviceId = this.requireServiceId(ctx);
    const documents = asDocuments(args.required_documents);
    return this.patchConfig(
      ctx,
      serviceId,
      { required_documents: documents },
      `saved ${documents.length} required document(s)`,
    );
  }

  private async setGovernancePolicies(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const serviceId = this.requireServiceId(ctx);
    const patch: PatchTenantServiceConfigDto = {};
    if (args.boc_policy !== undefined) {
      patch.boc_policy = String(args.boc_policy) as PatchTenantServiceConfigDto['boc_policy'];
    }
    if (args.municipal_signoff_policy !== undefined) {
      patch.municipal_signoff_policy = String(
        args.municipal_signoff_policy,
      ) as PatchTenantServiceConfigDto['municipal_signoff_policy'];
    }
    if (args.municipal_signoff_threshold_paise !== undefined) {
      const threshold = Number(args.municipal_signoff_threshold_paise);
      if (!Number.isInteger(threshold) || threshold < 0) {
        throw new BadRequestException(
          'municipal_signoff_threshold_paise must be a non-negative integer',
        );
      }
      patch.municipal_signoff_threshold_paise = threshold;
    }
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('At least one governance policy field is required');
    }
    return this.patchConfig(ctx, serviceId, patch, 'updated governance policies');
  }

  private async applyServiceConfig(
    ctx: SetupToolContext,
    args: Record<string, unknown>,
  ): Promise<SetupToolResult> {
    const serviceId = this.requireServiceId(ctx);
    const patch: PatchTenantServiceConfigDto = {};

    if (args.fee_rule !== undefined) {
      patch.fee_rule = asFeeRule(args.fee_rule);
    }
    if (args.payment_schedule !== undefined) {
      patch.payment_schedule = asPaymentSchedule(args.payment_schedule);
    }
    if (args.required_documents !== undefined) {
      patch.required_documents = asDocuments(args.required_documents);
    }
    if (args.revenue_head_code !== undefined) {
      const code = String(args.revenue_head_code).trim();
      if (code) {
        const heads = await this.adminTenant.listRevenueHeads(ctx.principal);
        const known = heads.some((head) => head.code === code && head.is_active);
        if (!known) {
          throw new BadRequestException(`Revenue head "${code}" is not active or does not exist`);
        }
      }
      patch.revenue_head_code = code;
    }
    if (args.boc_policy !== undefined) {
      patch.boc_policy = String(args.boc_policy) as PatchTenantServiceConfigDto['boc_policy'];
    }
    if (args.municipal_signoff_policy !== undefined) {
      patch.municipal_signoff_policy = String(
        args.municipal_signoff_policy,
      ) as PatchTenantServiceConfigDto['municipal_signoff_policy'];
    }
    if (args.municipal_signoff_threshold_paise !== undefined) {
      const threshold = Number(args.municipal_signoff_threshold_paise);
      if (!Number.isInteger(threshold) || threshold < 0) {
        throw new BadRequestException(
          'municipal_signoff_threshold_paise must be a non-negative integer',
        );
      }
      patch.municipal_signoff_threshold_paise = threshold;
    }
    if (args.bookable_asset_codes !== undefined) {
      if (!Array.isArray(args.bookable_asset_codes)) {
        throw new BadRequestException('bookable_asset_codes must be an array');
      }
      patch.bookable_asset_codes = args.bookable_asset_codes.map((code) => String(code));
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('applyServiceConfig requires at least one config field');
    }

    return this.patchConfig(ctx, serviceId, patch, 'applied service configuration');
  }

  private async patchConfig(
    ctx: SetupToolContext,
    serviceId: string,
    patch: PatchTenantServiceConfigDto,
    action: string,
  ): Promise<SetupToolResult> {
    const updated = await this.adminTenant.patchServiceConfig(ctx.principal, serviceId, patch);
    return {
      success: true,
      summary: action,
      draftUpdated: 'config',
      data: {
        fee_preview_paise: updated.fee_preview_paise,
        revenue_head_code: updated.revenue_head?.code ?? null,
        document_count: Array.isArray(updated.required_documents)
          ? updated.required_documents.length
          : 0,
      },
    };
  }
}

export { ARCHETYPE_VALUES };
