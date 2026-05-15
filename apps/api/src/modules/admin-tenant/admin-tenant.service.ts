import { createBlankFormSchemaDraft, validateFormSchema } from '@enagar/forms';
import { createLinearWorkflowDraft, validateWorkflowDefinition } from '@enagar/workflow';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import {
  assertCode,
  assertLocaleLabel,
  assertValidDocumentChecklist,
  assertValidFeeRule,
  assertSupportedLocale,
  assertValidBranding,
  assertValidFeatureFlags,
  assertValidKbArticleStatus,
  assertValidLanguageList,
  assertValidLocalizedMarkdown,
  assertValidNotificationChannel,
  assertValidNotificationVariables,
  assertValidTagList,
  assertValidTariffCategory,
  calculateFeePreview,
} from './admin-tenant-config.contracts';
import { assertTenantPortalStaff } from './tenant-admin-portal-roles';

import type { FeeRule } from './admin-tenant-config.contracts';
import type { PatchTenantServiceDto } from './dto/patch-tenant-service.dto';
import type {
  PatchTenantServiceConfigDto,
  UpsertAddressMasterDto,
  UpsertRevenueHeadDto,
  UpsertTariffDto,
} from './dto/service-config.dto';
import type {
  SaveServiceFormDraftDto,
  SaveServiceWorkflowDraftDto,
} from './dto/service-designer.dto';
import type {
  PatchTenantSettingsDto,
  UpsertKbArticleDto,
  UpsertNotificationTemplateDto,
  UpsertRoleStageMapDto,
  UpsertStaffDto,
} from './dto/tenant-operations.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';
import type { EnagarFormSchema } from '@enagar/forms';
import type { WorkflowDefinition, WorkflowEffect } from '@enagar/workflow';

export type TenantAdminDashboardSnapshot = {
  tenant_id: string;
  tenant_code?: string;
  applications_total: number;
  applications_open: number;
  grievances_open: number;
  grievances_sla_breached_open: number;
  citizens_registered: number;
  payments_settled_last_30_days: number;
};

export type TenantAdminServiceRow = {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  description: Prisma.JsonValue;
  is_active: boolean;
  effective_sla_days: number | null;
  updated_at: string;
};

export type TenantAdminServiceConfig = TenantAdminServiceRow & {
  fee_rule: Prisma.JsonValue;
  fee_preview_paise: number | null;
  required_documents: Prisma.JsonValue;
  revenue_head: {
    id: string;
    code: string;
    name: Prisma.JsonValue;
    accounting_code: string;
  } | null;
};

export type TenantAdminRevenueHeadRow = {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  accounting_code: string;
  is_active: boolean;
};

export type TenantAdminAddressMasterRow = {
  borough_code: string | null;
  borough_name: string | null;
  ward_number: string | null;
  ward_name: string | null;
  mouza: string | null;
  locality_id: string;
  locality_name: string;
  pincode: string | null;
};

export type TenantAdminTariffRow = {
  id: string;
  code: string;
  category: string;
  name: Prisma.JsonValue;
  rate_config: Prisma.JsonValue;
  preview_paise: number | null;
  is_active: boolean;
  updated_at: string;
};

export type TenantAdminFormVersionRow = {
  id: string;
  version: number;
  status: string;
  form_schema: Prisma.JsonValue;
  ui_schema: Prisma.JsonValue;
  published_at: string | null;
};

export type TenantAdminWorkflowRow = {
  id: string;
  code: string;
  version: number;
  status: string;
  name: Prisma.JsonValue;
  published_at: string | null;
  definition: WorkflowDefinition;
};

export type TenantAdminServiceDesigner = {
  service: TenantAdminServiceRow;
  form_draft: TenantAdminFormVersionRow | null;
  form_published: TenantAdminFormVersionRow | null;
  workflow_draft: TenantAdminWorkflowRow | null;
  workflow_published: TenantAdminWorkflowRow | null;
  starter_form_schema: EnagarFormSchema;
  starter_workflow: WorkflowDefinition;
};

export type TenantAdminSettings = {
  tenant_id: string;
  tenant_code?: string;
  branding: Prisma.JsonValue;
  feature_flags: Prisma.JsonValue;
  languages_enabled: string[];
  default_language: string;
  contact_phone: string | null;
  contact_email: string | null;
};

export type TenantAdminNotificationTemplateRow = {
  id: string;
  code: string;
  channel: string;
  locale: string;
  trigger: string;
  subject: string | null;
  body: string;
  variables: Prisma.JsonValue;
  is_active: boolean;
  updated_at: string;
};

export type TenantAdminKbArticleRow = {
  id: string;
  slug: string;
  title: Prisma.JsonValue;
  body: Prisma.JsonValue;
  tags: string[];
  status: string;
  published_at: string | null;
  updated_at: string;
};

export type TenantAdminRoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type TenantAdminStaffRow = {
  id: string;
  keycloak_user_id: string;
  username: string;
  display_name: string;
  email: string | null;
  mobile: string | null;
  status: string;
  roles: Array<{ code: string; name: string; ward_number: string | null }>;
  updated_at: string;
};

export type TenantAdminRoleStageMapRow = {
  id: string;
  workflow_code: string;
  stage_code: string;
  stage_label: Prisma.JsonValue;
  role_code: string;
  can_view: boolean;
  can_act: boolean;
};

type WorkflowWithChildren = Prisma.WorkflowGetPayload<{
  include: {
    stages: true;
    transitions: {
      include: {
        fromStage: true;
        toStage: true;
      };
    };
  };
}>;

