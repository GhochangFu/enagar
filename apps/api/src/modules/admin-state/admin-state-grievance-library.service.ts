import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { assertCode, assertLocaleLabel } from '../admin-tenant/admin-tenant-config.contracts';

import { assertStateAdmin } from './admin-state.contracts';

import type {
  AdoptGrievanceCatalogueDto,
  PatchGlobalGrievanceCategoryDto,
  PatchGlobalGrievanceSubtypeDto,
  UpsertGlobalGrievanceCategoryDto,
  UpsertGlobalGrievanceSubtypeDto,
} from './dto/grievance-library.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';

export type GlobalGrievanceCategoryRow = {
  code: string;
  name: Prisma.JsonValue;
  icon: string | null;
  docket_code: string | null;
  sort_order: number;
  is_active: boolean;
  subtype_count: number;
  tenant_adoptions: number;
};

export type GlobalGrievanceSubtypeRow = {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  sort_order: number;
  is_active: boolean;
};

export type TenantGrievanceCatalogueOversightRow = {
  code: string;
  name: Prisma.JsonValue;
  source: string;
  global_category_code: string | null;
  is_active: boolean;
  subtype_count: number;
};

@Injectable()
export class AdminStateGrievanceLibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(principal: AuthenticatedPrincipal): Promise<GlobalGrievanceCategoryRow[]> {
    assertStateAdmin(principal);
    const rows = await this.prisma.globalGrievanceCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: {
        _count: { select: { subtypes: true, tenantCategories: true } },
      },
    });
    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      icon: row.icon,
      docket_code: row.docketCode,
      sort_order: row.sortOrder,
      is_active: row.isActive,
      subtype_count: row._count.subtypes,
      tenant_adoptions: row._count.tenantCategories,
    }));
  }

  async listSubtypes(
    principal: AuthenticatedPrincipal,
    categoryCode: string,
  ): Promise<GlobalGrievanceSubtypeRow[]> {
    assertStateAdmin(principal);
    await this.requireGlobalCategory(categoryCode);
    const rows = await this.prisma.globalGrievanceSubtype.findMany({
      where: { globalCategoryCode: categoryCode },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      sort_order: row.sortOrder,
      is_active: row.isActive,
    }));
  }

  async createCategory(
    principal: AuthenticatedPrincipal,
    dto: UpsertGlobalGrievanceCategoryDto,
  ): Promise<GlobalGrievanceCategoryRow> {
    assertStateAdmin(principal);
    assertCode(dto.code, 'category code');
    assertLocaleLabel(dto.name, 'category name');
    const row = await this.prisma.globalGrievanceCategory.create({
      data: {
        code: dto.code.trim(),
        name: dto.name as Prisma.InputJsonValue,
        icon: dto.icon ?? 'MoreHorizontal',
        docketCode: dto.docket_code?.trim() || null,
        sortOrder: dto.sort_order ?? 500,
        isActive: dto.is_active ?? true,
      },
      include: {
        _count: { select: { subtypes: true, tenantCategories: true } },
      },
    });
    return this.toCategoryRow(row);
  }

  async patchCategory(
    principal: AuthenticatedPrincipal,
    code: string,
    dto: PatchGlobalGrievanceCategoryDto,
  ): Promise<GlobalGrievanceCategoryRow> {
    assertStateAdmin(principal);
    await this.requireGlobalCategory(code);
    if (dto.name) {
      assertLocaleLabel(dto.name, 'category name');
    }
    const row = await this.prisma.globalGrievanceCategory.update({
      where: { code },
      data: {
        name: dto.name ? (dto.name as Prisma.InputJsonValue) : undefined,
        icon: dto.icon,
        docketCode: dto.docket_code === undefined ? undefined : dto.docket_code?.trim() || null,
        sortOrder: dto.sort_order,
        isActive: dto.is_active,
      },
      include: {
        _count: { select: { subtypes: true, tenantCategories: true } },
      },
    });
    return this.toCategoryRow(row);
  }

  async createSubtype(
    principal: AuthenticatedPrincipal,
    categoryCode: string,
    dto: UpsertGlobalGrievanceSubtypeDto,
  ): Promise<GlobalGrievanceSubtypeRow> {
    assertStateAdmin(principal);
    assertCode(dto.code, 'subtype code');
    assertLocaleLabel(dto.name, 'subtype name');
    await this.requireGlobalCategory(categoryCode);
    const row = await this.prisma.globalGrievanceSubtype.create({
      data: {
        globalCategoryCode: categoryCode,
        code: dto.code.trim(),
        name: dto.name as Prisma.InputJsonValue,
        sortOrder: dto.sort_order ?? 0,
        isActive: dto.is_active ?? true,
      },
    });
    return this.toSubtypeRow(row);
  }

  async patchSubtype(
    principal: AuthenticatedPrincipal,
    categoryCode: string,
    subtypeCode: string,
    dto: PatchGlobalGrievanceSubtypeDto,
  ): Promise<GlobalGrievanceSubtypeRow> {
    assertStateAdmin(principal);
    if (dto.name) {
      assertLocaleLabel(dto.name, 'subtype name');
    }
    const existing = await this.requireGlobalSubtype(categoryCode, subtypeCode);
    const row = await this.prisma.globalGrievanceSubtype.update({
      where: { id: existing.id },
      data: {
        name: dto.name ? (dto.name as Prisma.InputJsonValue) : undefined,
        sortOrder: dto.sort_order,
        isActive: dto.is_active,
      },
    });
    return this.toSubtypeRow(row);
  }

  async listTenantCatalogueOversight(
    principal: AuthenticatedPrincipal,
    tenantCode: string,
  ): Promise<{
    tenant_code: string;
    adopted: TenantGrievanceCatalogueOversightRow[];
    global_available: GlobalGrievanceCategoryRow[];
  }> {
    assertStateAdmin(principal);
    const tenant = await this.requireTenantByCode(tenantCode);
    const [tenantRows, globalRows] = await Promise.all([
      this.prisma.tenantGrievanceCategory.findMany({
        where: { tenantId: tenant.id },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        include: { _count: { select: { subtypes: true } } },
      }),
      this.prisma.globalGrievanceCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        include: {
          _count: { select: { subtypes: true, tenantCategories: true } },
        },
      }),
    ]);
    const adoptedGlobalCodes = new Set(
      tenantRows
        .map((row) => row.globalCategoryCode)
        .filter((code): code is string => Boolean(code)),
    );
    const adoptedCodes = new Set(tenantRows.map((row) => row.code));

    return {
      tenant_code: tenant.code,
      adopted: tenantRows.map((row) => ({
        code: row.code,
        name: row.name,
        source: row.source,
        global_category_code: row.globalCategoryCode,
        is_active: row.isActive,
        subtype_count: row._count.subtypes,
      })),
      global_available: globalRows
        .filter((row) => !adoptedGlobalCodes.has(row.code) && !adoptedCodes.has(row.code))
        .map((row) => this.toCategoryRow(row)),
    };
  }

  async adoptForTenant(
    principal: AuthenticatedPrincipal,
    tenantCode: string,
    dto: AdoptGrievanceCatalogueDto,
  ): Promise<{ adopted: string[] }> {
    assertStateAdmin(principal);
    const tenant = await this.requireTenantByCode(tenantCode);
    const adopted: string[] = [];

    for (const rawCode of dto.category_codes) {
      assertCode(rawCode, 'category code');
      const globalCode = rawCode.trim();
      const row = await this.adoptOneCategoryForTenant(tenant.id, globalCode);
      adopted.push(row.code);
    }

    return { adopted };
  }

  private async adoptOneCategoryForTenant(
    tenantId: string,
    globalCode: string,
  ): Promise<{ code: string }> {
    const global = await this.prisma.globalGrievanceCategory.findUnique({
      where: { code: globalCode },
      include: {
        subtypes: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }] },
      },
    });
    if (!global || !global.isActive) {
      throw new NotFoundException(`Active global category not found: ${globalCode}`);
    }

    const conflict = await this.prisma.tenantGrievanceCategory.findUnique({
      where: { tenantId_code: { tenantId, code: global.code } },
    });
    if (conflict && conflict.globalCategoryCode !== global.code) {
      throw new BadRequestException(
        `Tenant already has a different category using code ${global.code}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantGrievanceCategory.upsert({
        where: { tenantId_code: { tenantId, code: global.code } },
        create: {
          tenantId,
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
      });

      for (const sub of global.subtypes) {
        await tx.tenantGrievanceSubtype.upsert({
          where: {
            tenantId_categoryCode_code: {
              tenantId,
              categoryCode: global.code,
              code: sub.code,
            },
          },
          create: {
            tenantId,
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
    });

    return { code: global.code };
  }

  private async requireGlobalCategory(code: string) {
    const row = await this.prisma.globalGrievanceCategory.findUnique({ where: { code } });
    if (!row) {
      throw new NotFoundException(`Global category not found: ${code}`);
    }
    return row;
  }

  private async requireGlobalSubtype(categoryCode: string, subtypeCode: string) {
    const row = await this.prisma.globalGrievanceSubtype.findFirst({
      where: { globalCategoryCode: categoryCode, code: subtypeCode },
    });
    if (!row) {
      throw new NotFoundException(`Global subtype not found: ${categoryCode}/${subtypeCode}`);
    }
    return row;
  }

  private async requireTenantByCode(tenantCode: string) {
    const code = tenantCode.trim().toUpperCase();
    const tenant = await this.prisma.tenant.findFirst({
      where: { code, isActive: true },
      select: { id: true, code: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Unknown tenant: ${code}`);
    }
    return tenant;
  }

  private toCategoryRow(row: {
    code: string;
    name: Prisma.JsonValue;
    icon: string | null;
    docketCode: string | null;
    sortOrder: number;
    isActive: boolean;
    _count: { subtypes: number; tenantCategories: number };
  }): GlobalGrievanceCategoryRow {
    return {
      code: row.code,
      name: row.name,
      icon: row.icon,
      docket_code: row.docketCode,
      sort_order: row.sortOrder,
      is_active: row.isActive,
      subtype_count: row._count.subtypes,
      tenant_adoptions: row._count.tenantCategories,
    };
  }

  private toSubtypeRow(row: {
    id: string;
    code: string;
    name: Prisma.JsonValue;
    sortOrder: number;
    isActive: boolean;
  }): GlobalGrievanceSubtypeRow {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      sort_order: row.sortOrder,
      is_active: row.isActive,
    };
  }
}
