import { createBlankFormSchemaDraft, validateFormSchema } from '@enagar/forms';
import { createLinearWorkflowDraft, validateWorkflowDefinition } from '@enagar/workflow';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { assertTenantPortalStaff } from './tenant-admin-portal-roles';

import type { PatchTenantServiceDto } from './dto/patch-tenant-service.dto';
import type {
  SaveServiceFormDraftDto,
  SaveServiceWorkflowDraftDto,
} from './dto/service-designer.dto';
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