function mergeLabels(
  existing: Prisma.JsonValue,
  patch?: Record<string, unknown>,
): Prisma.JsonValue {
  if (!patch || typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    return existing;
  }
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch } as Prisma.JsonValue;
}

@Injectable()
export class AdminTenantService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(principal: AuthenticatedPrincipal): Promise<TenantAdminDashboardSnapshot> {
    assertTenantPortalStaff(principal);
    const tenantId = principal.tenantId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const terminalGrievance = ['resolved', 'closed'];

    const [
      applications_total,
      applications_open,
      grievances_open,
      grievances_sla_breached_open,
      citizens_registered,
      payments_settled_last_30_days,
    ] = await Promise.all([
      this.prisma.application.count({ where: { tenantId } }),
      this.prisma.application.count({
        where: { tenantId, NOT: { status: 'closed' } },
      }),
      this.prisma.grievance.count({
        where: { tenantId, NOT: { status: { in: terminalGrievance } } },
      }),
      this.prisma.grievance.count({
        where: {
          tenantId,
          slaBreachedAt: { not: null },
          NOT: { status: { in: terminalGrievance } },
        },
      }),
      this.prisma.citizen.count({ where: { tenantId } }),
      this.prisma.payment.count({
        where: {
          tenantId,
          status: 'settled',
          settledAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    return {
      tenant_id: tenantId,
      tenant_code: principal.tenantCode,
      applications_total,
      applications_open,
      grievances_open,
      grievances_sla_breached_open,
      citizens_registered,
      payments_settled_last_30_days,
    };
  }

  async listServices(principal: AuthenticatedPrincipal): Promise<TenantAdminServiceRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.tenantService.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        effectiveSlaDays: true,
        updatedAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name as Prisma.JsonValue,
      description: row.description as Prisma.JsonValue,
      is_active: row.isActive,
      effective_sla_days: row.effectiveSlaDays,
      updated_at: row.updatedAt.toISOString(),
    }));
  }

  async patchService(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    dto: PatchTenantServiceDto,
  ): Promise<TenantAdminServiceRow> {
    assertTenantPortalStaff(principal);

    const existing = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: principal.tenantId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        effectiveSlaDays: true,
        updatedAt: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Service not found for this tenant');
    }

    const namePatch =
      dto.name !== undefined ? mergeLabels(existing.name as Prisma.JsonValue, dto.name) : undefined;
    const descriptionPatch =
      dto.description !== undefined
        ? mergeLabels(existing.description as Prisma.JsonValue, dto.description)
        : undefined;

    const updated = await this.prisma.tenantService.update({
      where: { id: existing.id },
      data: {
        ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
        ...(namePatch !== undefined ? { name: namePatch as Prisma.InputJsonValue } : {}),
        ...(descriptionPatch !== undefined
          ? { description: descriptionPatch as Prisma.InputJsonValue }
          : {}),
        ...(dto.effective_sla_days !== undefined
          ? { effectiveSlaDays: dto.effective_sla_days }
          : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        effectiveSlaDays: true,
        updatedAt: true,
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name as Prisma.JsonValue,
      description: updated.description as Prisma.JsonValue,
      is_active: updated.isActive,
      effective_sla_days: updated.effectiveSlaDays,
      updated_at: updated.updatedAt.toISOString(),
    };
  }

  async getServiceConfig(
    principal: AuthenticatedPrincipal,
    serviceId: string,
  ): Promise<TenantAdminServiceConfig> {
    assertTenantPortalStaff(principal);
    const row = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: principal.tenantId },
      include: { revenueHead: true },
    });
    if (!row) {
      throw new NotFoundException('Service not found for this tenant');
    }

