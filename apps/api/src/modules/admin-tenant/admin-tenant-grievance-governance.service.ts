import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { assertCode } from './admin-tenant-config.contracts';
import { assertTenantPortalAdminWrite, assertTenantPortalStaff } from './tenant-admin-portal-roles';

import type { TenantAdminGrievanceCategoryRow } from './admin-tenant-grievance-config.service';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';

export type TenantGrievanceGovernanceRow = TenantAdminGrievanceCategoryRow & {
  row_kind: 'tenant' | 'global_available';
  can_adopt: boolean;
  can_fork: boolean;
  can_deactivate: boolean;
};

@Injectable()
export class AdminTenantGrievanceGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listGovernance(principal: AuthenticatedPrincipal): Promise<TenantGrievanceGovernanceRow[]> {
    assertTenantPortalStaff(principal);
    const tenantId = principal.tenantId;

    const [tenantRows, globalRows] = await Promise.all([
      this.prisma.tenantGrievanceCategory.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        include: { _count: { select: { subtypes: true } } },
      }),
      this.prisma.globalGrievanceCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        include: { _count: { select: { subtypes: true } } },
      }),
    ]);

    const adoptedGlobal = new Set(
      tenantRows
        .map((row) => row.globalCategoryCode)
        .filter((code): code is string => Boolean(code)),
    );
    const tenantCodes = new Set(tenantRows.map((row) => row.code));

    const rows: TenantGrievanceGovernanceRow[] = tenantRows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      icon: row.icon,
      global_category_code: row.globalCategoryCode,
      sort_order: row.sortOrder,
      is_active: row.isActive,
      source: row.source,
      subtype_count: row._count.subtypes,
      row_kind: 'tenant',
      can_adopt: false,
      can_fork: row.isActive,
      can_deactivate: row.isActive,
    }));

    for (const global of globalRows) {
      if (adoptedGlobal.has(global.code) || tenantCodes.has(global.code)) {
        continue;
      }
      rows.push({
        id: `global:${global.code}`,
        code: global.code,
        name: global.name,
        icon: global.icon,
        global_category_code: global.code,
        sort_order: global.sortOrder,
        is_active: true,
        source: 'global_available',
        subtype_count: global._count.subtypes,
        row_kind: 'global_available',
        can_adopt: true,
        can_fork: false,
        can_deactivate: false,
      });
    }

    return rows.sort(
      (left, right) => left.sort_order - right.sort_order || left.code.localeCompare(right.code),
    );
  }

  async adoptGlobalCategory(
    principal: AuthenticatedPrincipal,
    globalCode: string,
  ): Promise<TenantAdminGrievanceCategoryRow> {
    assertTenantPortalAdminWrite(principal);
    assertCode(globalCode, 'global category code');
    const code = globalCode.trim();

    const global = await this.prisma.globalGrievanceCategory.findUnique({
      where: { code },
      include: {
        subtypes: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }] },
        _count: { select: { subtypes: true } },
      },
    });
    if (!global || !global.isActive) {
      throw new NotFoundException('Active global category not found');
    }

    const conflict = await this.prisma.tenantGrievanceCategory.findUnique({
      where: { tenantId_code: { tenantId: principal.tenantId, code: global.code } },
    });
    if (conflict && conflict.globalCategoryCode !== global.code) {
      throw new BadRequestException(`Tenant category code ${global.code} is already in use`);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const category = await tx.tenantGrievanceCategory.upsert({
        where: { tenantId_code: { tenantId: principal.tenantId, code: global.code } },
        create: {
          tenantId: principal.tenantId,
          code: global.code,
          globalCategoryCode: global.code,
          name: global.name as Prisma.InputJsonValue,
          icon: global.icon,
          sortOrder: global.sortOrder,
          isActive: true,
          source: 'global_adopted',
        },
        update: {
          globalCategoryCode: global.code,
          name: global.name as Prisma.InputJsonValue,
          icon: global.icon,
          sortOrder: global.sortOrder,
          isActive: true,
          source: 'global_adopted',
        },
        include: { _count: { select: { subtypes: true } } },
      });

      for (const sub of global.subtypes) {
        await tx.tenantGrievanceSubtype.upsert({
          where: {
            tenantId_categoryCode_code: {
              tenantId: principal.tenantId,
              categoryCode: global.code,
              code: sub.code,
            },
          },
          create: {
            tenantId: principal.tenantId,
            categoryCode: global.code,
            code: sub.code,
            name: sub.name as Prisma.InputJsonValue,
            sortOrder: sub.sortOrder,
            isActive: true,
            source: 'global_adopted',
          },
          update: {
            name: sub.name as Prisma.InputJsonValue,
            sortOrder: sub.sortOrder,
            isActive: true,
            source: 'global_adopted',
          },
        });
      }

      return category;
    });

    return this.toCategoryRow(row);
  }

  async forkCategory(
    principal: AuthenticatedPrincipal,
    categoryCode: string,
  ): Promise<TenantAdminGrievanceCategoryRow> {
    assertTenantPortalAdminWrite(principal);
    assertCode(categoryCode, 'category code');
    const sourceCode = categoryCode.trim();

    const existing = await this.prisma.tenantGrievanceCategory.findUnique({
      where: { tenantId_code: { tenantId: principal.tenantId, code: sourceCode } },
      include: { subtypes: { orderBy: [{ sortOrder: 'asc' }] } },
    });

    const global = await this.prisma.globalGrievanceCategory.findUnique({
      where: { code: sourceCode },
      include: { subtypes: { orderBy: [{ sortOrder: 'asc' }] } },
    });

    const source = existing ?? global;
    if (!source) {
      throw new NotFoundException('Category not found for fork');
    }

    const forkCode = nextForkCode(sourceCode);
    const conflict = await this.prisma.tenantGrievanceCategory.findUnique({
      where: { tenantId_code: { tenantId: principal.tenantId, code: forkCode } },
    });
    if (conflict) {
      throw new BadRequestException(`Fork already exists as ${forkCode}`);
    }

    const subtypes = 'subtypes' in source && Array.isArray(source.subtypes) ? source.subtypes : [];

    const row = await this.prisma.$transaction(async (tx) => {
      const category = await tx.tenantGrievanceCategory.create({
        data: {
          tenantId: principal.tenantId,
          code: forkCode,
          globalCategoryCode: null,
          name: source.name as Prisma.InputJsonValue,
          icon: 'icon' in source ? source.icon : null,
          sortOrder: 'sortOrder' in source ? source.sortOrder : 500,
          isActive: true,
          source: 'forked',
        },
        include: { _count: { select: { subtypes: true } } },
      });

      for (const sub of subtypes) {
        await tx.tenantGrievanceSubtype.create({
          data: {
            tenantId: principal.tenantId,
            categoryCode: forkCode,
            code: sub.code,
            name: sub.name as Prisma.InputJsonValue,
            sortOrder: sub.sortOrder,
            isActive: 'isActive' in sub ? sub.isActive : true,
            source: 'forked',
          },
        });
      }

      return category;
    });

    return this.toCategoryRow(row);
  }

  async deactivateCategory(
    principal: AuthenticatedPrincipal,
    categoryCode: string,
  ): Promise<TenantAdminGrievanceCategoryRow> {
    assertTenantPortalAdminWrite(principal);
    assertCode(categoryCode, 'category code');
    const code = categoryCode.trim();

    let row = await this.prisma.tenantGrievanceCategory.findUnique({
      where: { tenantId_code: { tenantId: principal.tenantId, code } },
      include: { _count: { select: { subtypes: true } } },
    });

    if (!row) {
      await this.adoptGlobalCategory(principal, code);
      row = await this.prisma.tenantGrievanceCategory.findUnique({
        where: { tenantId_code: { tenantId: principal.tenantId, code } },
        include: { _count: { select: { subtypes: true } } },
      });
    }

    if (!row) {
      throw new NotFoundException('Category not found');
    }

    const updated = await this.prisma.tenantGrievanceCategory.update({
      where: { id: row.id },
      data: { isActive: false },
      include: { _count: { select: { subtypes: true } } },
    });

    return this.toCategoryRow(updated);
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
}

function nextForkCode(code: string): string {
  return `${code}-local`;
}
