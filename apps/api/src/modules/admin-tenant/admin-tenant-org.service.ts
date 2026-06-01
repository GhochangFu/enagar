import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { assertCode, assertLocaleLabel } from './admin-tenant-config.contracts';
import { assertDesignationCode, assertDesignationScope } from './admin-tenant-org.contracts';
import { assertTenantPortalAdminWrite, assertTenantPortalStaff } from './tenant-admin-portal-roles';

import type {
  PatchTenantDepartmentDto,
  PatchTenantDesignationDto,
  ReplaceUserDesignationsDto,
  UpsertDesignationStageMapDto,
  UpsertTenantDepartmentDto,
  UpsertTenantDesignationDto,
} from './dto/org-designations.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';

export type TenantAdminDepartmentRow = {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  sort_order: number;
  is_active: boolean;
  designation_count: number;
};

export type TenantAdminDesignationRow = {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  scope: string;
  department_id: string | null;
  department_code: string | null;
  is_active: boolean;
  is_department_head: boolean;
  can_reject_municipal: boolean;
  user_count: number;
};

export type TenantAdminUserDesignationRow = {
  designation_id: string;
  designation_code: string;
  designation_name: Prisma.JsonValue;
  scope: string;
  department_code: string | null;
};

export type TenantAdminDesignationStageMapRow = {
  id: string;
  workflow_code: string;
  stage_code: string;
  stage_label: Prisma.JsonValue;
  designation_code: string;
  can_view: boolean;
  can_act: boolean;
};

@Injectable()
export class AdminTenantOrgService {
  constructor(private readonly prisma: PrismaService) {}