    return toServiceConfigRow(row);
  }

  async patchServiceConfig(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    dto: PatchTenantServiceConfigDto,
  ): Promise<TenantAdminServiceConfig> {
    assertTenantPortalStaff(principal);
    const existing = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: principal.tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Service not found for this tenant');
    }

    let revenueHeadId: string | null | undefined;
    if (dto.revenue_head_code !== undefined) {
      const code = dto.revenue_head_code.trim();
      if (!code) {
        revenueHeadId = null;
      } else {
        const revenueHead = await this.prisma.revenueHead.findUnique({ where: { code } });
        if (!revenueHead || !revenueHead.isActive) {
          throw new BadRequestException('Revenue head is not active or does not exist');
        }
        revenueHeadId = revenueHead.id;
      }
    }

    const data: Prisma.TenantServiceUpdateInput = {};
    if (dto.fee_rule !== undefined) {
      assertValidFeeRule(dto.fee_rule);
      data.effectiveFeeConfig = dto.fee_rule as unknown as Prisma.InputJsonValue;
    }
    if (dto.required_documents !== undefined) {
      assertValidDocumentChecklist(dto.required_documents);
      data.requiredDocuments = dto.required_documents as unknown as Prisma.InputJsonValue;
    }
    if (revenueHeadId !== undefined) {
      data.revenueHead = revenueHeadId ? { connect: { id: revenueHeadId } } : { disconnect: true };
    }

    const updated = await this.prisma.tenantService.update({
      where: { id: existing.id },
      data,
      include: { revenueHead: true },
    });

    return toServiceConfigRow(updated);
  }

  async listRevenueHeads(principal: AuthenticatedPrincipal): Promise<TenantAdminRevenueHeadRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.revenueHead.findMany({
      orderBy: [{ code: 'asc' }],
    });
    return rows.map(toRevenueHeadRow);
  }

  async upsertRevenueHead(
    principal: AuthenticatedPrincipal,
    dto: UpsertRevenueHeadDto,
  ): Promise<TenantAdminRevenueHeadRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.code, 'revenue head code');
    assertLocaleLabel(dto.name, 'revenue head name');
    if (!/^RH-[A-Z0-9-]+$/.test(dto.accounting_code)) {
      throw new BadRequestException('accounting_code must use RH-* format');
    }

    const row = await this.prisma.revenueHead.upsert({
      where: { code: dto.code },
      create: {
        code: dto.code,
        name: dto.name as Prisma.InputJsonValue,
        accountingCode: dto.accounting_code,
        isActive: dto.is_active ?? true,
      },
      update: {
        name: dto.name as Prisma.InputJsonValue,
        accountingCode: dto.accounting_code,
        isActive: dto.is_active ?? true,
      },
    });
    return toRevenueHeadRow(row);
  }

  async listAddressMaster(
    principal: AuthenticatedPrincipal,
  ): Promise<TenantAdminAddressMasterRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.locality.findMany({
      where: { tenantId: principal.tenantId },
      include: { ward: { include: { borough: true } } },
      orderBy: [{ mouza: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toAddressMasterRow);
  }

  async upsertAddressMaster(
    principal: AuthenticatedPrincipal,
    dto: UpsertAddressMasterDto,
  ): Promise<TenantAdminAddressMasterRow> {
    assertTenantPortalStaff(principal);
    const wardNumber = dto.ward_number.trim();
    const localityName = dto.locality_name.trim();
    const pincode = dto.pincode?.trim() || '';
    if (!wardNumber || !localityName) {
      throw new BadRequestException('ward_number and locality_name are required');
    }

    const boroughCode = dto.borough_code?.trim();
    let boroughId: string | null = null;
    if (boroughCode) {
      const borough = await this.prisma.borough.upsert({
        where: { tenantId_code: { tenantId: principal.tenantId, code: boroughCode } },
        create: {
          tenantId: principal.tenantId,
          code: boroughCode,
          name: dto.borough_name?.trim() || boroughCode,
        },
        update: {
          name: dto.borough_name?.trim() || boroughCode,
        },
      });
      boroughId = borough.id;
    }

    const ward = await this.prisma.ward.upsert({
      where: { tenantId_number: { tenantId: principal.tenantId, number: wardNumber } },
      create: {
        tenantId: principal.tenantId,
        boroughId,
        number: wardNumber,
        name: dto.ward_name?.trim() || null,
      },
      update: {
        boroughId,
        name: dto.ward_name?.trim() || null,
      },
    });

    const locality = await this.prisma.locality.upsert({
      where: {
        tenantId_name_pincode: {
          tenantId: principal.tenantId,
          name: localityName,
          pincode,
        },
      },
      create: {
        tenantId: principal.tenantId,
        wardId: ward.id,
        mouza: dto.mouza?.trim() || null,
        name: localityName,
        pincode,
      },
      update: {
        wardId: ward.id,
        mouza: dto.mouza?.trim() || null,
      },
      include: { ward: { include: { borough: true } } },
    });

    return toAddressMasterRow(locality);
  }

  async listTariffs(principal: AuthenticatedPrincipal): Promise<TenantAdminTariffRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.tenantTariff.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
    return rows.map(toTariffRow);
  }

  async upsertTariff(
    principal: AuthenticatedPrincipal,
    dto: UpsertTariffDto,
  ): Promise<TenantAdminTariffRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.code, 'tariff code');
    assertValidTariffCategory(dto.category);
    assertLocaleLabel(dto.name, 'tariff name');
    assertValidFeeRule(dto.rate_config);

    const row = await this.prisma.tenantTariff.upsert({
      where: { tenantId_code: { tenantId: principal.tenantId, code: dto.code } },
      create: {
        tenantId: principal.tenantId,
        code: dto.code,
        category: dto.category,
        name: dto.name as Prisma.InputJsonValue,
        rateConfig: dto.rate_config as Prisma.InputJsonValue,
        isActive: dto.is_active ?? true,
      },
      update: {
        category: dto.category,
        name: dto.name as Prisma.InputJsonValue,
        rateConfig: dto.rate_config as Prisma.InputJsonValue,
        isActive: dto.is_active ?? true,
      },
    });
    return toTariffRow(row);
  }

  async getServiceDesigner(
    principal: AuthenticatedPrincipal,
    serviceId: string,
  ): Promise<TenantAdminServiceDesigner> {
    assertTenantPortalStaff(principal);
    const service = await this.getOwnedService(principal, serviceId);

    const [formDraft, formPublished, workflowDraft, workflowPublished] = await Promise.all([
      this.prisma.serviceFormVersion.findFirst({
        where: { tenantId: principal.tenantId, serviceId, status: 'draft' },
        orderBy: { version: 'desc' },
      }),
      this.prisma.serviceFormVersion.findFirst({
        where: { tenantId: principal.tenantId, serviceId, status: 'published' },
        orderBy: { version: 'desc' },
      }),
      this.prisma.workflow.findFirst({
        where: { tenantId: principal.tenantId, serviceId, status: 'draft' },
        orderBy: { version: 'desc' },
        include: workflowInclude,
      }),
      this.prisma.workflow.findFirst({
        where: { tenantId: principal.tenantId, serviceId, status: 'published' },
        orderBy: { version: 'desc' },
        include: workflowInclude,
      }),
    ]);

    return {
      service,
      form_draft: formDraft ? toFormVersionRow(formDraft) : null,
      form_published: formPublished ? toFormVersionRow(formPublished) : null,
      workflow_draft: workflowDraft ? toWorkflowRow(workflowDraft) : null,
      workflow_published: workflowPublished ? toWorkflowRow(workflowPublished) : null,
      starter_form_schema: createBlankFormSchemaDraft(service.code, labelFromJson(service.name)),
      starter_workflow: createLinearWorkflowDraft(service.code),
    };
  }

  async saveFormDraft(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    dto: SaveServiceFormDraftDto,
  ): Promise<TenantAdminFormVersionRow> {
    assertTenantPortalStaff(principal);
    const service = await this.getOwnedService(principal, serviceId);
    if (dto.form_schema.service_code !== service.code) {
      throw new BadRequestException('Form schema service_code must match the tenant service');
    }
    const validation = validateFormSchema(dto.form_schema);
    if (!validation.ok) {
      throw new BadRequestException({
        message: 'Form schema is invalid',
        issues: validation.issues,
      });
    }

    const draft = await this.prisma.serviceFormVersion.findFirst({
      where: { tenantId: principal.tenantId, serviceId, status: 'draft' },
      orderBy: { version: 'desc' },
    });

    const saved = draft
      ? await this.prisma.serviceFormVersion.update({
          where: { id: draft.id },
          data: {
            formSchema: dto.form_schema as unknown as Prisma.InputJsonValue,
            uiSchema: (dto.ui_schema ?? {}) as Prisma.InputJsonValue,
          },
        })
      : await this.prisma.serviceFormVersion.create({
          data: {
            tenantId: principal.tenantId,
            serviceId,
            version: await this.nextFormVersion(principal.tenantId, serviceId),
            status: 'draft',
            formSchema: dto.form_schema as unknown as Prisma.InputJsonValue,
            uiSchema: (dto.ui_schema ?? {}) as Prisma.InputJsonValue,
          },
        });

    return toFormVersionRow(saved);
  }

  async publishFormDraft(
    principal: AuthenticatedPrincipal,
    serviceId: string,
  ): Promise<TenantAdminFormVersionRow> {
    assertTenantPortalStaff(principal);
    await this.getOwnedService(principal, serviceId);
    const draft = await this.prisma.serviceFormVersion.findFirst({
      where: { tenantId: principal.tenantId, serviceId, status: 'draft' },
      orderBy: { version: 'desc' },
    });
    if (!draft) {
      throw new NotFoundException('Form draft not found for this tenant service');
    }

    const validation = validateFormSchema(draft.formSchema as unknown as EnagarFormSchema);
    if (!validation.ok) {
      throw new BadRequestException({
        message: 'Form schema is invalid',
        issues: validation.issues,
      });
    }

    const published = await this.prisma.$transaction(async (tx) => {
      await tx.serviceFormVersion.updateMany({
        where: { tenantId: principal.tenantId, serviceId, status: 'published' },
        data: { status: 'retired' },
      });

      return tx.serviceFormVersion.update({
        where: { id: draft.id },
        data: { status: 'published', publishedAt: new Date() },
      });
    });

    return toFormVersionRow(published);
  }

  async saveWorkflowDraft(
    principal: AuthenticatedPrincipal,
    serviceId: string,
    dto: SaveServiceWorkflowDraftDto,
  ): Promise<TenantAdminWorkflowRow> {
    assertTenantPortalStaff(principal);
    const service = await this.getOwnedService(principal, serviceId);
    const validation = validateWorkflowDefinition(dto.workflow);
    if (!validation.ok) {
      throw new BadRequestException({
        message: 'Workflow definition is invalid',
        issues: validation.issues,
      });
    }
    if (!dto.workflow.code.startsWith(`${service.code}-`)) {
      throw new BadRequestException('Workflow code must be prefixed with the service code');
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const draft = await tx.workflow.findFirst({
        where: { tenantId: principal.tenantId, serviceId, status: 'draft' },
        orderBy: { version: 'desc' },
      });
      const workflow = draft
        ? await tx.workflow.update({
            where: { id: draft.id },
            data: {
              code: dto.workflow.code,
              version: dto.workflow.version,
              name: labelFromJson(service.name) as unknown as Prisma.InputJsonValue,
            },
          })
        : await tx.workflow.create({
            data: {
              tenantId: principal.tenantId,
              serviceId,
              code: dto.workflow.code,
              version: await this.nextWorkflowVersion(principal.tenantId, serviceId),
              status: 'draft',
              name: labelFromJson(service.name) as unknown as Prisma.InputJsonValue,
            },
          });

      await tx.workflowTransition.deleteMany({
        where: { tenantId: principal.tenantId, workflowId: workflow.id },
      });
      await tx.workflowStage.deleteMany({
        where: { tenantId: principal.tenantId, workflowId: workflow.id },
      });

      const stageIds = new Map<string, string>();
      for (const [index, stage] of dto.workflow.stages.entries()) {
        const created = await tx.workflowStage.create({
          data: {
            tenantId: principal.tenantId,
            workflowId: workflow.id,
            code: stage.code,
            label: stage.label as unknown as Prisma.InputJsonValue,
            ownerRole: stage.owner_role,
            slaHours: stage.sla_hours,
            isInitial: stage.initial === true,
            isTerminal: stage.terminal === true,
            sortOrder: index,
          },
        });
        stageIds.set(stage.code, created.id);
      }

      for (const transition of dto.workflow.transitions) {
        const fromStageId = stageIds.get(transition.from);
        const toStageId = stageIds.get(transition.to);
        if (!fromStageId || !toStageId) {
          throw new BadRequestException('Workflow transition references an unknown stage');
        }
        await tx.workflowTransition.create({
          data: {
            tenantId: principal.tenantId,
            workflowId: workflow.id,
            fromStageId,
            toStageId,
            verb: transition.verb,
            actorRole: transition.actor_role,
            requiresComment: transition.requires_comment === true,
            sideEffects: (transition.effects ?? []) as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return tx.workflow.findUniqueOrThrow({
        where: { id: workflow.id },
        include: workflowInclude,
      });
    });

    return toWorkflowRow(saved);
  }

  async publishWorkflowDraft(
    principal: AuthenticatedPrincipal,
    serviceId: string,
  ): Promise<TenantAdminWorkflowRow> {
    assertTenantPortalStaff(principal);
    await this.getOwnedService(principal, serviceId);
    const draft = await this.prisma.workflow.findFirst({
      where: { tenantId: principal.tenantId, serviceId, status: 'draft' },
      orderBy: { version: 'desc' },
      include: workflowInclude,
    });
    if (!draft) {
      throw new NotFoundException('Workflow draft not found for this tenant service');
    }

    const validation = validateWorkflowDefinition(toWorkflowDefinition(draft));
    if (!validation.ok) {
      throw new BadRequestException({
        message: 'Workflow definition is invalid',
        issues: validation.issues,
      });
    }

    const published = await this.prisma.$transaction(async (tx) => {
      await tx.workflow.updateMany({
        where: { tenantId: principal.tenantId, serviceId, status: 'published' },
        data: { status: 'retired' },
      });
      await tx.workflow.update({
        where: { id: draft.id },
        data: { status: 'published', publishedAt: new Date() },
      });
      return tx.workflow.findUniqueOrThrow({
        where: { id: draft.id },
        include: workflowInclude,
      });
    });

    return toWorkflowRow(published);
  }

  async getSettings(principal: AuthenticatedPrincipal): Promise<TenantAdminSettings> {
    assertTenantPortalStaff(principal);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: principal.tenantId },
      include: { tenantConfig: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const config =
      tenant.tenantConfig ??
      (await this.prisma.tenantConfig.create({ data: { tenantId: principal.tenantId } }));
    return toSettingsRow(tenant, config, principal.tenantCode);
  }

  async patchSettings(
    principal: AuthenticatedPrincipal,
    dto: PatchTenantSettingsDto,
  ): Promise<TenantAdminSettings> {
    assertTenantPortalStaff(principal);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: principal.tenantId },
      include: { tenantConfig: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (dto.branding !== undefined) {
      assertValidBranding(dto.branding);
    }
    if (dto.feature_flags !== undefined) {
      assertValidFeatureFlags(dto.feature_flags);
    }
    if (dto.languages_enabled !== undefined) {
      assertValidLanguageList(dto.languages_enabled);
    }
    if (dto.default_language !== undefined) {
      assertSupportedLocale(dto.default_language);
    }

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: principal.tenantId },
      data: {
        ...(dto.languages_enabled !== undefined ? { languagesEnabled: dto.languages_enabled } : {}),
        ...(dto.branding?.theme_color !== undefined
          ? { themeColor: String(dto.branding.theme_color) || null }
          : {}),
        ...(dto.branding?.logo_url !== undefined
          ? { logoUrl: String(dto.branding.logo_url) || null }
          : {}),
      },
    });

    const config = await this.prisma.tenantConfig.upsert({
      where: { tenantId: principal.tenantId },
      create: {
        tenantId: principal.tenantId,
        ...(dto.default_language !== undefined ? { defaultLanguage: dto.default_language } : {}),
        ...(dto.contact_phone !== undefined ? { contactPhone: dto.contact_phone || null } : {}),
        ...(dto.contact_email !== undefined ? { contactEmail: dto.contact_email || null } : {}),
        ...(dto.branding !== undefined ? { branding: dto.branding as Prisma.InputJsonValue } : {}),
        ...(dto.feature_flags !== undefined
          ? { featureFlags: dto.feature_flags as Prisma.InputJsonValue }
          : {}),
      },
      update: {
        ...(dto.default_language !== undefined ? { defaultLanguage: dto.default_language } : {}),
        ...(dto.contact_phone !== undefined ? { contactPhone: dto.contact_phone || null } : {}),
        ...(dto.contact_email !== undefined ? { contactEmail: dto.contact_email || null } : {}),
        ...(dto.branding !== undefined ? { branding: dto.branding as Prisma.InputJsonValue } : {}),
        ...(dto.feature_flags !== undefined
          ? { featureFlags: dto.feature_flags as Prisma.InputJsonValue }
          : {}),
      },
    });

    return toSettingsRow(updatedTenant, config, principal.tenantCode);
  }

  async listNotificationTemplates(
    principal: AuthenticatedPrincipal,
  ): Promise<TenantAdminNotificationTemplateRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.notificationTemplate.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: [{ channel: 'asc' }, { code: 'asc' }, { locale: 'asc' }],
    });
    return rows.map(toNotificationTemplateRow);
  }

  async upsertNotificationTemplate(
    principal: AuthenticatedPrincipal,
    dto: UpsertNotificationTemplateDto,
  ): Promise<TenantAdminNotificationTemplateRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.code, 'template code');
    assertCode(dto.trigger, 'template trigger');
    assertValidNotificationChannel(dto.channel);
    assertSupportedLocale(dto.locale);
    if (!dto.body.trim()) {
      throw new BadRequestException('Template body is required');
    }
    const variables = dto.variables ?? extractTemplateVariables(dto.subject, dto.body);
    assertValidNotificationVariables(variables, dto.body, dto.subject);

    const row = await this.prisma.notificationTemplate.upsert({
      where: {
        tenantId_code_channel_locale: {
          tenantId: principal.tenantId,
          code: dto.code,
          channel: dto.channel,
          locale: dto.locale,
        },
      },
      create: {
        tenantId: principal.tenantId,
        code: dto.code,
        channel: dto.channel,
        locale: dto.locale,
        trigger: dto.trigger,
        subject: dto.subject?.trim() || null,
        body: dto.body,
        variables: variables as Prisma.InputJsonValue,
        isActive: dto.is_active ?? true,
      },
      update: {
        trigger: dto.trigger,
        subject: dto.subject?.trim() || null,
        body: dto.body,
        variables: variables as Prisma.InputJsonValue,
        isActive: dto.is_active ?? true,
      },
    });
    return toNotificationTemplateRow(row);
  }

  async listKbArticles(principal: AuthenticatedPrincipal): Promise<TenantAdminKbArticleRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.kbArticle.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: [{ status: 'asc' }, { slug: 'asc' }],
    });
    return rows.map(toKbArticleRow);
  }

  async upsertKbArticle(
    principal: AuthenticatedPrincipal,
    dto: UpsertKbArticleDto,
  ): Promise<TenantAdminKbArticleRow> {
    assertTenantPortalStaff(principal);
    assertCode(dto.slug, 'KB article slug');
    assertValidLocalizedMarkdown(dto.title, 'KB article title');
    assertValidLocalizedMarkdown(dto.body, 'KB article body');
    assertValidTagList(dto.tags ?? []);
    assertValidKbArticleStatus(dto.status);

    const publishedAt = dto.status === 'published' ? new Date() : null;
    const row = await this.prisma.kbArticle.upsert({
      where: { tenantId_slug: { tenantId: principal.tenantId, slug: dto.slug } },
      create: {
        tenantId: principal.tenantId,
        slug: dto.slug,
        title: dto.title as Prisma.InputJsonValue,
        body: dto.body as Prisma.InputJsonValue,
        tags: (dto.tags ?? []) as string[],
        status: dto.status,
        publishedAt,
      },
      update: {
        title: dto.title as Prisma.InputJsonValue,
        body: dto.body as Prisma.InputJsonValue,
        tags: (dto.tags ?? []) as string[],
        status: dto.status,
        publishedAt,
      },
    });
    return toKbArticleRow(row);
  }

  async listRoles(principal: AuthenticatedPrincipal): Promise<TenantAdminRoleRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.role.findMany({ orderBy: { code: 'asc' } });
    return rows.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
    }));
  }

  async listStaff(principal: AuthenticatedPrincipal): Promise<TenantAdminStaffRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.user.findMany({
      where: { tenantId: principal.tenantId },
      include: { userRoles: { include: { role: true, ward: true } } },
      orderBy: { username: 'asc' },
    });
    return rows.map(toStaffRow);
  }

  async upsertStaff(
    principal: AuthenticatedPrincipal,
    dto: UpsertStaffDto,
  ): Promise<TenantAdminStaffRow> {
    assertTenantPortalStaff(principal);
    assertUuid(dto.keycloak_user_id, 'keycloak_user_id');
    assertStaffStatus(dto.status ?? 'active');
    assertRoleCodes(dto.role_codes);

    const existing = await this.prisma.user.findUnique({
      where: { keycloakUserId: dto.keycloak_user_id },
    });
    if (existing && existing.tenantId !== principal.tenantId) {
      throw new BadRequestException('Staff user belongs to another tenant');
    }

    const roles = await this.prisma.role.findMany({
      where: { code: { in: dto.role_codes as string[] } },
    });
    if (roles.length !== dto.role_codes.length) {
      throw new BadRequestException('One or more role_codes do not exist');
    }

    const ward = dto.ward_number
      ? await this.prisma.ward.findFirst({
          where: { tenantId: principal.tenantId, number: dto.ward_number },
        })
      : null;
    if (dto.ward_number && !ward) {
      throw new BadRequestException('ward_number does not exist for this tenant');
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              username: dto.username,
              displayName: dto.display_name,
              email: dto.email || null,
              mobile: dto.mobile || null,
              status: dto.status ?? 'active',
            },
          })
        : await tx.user.create({
            data: {
              tenantId: principal.tenantId,
              keycloakUserId: dto.keycloak_user_id,
              username: dto.username,
              displayName: dto.display_name,
              email: dto.email || null,
              mobile: dto.mobile || null,
              status: dto.status ?? 'active',
            },
          });

      await tx.userRole.deleteMany({ where: { tenantId: principal.tenantId, userId: user.id } });
      for (const role of roles) {
        await tx.userRole.create({
          data: {
            tenantId: principal.tenantId,
            userId: user.id,
            roleId: role.id,
            wardId: ward?.id ?? null,
          },
        });
      }
      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { userRoles: { include: { role: true, ward: true } } },
      });
    });

    return toStaffRow(saved);
  }

  async listRoleStageMaps(
    principal: AuthenticatedPrincipal,
  ): Promise<TenantAdminRoleStageMapRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.roleStageMap.findMany({
      where: { tenantId: principal.tenantId },
      include: { stage: { include: { workflow: true } } },
      orderBy: [{ roleCode: 'asc' }],
    });
    return rows.map(toRoleStageMapRow);
  }

  async upsertRoleStageMap(
    principal: AuthenticatedPrincipal,
    dto: UpsertRoleStageMapDto,
  ): Promise<TenantAdminRoleStageMapRow> {
    assertTenantPortalStaff(principal);
    assertRoleCode(dto.role_code);
    const role = await this.prisma.role.findUnique({ where: { code: dto.role_code } });
    if (!role) {
      throw new BadRequestException('role_code does not exist');
    }
    const workflow = await this.prisma.workflow.findFirst({
      where: { tenantId: principal.tenantId, code: dto.workflow_code },
      include: { stages: true },
      orderBy: { version: 'desc' },
    });
    if (!workflow) {
      throw new BadRequestException('workflow_code does not exist for this tenant');
    }
    const stage = workflow.stages.find((candidate) => candidate.code === dto.stage_code);
    if (!stage) {
      throw new BadRequestException('stage_code does not exist for this workflow');
    }

    const row = await this.prisma.roleStageMap.upsert({
      where: {
        tenantId_stageId_roleCode: {
          tenantId: principal.tenantId,
          stageId: stage.id,
          roleCode: dto.role_code,
        },
      },
      create: {
        tenantId: principal.tenantId,
        stageId: stage.id,
        roleCode: dto.role_code,
        canView: dto.can_view ?? true,
        canAct: dto.can_act ?? false,
      },
      update: {
        canView: dto.can_view ?? true,
        canAct: dto.can_act ?? false,
      },
      include: { stage: { include: { workflow: true } } },
    });
    return toRoleStageMapRow(row);
  }

  private async getOwnedService(
    principal: AuthenticatedPrincipal,
    serviceId: string,
  ): Promise<TenantAdminServiceRow> {
    const row = await this.prisma.tenantService.findFirst({
      where: { id: serviceId, tenantId: principal.tenantId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
        effectiveSlaDays: true,
        updatedAt: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Service not found for this tenant');
    }

    return {
      id: row.id,
      code: row.code,
      name: row.name as Prisma.JsonValue,
      description: row.description as Prisma.JsonValue,
      is_active: row.isActive,
      effective_sla_days: row.effectiveSlaDays,
      updated_at: row.updatedAt.toISOString(),
    };
  }

  private async nextFormVersion(tenantId: string, serviceId: string): Promise<number> {
    const version = await this.prisma.serviceFormVersion.aggregate({
      where: { tenantId, serviceId },
      _max: { version: true },
    });
    return (version._max.version ?? 0) + 1;
  }

  private async nextWorkflowVersion(tenantId: string, serviceId: string): Promise<number> {
    const version = await this.prisma.workflow.aggregate({
      where: { tenantId, serviceId },
      _max: { version: true },
    });
    return (version._max.version ?? 0) + 1;
  }
}

const workflowInclude = {
  stages: { orderBy: { sortOrder: 'asc' as const } },
  transitions: {
    include: {
      fromStage: true,
      toStage: true,
    },
  },
};

function toSettingsRow(
  tenant: {
    id: string;
    code: string;
    languagesEnabled: string[];
  },
  config: {
    branding: Prisma.JsonValue;
    featureFlags: Prisma.JsonValue;
    defaultLanguage: string;
    contactPhone: string | null;
    contactEmail: string | null;
  },
  tenantCode?: string,
): TenantAdminSettings {
  return {
    tenant_id: tenant.id,
    tenant_code: tenantCode ?? tenant.code,
    branding: config.branding,
    feature_flags: config.featureFlags,
    languages_enabled: tenant.languagesEnabled,
    default_language: config.defaultLanguage,
    contact_phone: config.contactPhone,
    contact_email: config.contactEmail,
  };
}

function toNotificationTemplateRow(row: {
  id: string;
  code: string;
  channel: string;
  locale: string;
  trigger: string;
  subject: string | null;
  body: string;
  variables: Prisma.JsonValue;
  isActive: boolean;
  updatedAt: Date;
}): TenantAdminNotificationTemplateRow {
  return {
    id: row.id,
    code: row.code,
    channel: row.channel,
    locale: row.locale,
    trigger: row.trigger,
    subject: row.subject,
    body: row.body,
    variables: row.variables,
    is_active: row.isActive,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toKbArticleRow(row: {
  id: string;
  slug: string;
  title: Prisma.JsonValue;
  body: Prisma.JsonValue;
  tags: string[];
  status: string;
  publishedAt: Date | null;
  updatedAt: Date;
}): TenantAdminKbArticleRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    tags: row.tags,
    status: row.status,
    published_at: row.publishedAt?.toISOString() ?? null,
    updated_at: row.updatedAt.toISOString(),
  };
}

function toStaffRow(row: {
  id: string;
  keycloakUserId: string;
  username: string;
  displayName: string;
  email: string | null;
  mobile: string | null;
  status: string;
  updatedAt: Date;
  userRoles: Array<{
    role: { code: string; name: string };
    ward: { number: string } | null;
  }>;
}): TenantAdminStaffRow {
  return {
    id: row.id,
    keycloak_user_id: row.keycloakUserId,
    username: row.username,
    display_name: row.displayName,
    email: row.email,
    mobile: row.mobile,
    status: row.status,
    roles: row.userRoles.map((assignment) => ({
      code: assignment.role.code,
      name: assignment.role.name,
      ward_number: assignment.ward?.number ?? null,
    })),
    updated_at: row.updatedAt.toISOString(),
  };
}

function toRoleStageMapRow(row: {
  id: string;
  roleCode: string;
  canView: boolean;
  canAct: boolean;
  stage: {
    code: string;
    label: Prisma.JsonValue;
    workflow: { code: string };
  };
}): TenantAdminRoleStageMapRow {
  return {
    id: row.id,
    workflow_code: row.stage.workflow.code,
    stage_code: row.stage.code,
    stage_label: row.stage.label,
    role_code: row.roleCode,
    can_view: row.canView,
    can_act: row.canAct,
  };
}

function toFormVersionRow(row: {
  id: string;
  version: number;
  status: string;
  formSchema: Prisma.JsonValue;
  uiSchema: Prisma.JsonValue;
  publishedAt: Date | null;
}): TenantAdminFormVersionRow {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    form_schema: row.formSchema,
    ui_schema: row.uiSchema,
    published_at: row.publishedAt?.toISOString() ?? null,
  };
}

