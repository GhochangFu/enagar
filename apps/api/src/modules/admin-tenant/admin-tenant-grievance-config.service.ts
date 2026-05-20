import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { GrievanceCatalogueService } from '../grievances/grievance-catalogue.service';

import { assertCode, assertLocaleLabel } from './admin-tenant-config.contracts';
import { assertTenantPortalAdminWrite, assertTenantPortalStaff } from './tenant-admin-portal-roles';

import type {
  PatchGrievanceCategoryDto,
  ReplaceGrievanceRoutingRulesDto,
  ReplaceSlaPoliciesDto,
  UpsertGrievanceCategoryDto,
  PatchGrievanceSubtypeDto,
  UpsertGrievanceSubtypeDto,
} from './dto/grievance-config.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';
import type { GrievanceCatalogueResponse } from '../grievances/grievance-catalogue.types';

export type TenantAdminGrievanceCategoryRow = {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  icon: string | null;
  global_category_code: string | null;
  sort_order: number;
  is_active: boolean;
  source: string;
  subtype_count: number;
};

export type TenantAdminGrievanceSubtypeRow = {
  id: string;
  category_code: string;
  code: string;
  name: Prisma.JsonValue;
  sort_order: number;
  is_active: boolean;
  source: string;
};

export type TenantAdminSlaPolicyRow = {
  id: string;
  sort_order: number;
  category_match: string | null;
  grievance_priority_match: string | null;
  hours_to_resolve: number;
  orphan_category: boolean;
};

export type TenantAdminRoutingRuleRow = {
  id: string;
  sort_order: number;
  category_match: string | null;
  grievance_priority_match: string | null;
  ward_id: string | null;
  target_role_code: string;
  assign_user_id: string | null;
  orphan_category: boolean;
};