  async listDepartments(principal: AuthenticatedPrincipal): Promise<TenantAdminDepartmentRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.tenantDepartment.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: { _count: { select: { designations: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      sort_order: row.sortOrder,
      is_active: row.isActive,
      designation_count: row._count.designations,
    }));
  }

  async createDepartment(
    principal: AuthenticatedPrincipal,
    dto: UpsertTenantDepartmentDto,
  ): Promise<TenantAdminDepartmentRow> {
    assertTenantPortalAdminWrite(principal);
    assertCode(dto.code, 'department code');
    assertLocaleLabel(dto.name, 'department name');

    const row = await this.prisma.tenantDepartment.create({
      data: {
        tenantId: principal.tenantId,
        code: dto.code.trim(),
        name: dto.name as Prisma.InputJsonValue,
        sortOrder: dto.sort_order ?? 500,
        isActive: dto.is_active ?? true,
      },
      include: { _count: { select: { designations: true } } },
    });
    return this.toDepartmentRow(row);
  }

  async patchDepartment(
    principal: AuthenticatedPrincipal,
    code: string,
    dto: PatchTenantDepartmentDto,
  ): Promise<TenantAdminDepartmentRow> {
    assertTenantPortalAdminWrite(principal);
    const existing = await this.requireDepartment(principal.tenantId, code);
    if (dto.name) {
      assertLocaleLabel(dto.name, 'department name');
    }

    const row = await this.prisma.tenantDepartment.update({
      where: { id: existing.id },
      data: {
        name: dto.name ? (dto.name as Prisma.InputJsonValue) : undefined,
        sortOrder: dto.sort_order,
        isActive: dto.is_active,
      },
      include: { _count: { select: { designations: true } } },
    });
    return this.toDepartmentRow(row);
  }

  async listDesignations(
    principal: AuthenticatedPrincipal,
    departmentId?: string,
  ): Promise<TenantAdminDesignationRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.tenantDesignation.findMany({
      where: {
        tenantId: principal.tenantId,
        ...(departmentId ? { departmentId } : {}),
      },
      orderBy: [{ scope: 'asc' }, { code: 'asc' }],
      include: {
        department: { select: { code: true } },
        _count: { select: { userDesignations: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      scope: row.scope,
      department_id: row.departmentId,
      department_code: row.department?.code ?? null,
      is_active: row.isActive,
      is_department_head: row.isDepartmentHead,
      can_reject_municipal: row.canRejectMunicipal,
      user_count: row._count.userDesignations,
    }));
  }

  async createDesignation(
    principal: AuthenticatedPrincipal,
    dto: UpsertTenantDesignationDto,
  ): Promise<TenantAdminDesignationRow> {
    assertTenantPortalAdminWrite(principal);
    assertDesignationCode(dto.code, 'designation code');
    assertLocaleLabel(dto.name, 'designation name');
    assertDesignationScope(dto.scope, dto.department_id ?? null);

    const departmentId =
      dto.scope === 'department'
        ? await this.resolveDepartmentId(principal.tenantId, dto.department_id!)
        : null;

    const row = await this.prisma.tenantDesignation.create({
      data: {
        tenantId: principal.tenantId,
        code: dto.code.trim(),
        name: dto.name as Prisma.InputJsonValue,
        scope: dto.scope,
        departmentId,
        isActive: dto.is_active ?? true,
        isDepartmentHead: dto.is_department_head ?? false,
        canRejectMunicipal: dto.can_reject_municipal ?? false,
      },
      include: {
        department: { select: { code: true } },
        _count: { select: { userDesignations: true } },
      },
    });
    return this.toDesignationRow(row);
  }

  async patchDesignation(
    principal: AuthenticatedPrincipal,
    code: string,
    dto: PatchTenantDesignationDto,
  ): Promise<TenantAdminDesignationRow> {
    assertTenantPortalAdminWrite(principal);
    const existing = await this.requireDesignation(principal.tenantId, code);
    if (dto.name) {
      assertLocaleLabel(dto.name, 'designation name');
    }

    const row = await this.prisma.tenantDesignation.update({
      where: { id: existing.id },
      data: {
        name: dto.name ? (dto.name as Prisma.InputJsonValue) : undefined,
        isActive: dto.is_active,
        isDepartmentHead: dto.is_department_head,
        canRejectMunicipal: dto.can_reject_municipal,
      },
      include: {
        department: { select: { code: true } },
        _count: { select: { userDesignations: true } },
      },
    });
    return this.toDesignationRow(row);
  }

  async listUserDesignations(
    principal: AuthenticatedPrincipal,
    userId: string,
  ): Promise<TenantAdminUserDesignationRow[]> {
    assertTenantPortalStaff(principal);
    await this.requireUser(principal.tenantId, userId);

    const rows = await this.prisma.userDesignation.findMany({
      where: { tenantId: principal.tenantId, userId },
      include: {
        designation: { include: { department: { select: { code: true } } } },
      },
      orderBy: { designation: { code: 'asc' } },
    });

    return rows.map((row) => ({
      designation_id: row.designationId,
      designation_code: row.designation.code,
      designation_name: row.designation.name,
      scope: row.designation.scope,
      department_code: row.designation.department?.code ?? null,
    }));
  }

  async replaceUserDesignations(
    principal: AuthenticatedPrincipal,
    userId: string,
    dto: ReplaceUserDesignationsDto,
  ): Promise<TenantAdminUserDesignationRow[]> {
    assertTenantPortalAdminWrite(principal);
    await this.requireUser(principal.tenantId, userId);

    const uniqueIds = [...new Set(dto.designation_ids)];
    if (uniqueIds.length > 0) {
      const designations = await this.prisma.tenantDesignation.findMany({
        where: { tenantId: principal.tenantId, id: { in: uniqueIds }, isActive: true },
        select: { id: true },
      });
      if (designations.length !== uniqueIds.length) {
        throw new BadRequestException('One or more designation_ids are invalid or inactive');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userDesignation.deleteMany({
        where: { tenantId: principal.tenantId, userId },
      });
      if (uniqueIds.length > 0) {
        await tx.userDesignation.createMany({
          data: uniqueIds.map((designationId) => ({
            tenantId: principal.tenantId,
            userId,
            designationId,
          })),
        });
      }
    });

    return this.listUserDesignations(principal, userId);
  }

  private async requireDepartment(tenantId: string, code: string) {
    const row = await this.prisma.tenantDepartment.findFirst({
      where: { tenantId, code },
    });
    if (!row) {
      throw new NotFoundException('Department not found');
    }
    return row;
  }

  private async requireDesignation(tenantId: string, code: string) {
    const row = await this.prisma.tenantDesignation.findFirst({
      where: { tenantId, code },
    });
    if (!row) {
      throw new NotFoundException('Designation not found');
    }
    return row;
  }

  private async requireUser(tenantId: string, userId: string) {
    const row = await this.prisma.user.findFirst({
      where: { tenantId, id: userId },
    });
    if (!row) {
      throw new NotFoundException('Staff user not found');
    }
    return row;
  }

  private async resolveDepartmentId(tenantId: string, departmentId: string): Promise<string> {
    const row = await this.prisma.tenantDepartment.findFirst({
      where: { tenantId, id: departmentId },
    });
    if (!row) {
      throw new BadRequestException('department_id does not exist for this tenant');
    }
    return row.id;
  }

  private toDepartmentRow(row: {
    id: string;
    code: string;
    name: Prisma.JsonValue;
    sortOrder: number;
    isActive: boolean;
    _count: { designations: number };
  }): TenantAdminDepartmentRow {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      sort_order: row.sortOrder,
      is_active: row.isActive,
      designation_count: row._count.designations,
    };
  }

  async listDesignationStageMaps(
    principal: AuthenticatedPrincipal,
  ): Promise<TenantAdminDesignationStageMapRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.designationStageMap.findMany({
      where: { tenantId: principal.tenantId },
      include: { stage: { include: { workflow: true } } },
      orderBy: [{ designationCode: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      workflow_code: row.stage.workflow.code,
      stage_code: row.stage.code,
      stage_label: row.stage.label,
      designation_code: row.designationCode,
      can_view: row.canView,
      can_act: row.canAct,
    }));
  }

  async upsertDesignationStageMap(
    principal: AuthenticatedPrincipal,
    dto: UpsertDesignationStageMapDto,
  ): Promise<TenantAdminDesignationStageMapRow> {
    assertTenantPortalStaff(principal);
    assertDesignationCode(dto.designation_code, 'designation_code');
    const designation = await this.prisma.tenantDesignation.findUnique({
      where: {
        tenantId_code: { tenantId: principal.tenantId, code: dto.designation_code.trim() },
      },
    });
    if (!designation || !designation.isActive) {
      throw new BadRequestException('designation_code does not exist for this tenant');
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

    const row = await this.prisma.designationStageMap.upsert({
      where: {
        tenantId_stageId_designationCode: {
          tenantId: principal.tenantId,
          stageId: stage.id,
          designationCode: dto.designation_code.trim(),
        },
      },
      create: {
        tenantId: principal.tenantId,
        stageId: stage.id,
        designationCode: dto.designation_code.trim(),
        canView: dto.can_view ?? true,
        canAct: dto.can_act ?? false,
      },
      update: {
        canView: dto.can_view ?? true,
        canAct: dto.can_act ?? false,
      },
      include: { stage: { include: { workflow: true } } },
    });
    return {
      id: row.id,
      workflow_code: row.stage.workflow.code,
      stage_code: row.stage.code,
      stage_label: row.stage.label,
      designation_code: row.designationCode,
      can_view: row.canView,
      can_act: row.canAct,
    };
  }

  private toDesignationRow(row: {
    id: string;
    code: string;
    name: Prisma.JsonValue;
    scope: string;
    departmentId: string | null;
    isActive: boolean;
    isDepartmentHead: boolean;
    canRejectMunicipal: boolean;
    department: { code: string } | null;
    _count: { userDesignations: number };
  }): TenantAdminDesignationRow {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      scope: row.scope,
      department_id: row.departmentId,
      department_code: row.department?.code ?? null,
      is_active: row.isActive,
      is_department_head: row.isDepartmentHead,
      can_reject_municipal: row.canRejectMunicipal,
      user_count: row._count.userDesignations,
    };
  }
}