function toServiceConfigRow(row: {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  description: Prisma.JsonValue;
  isActive: boolean;
  effectiveSlaDays: number | null;
  effectiveFeeConfig: Prisma.JsonValue;
  requiredDocuments: Prisma.JsonValue;
  updatedAt: Date;
  revenueHead: {
    id: string;
    code: string;
    name: Prisma.JsonValue;
    accountingCode: string;
  } | null;
}): TenantAdminServiceConfig {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    is_active: row.isActive,
    effective_sla_days: row.effectiveSlaDays,
    updated_at: row.updatedAt.toISOString(),
    fee_rule: row.effectiveFeeConfig,
    fee_preview_paise: previewFeeRule(row.effectiveFeeConfig),
    required_documents: row.requiredDocuments,
    revenue_head: row.revenueHead
      ? {
          id: row.revenueHead.id,
          code: row.revenueHead.code,
          name: row.revenueHead.name,
          accounting_code: row.revenueHead.accountingCode,
        }
      : null,
  };
}

function toRevenueHeadRow(row: {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  accountingCode: string;
  isActive: boolean;
}): TenantAdminRevenueHeadRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    accounting_code: row.accountingCode,
    is_active: row.isActive,
  };
}

function toAddressMasterRow(row: {
  id: string;
  name: string;
  pincode: string | null;
  mouza: string | null;
  ward: {
    number: string;
    name: string | null;
    borough: { code: string; name: string } | null;
  } | null;
}): TenantAdminAddressMasterRow {
  return {
    borough_code: row.ward?.borough?.code ?? null,
    borough_name: row.ward?.borough?.name ?? null,
    ward_number: row.ward?.number ?? null,
    ward_name: row.ward?.name ?? null,
    mouza: row.mouza,
    locality_id: row.id,
    locality_name: row.name,
    pincode: row.pincode,
  };
}