@Injectable()
export class AdminTenantGrievanceConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogue: GrievanceCatalogueService,
  ) {}

  async getCatalogue(principal: AuthenticatedPrincipal): Promise<GrievanceCatalogueResponse> {
    assertTenantPortalStaff(principal);
    const tenant = await this.requireTenant(principal.tenantId);
    return this.catalogue.getActiveCatalogue(tenant.id, tenant.code);
  }

  async listCategories(
    principal: AuthenticatedPrincipal,
  ): Promise<TenantAdminGrievanceCategoryRow[]> {
    assertTenantPortalStaff(principal);
    const rows = await this.prisma.tenantGrievanceCategory.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: { _count: { select: { subtypes: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      icon: row.icon,
      global_category_code: row.globalCategoryCode,
      sort_order: row.sortOrder,
      is_active: row.isActive,
      source: row.source,
      subtype_count: row._count.subtypes,
    }));
  }

  async createCategory(
    principal: AuthenticatedPrincipal,
    dto: UpsertGrievanceCategoryDto,
  ): Promise<TenantAdminGrievanceCategoryRow> {
    assertTenantPortalAdminWrite(principal);
    assertCode(dto.code, 'category code');
    assertLocaleLabel(dto.name, 'category name');
    await this.assertGlobalCategoryExists(dto.global_category_code);

    const row = await this.prisma.tenantGrievanceCategory.create({
      data: {
        tenantId: principal.tenantId,
        code: dto.code.trim(),
        name: dto.name as Prisma.InputJsonValue,
        icon: dto.icon ?? 'MoreHorizontal',
        sortOrder: dto.sort_order ?? 500,
        isActive: dto.is_active ?? true,
        globalCategoryCode: dto.global_category_code?.trim() || null,
        source: 'tenant_only',
      },
      include: { _count: { select: { subtypes: true } } },
    });
    return this.toCategoryRow(row);
  }

  async patchCategory(
    principal: AuthenticatedPrincipal,
    code: string,
    dto: PatchGrievanceCategoryDto,
  ): Promise<TenantAdminGrievanceCategoryRow> {
    assertTenantPortalAdminWrite(principal);
    const existing = await this.requireCategory(principal.tenantId, code);
    if (dto.name) {
      assertLocaleLabel(dto.name, 'category name');
    }

    const row = await this.prisma.tenantGrievanceCategory.update({
      where: { id: existing.id },
      data: {
        name: dto.name ? (dto.name as Prisma.InputJsonValue) : undefined,
        icon: dto.icon,
        sortOrder: dto.sort_order,
        isActive: dto.is_active,
      },
      include: { _count: { select: { subtypes: true } } },
    });
    return this.toCategoryRow(row);
  }

  async listSubtypes(
    principal: AuthenticatedPrincipal,
    categoryCode: string,
  ): Promise<TenantAdminGrievanceSubtypeRow[]> {
    assertTenantPortalStaff(principal);
    await this.requireCategory(principal.tenantId, categoryCode);
    const rows = await this.prisma.tenantGrievanceSubtype.findMany({
      where: { tenantId: principal.tenantId, categoryCode },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    return rows.map((row) => this.toSubtypeRow(row));
  }

  async createSubtype(
    principal: AuthenticatedPrincipal,
    categoryCode: string,
    dto: UpsertGrievanceSubtypeDto,
  ): Promise<TenantAdminGrievanceSubtypeRow> {
    assertTenantPortalAdminWrite(principal);
    assertCode(dto.code, 'subtype code');
    assertLocaleLabel(dto.name, 'subtype name');
    await this.requireCategory(principal.tenantId, categoryCode);

    const row = await this.prisma.tenantGrievanceSubtype.create({
      data: {
        tenantId: principal.tenantId,
        categoryCode,
        code: dto.code.trim(),
        name: dto.name as Prisma.InputJsonValue,
        sortOrder: dto.sort_order ?? 0,
        isActive: dto.is_active ?? true,
        source: 'tenant_only',
      },
    });
    return this.toSubtypeRow(row);
  }

  async patchSubtype(
    principal: AuthenticatedPrincipal,
    categoryCode: string,
    subtypeCode: string,
    dto: PatchGrievanceSubtypeDto,
  ): Promise<TenantAdminGrievanceSubtypeRow> {
    assertTenantPortalAdminWrite(principal);
    if (dto.name) {
      assertLocaleLabel(dto.name, 'subtype name');
    }
    const existing = await this.requireSubtype(principal.tenantId, categoryCode, subtypeCode);

    const row = await this.prisma.tenantGrievanceSubtype.update({
      where: { id: existing.id },
      data: {
        name: dto.name ? (dto.name as Prisma.InputJsonValue) : undefined,
        sortOrder: dto.sort_order,
        isActive: dto.is_active,
      },
    });
    return this.toSubtypeRow(row);
  }

  async listSlaPolicies(principal: AuthenticatedPrincipal): Promise<TenantAdminSlaPolicyRow[]> {
    assertTenantPortalStaff(principal);
    const [policies, activeCodes] = await Promise.all([
      this.prisma.slaPolicy.findMany({
        where: { tenantId: principal.tenantId },
        orderBy: [{ sortOrder: 'asc' }],
      }),
      this.activeCategoryCodeSet(principal.tenantId),
    ]);
    return policies.map((row) => ({
      id: row.id,
      sort_order: row.sortOrder,
      category_match: row.categoryMatch,
      grievance_priority_match: row.grievancePriorityMatch,
      hours_to_resolve: row.hoursToResolve,
      orphan_category: Boolean(row.categoryMatch && !activeCodes.has(row.categoryMatch)),
    }));
  }

  async replaceSlaPolicies(
    principal: AuthenticatedPrincipal,
    dto: ReplaceSlaPoliciesDto,
  ): Promise<TenantAdminSlaPolicyRow[]> {
    assertTenantPortalAdminWrite(principal);
    const activeCodes = await this.activeCategoryCodeSet(principal.tenantId);
    for (const row of dto.policies) {
      if (row.category_match && !activeCodes.has(row.category_match)) {
        throw new BadRequestException(
          `SLA policy references unknown or inactive category: ${row.category_match}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.slaPolicy.deleteMany({ where: { tenantId: principal.tenantId } });
      if (dto.policies.length > 0) {
        await tx.slaPolicy.createMany({
          data: dto.policies.map((row, index) => ({
            tenantId: principal.tenantId,
            sortOrder: row.sort_order ?? index,
            categoryMatch: row.category_match?.trim() || null,
            grievancePriorityMatch: row.grievance_priority_match?.trim() || null,
            hoursToResolve: row.hours_to_resolve,
          })),
        });
      }
    });

    return this.listSlaPolicies(principal);
  }

  async listRoutingRules(principal: AuthenticatedPrincipal): Promise<TenantAdminRoutingRuleRow[]> {
    assertTenantPortalStaff(principal);
    const [rules, activeCodes] = await Promise.all([
      this.prisma.grievanceRoutingRule.findMany({
        where: { tenantId: principal.tenantId },
        orderBy: [{ sortOrder: 'asc' }],
      }),
      this.activeCategoryCodeSet(principal.tenantId),
    ]);
    return rules.map((row) => ({
      id: row.id,
      sort_order: row.sortOrder,
      category_match: row.categoryMatch,
      grievance_priority_match: row.grievancePriorityMatch,
      ward_id: row.wardId,
      target_role_code: row.targetRoleCode,
      assign_user_id: row.assignUserId,
      orphan_category: Boolean(row.categoryMatch && !activeCodes.has(row.categoryMatch)),
    }));
  }

  async replaceRoutingRules(
    principal: AuthenticatedPrincipal,
    dto: ReplaceGrievanceRoutingRulesDto,
  ): Promise<TenantAdminRoutingRuleRow[]> {
    assertTenantPortalAdminWrite(principal);
    const activeCodes = await this.activeCategoryCodeSet(principal.tenantId);
    for (const row of dto.rules) {
      if (row.category_match && !activeCodes.has(row.category_match)) {
        throw new BadRequestException(
          `Routing rule references unknown or inactive category: ${row.category_match}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.grievanceRoutingRule.deleteMany({ where: { tenantId: principal.tenantId } });
      if (dto.rules.length > 0) {
        await tx.grievanceRoutingRule.createMany({
          data: dto.rules.map((row, index) => ({
            tenantId: principal.tenantId,
            sortOrder: row.sort_order ?? index,
            categoryMatch: row.category_match?.trim() || null,
            grievancePriorityMatch: row.grievance_priority_match?.trim() || null,
            wardId: row.ward_id ?? null,
            targetRoleCode: row.target_role_code.trim(),
            assignUserId: row.assign_user_id ?? null,
          })),
        });
      }
    });

    return this.listRoutingRules(principal);
  }

  private async requireTenant(tenantId: string): Promise<{ id: string; code: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, code: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  private async requireCategory(tenantId: string, code: string) {
    const row = await this.prisma.tenantGrievanceCategory.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!row) {
      throw new NotFoundException(`Grievance category not found: ${code}`);
    }
    return row;
  }

  private async requireSubtype(tenantId: string, categoryCode: string, subtypeCode: string) {
    const row = await this.prisma.tenantGrievanceSubtype.findUnique({
      where: {
        tenantId_categoryCode_code: { tenantId, categoryCode, code: subtypeCode },
      },
    });
    if (!row) {
      throw new NotFoundException(`Grievance subtype not found: ${categoryCode}/${subtypeCode}`);
    }
    return row;
  }

  private async assertGlobalCategoryExists(code: string | null | undefined): Promise<void> {
    const trimmed = code?.trim();
    if (!trimmed) {
      return;
    }
    const global = await this.prisma.globalGrievanceCategory.findUnique({
      where: { code: trimmed },
    });
    if (!global) {
      throw new BadRequestException(`Unknown global category: ${trimmed}`);
    }
  }

  private async activeCategoryCodeSet(tenantId: string): Promise<Set<string>> {
    const rows = await this.prisma.tenantGrievanceCategory.findMany({
      where: { tenantId, isActive: true },
      select: { code: true },
    });
    return new Set(rows.map((row) => row.code));
  }

  private toCategoryRow(row: {
    id: string;
    code: string;
    name: Prisma.JsonValue;
    icon: string | null;
    globalCategoryCode: string | null;
    sortOrder: number;
    isActive: boolean;
    source: string;
    _count: { subtypes: number };
  }): TenantAdminGrievanceCategoryRow {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      icon: row.icon,
      global_category_code: row.globalCategoryCode,
      sort_order: row.sortOrder,
      is_active: row.isActive,
      source: row.source,
      subtype_count: row._count.subtypes,
    };
  }

  private toSubtypeRow(row: {
    id: string;
    categoryCode: string;
    code: string;
    name: Prisma.JsonValue;
    sortOrder: number;
    isActive: boolean;
    source: string;
  }): TenantAdminGrievanceSubtypeRow {
    return {
      id: row.id,
      category_code: row.categoryCode,
      code: row.code,
      name: row.name,
      sort_order: row.sortOrder,
      is_active: row.isActive,
      source: row.source,
    };
  }
}