function toTariffRow(row: {
  id: string;
  code: string;
  category: string;
  name: Prisma.JsonValue;
  rateConfig: Prisma.JsonValue;
  isActive: boolean;
  updatedAt: Date;
}): TenantAdminTariffRow {
  return {
    id: row.id,
    code: row.code,
    category: row.category,
    name: row.name,
    rate_config: row.rateConfig,
    preview_paise: previewFeeRule(row.rateConfig),
    is_active: row.isActive,
    updated_at: row.updatedAt.toISOString(),
  };
}

function previewFeeRule(value: Prisma.JsonValue): number | null {
  try {
    assertValidFeeRule(value);
    return calculateFeePreview(value as FeeRule, {
      built_up_area_sqft: 1000,
      monthly_kl: 20,
    });
  } catch {
    return null;
  }
}

function toWorkflowRow(row: WorkflowWithChildren): TenantAdminWorkflowRow {
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    status: row.status,
    name: row.name as Prisma.JsonValue,
    published_at: row.publishedAt?.toISOString() ?? null,
    definition: toWorkflowDefinition(row),
  };
}

function toWorkflowDefinition(row: WorkflowWithChildren): WorkflowDefinition {
  return {
    code: row.code,
    version: row.version,
    stages: row.stages
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((stage) => ({
        code: stage.code,
        label: stage.label as { en: string; bn: string; hi: string },
        owner_role: stage.ownerRole,
        sla_hours: stage.slaHours ?? undefined,
        initial: stage.isInitial,
        terminal: stage.isTerminal,
      })),
    transitions: row.transitions.map((transition) => ({
      from: transition.fromStage.code,
      to: transition.toStage.code,
      verb: transition.verb,
      actor_role: transition.actorRole,
      requires_comment: transition.requiresComment,
      effects: transition.sideEffects as unknown as WorkflowEffect[],
    })),
  };
}

function labelFromJson(value: Prisma.JsonValue): { en: string; bn: string; hi: string } {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const map = value as Record<string, unknown>;
    const en = typeof map.en === 'string' && map.en.trim() ? map.en : 'Service';
    return {
      en,
      bn: typeof map.bn === 'string' && map.bn.trim() ? map.bn : en,
      hi: typeof map.hi === 'string' && map.hi.trim() ? map.hi : en,
    };
  }
  return { en: 'Service', bn: 'Service', hi: 'Service' };
}

function extractTemplateVariables(subject: string | undefined, body: string): string[] {
  const variables = new Set<string>();
  for (const match of `${subject ?? ''}\n${body}`.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g)) {
    const variable = match[1];
    if (variable) {
      variables.add(variable);
    }
  }
  return [...variables];
}

function assertUuid(value: unknown, field: string): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new BadRequestException(`${field} must be a UUID`);
  }
}

function assertStaffStatus(value: unknown): asserts value is string {
  if (!['active', 'disabled', 'invited'].includes(String(value))) {
    throw new BadRequestException('Unsupported staff status');
  }
}

function assertRoleCodes(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException('role_codes must include at least one role');
  }
  const seen = new Set<string>();
  for (const roleCode of value) {
    assertRoleCode(roleCode);
    seen.add(roleCode);
  }
  if (seen.size !== value.length) {
    throw new BadRequestException('role_codes must be unique');
  }
}

function assertRoleCode(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(value)) {
    throw new BadRequestException('role_code must use a known role-code format');
  }
}
