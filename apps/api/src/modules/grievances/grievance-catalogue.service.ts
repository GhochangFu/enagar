import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import type {
  GrievanceCatalogueCategoryDto,
  GrievanceCatalogueResponse,
  LocalizedName,
} from './grievance-catalogue.types';
import type { Prisma, PrismaClient } from '../../generated/prisma';

function parseLocalizedName(raw: Prisma.JsonValue): LocalizedName {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const en = typeof o.en === 'string' ? o.en : '';
    return {
      en: en || 'Category',
      bn: typeof o.bn === 'string' ? o.bn : undefined,
      hi: typeof o.hi === 'string' ? o.hi : undefined,
    };
  }
  return { en: 'Category' };
}

@Injectable()
export class GrievanceCatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveTenantIdByCode(
    tenantCode: string,
  ): Promise<{ tenantId: string; tenantCode: string }> {
    const code = tenantCode.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('tenant_code is required');
    }
    const tenant = await this.prisma.tenant.findFirst({
      where: { code, isActive: true },
      select: { id: true, code: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Unknown tenant_code: ${code}`);
    }
    return { tenantId: tenant.id, tenantCode: tenant.code };
  }

  async getActiveCatalogue(
    tenantId: string,
    tenantCode: string,
  ): Promise<GrievanceCatalogueResponse> {
    const categories = await this.prisma.tenantGrievanceCategory.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      include: {
        subtypes: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
      },
    });

    return {
      tenant_code: tenantCode,
      categories: categories.map((row) => this.toCategoryDto(row)),
    };
  }

  async getActiveCatalogueByTenantCode(tenantCode: string): Promise<GrievanceCatalogueResponse> {
    const { tenantId, tenantCode: resolved } = await this.resolveTenantIdByCode(tenantCode);
    return this.getActiveCatalogue(tenantId, resolved);
  }

  private toCategoryDto(row: {
    code: string;
    name: Prisma.JsonValue;
    icon: string | null;
    globalCategoryCode: string | null;
    sortOrder: number;
    subtypes: Array<{
      code: string;
      name: Prisma.JsonValue;
      sortOrder: number;
    }>;
  }): GrievanceCatalogueCategoryDto {
    return {
      code: row.code,
      name: parseLocalizedName(row.name),
      icon: row.icon,
      global_category_code: row.globalCategoryCode,
      sort_order: row.sortOrder,
      subtypes: row.subtypes.map((sub) => ({
        code: sub.code,
        name: parseLocalizedName(sub.name),
        sort_order: sub.sortOrder,
      })),
    };
  }
}

export type GrievanceFilingCategoryInput = {
  category: string;
  subtype_code?: string;
};

/**
 * Validates category/subtype against tenant catalogue when the tenant has configured rows.
 */
export async function assertGrievanceFilingMatchesCatalogue(
  prisma: Pick<PrismaClient, 'tenantGrievanceCategory' | 'tenantGrievanceSubtype'>,
  tenantId: string,
  input: GrievanceFilingCategoryInput,
): Promise<void> {
  const configuredCount = await prisma.tenantGrievanceCategory.count({
    where: { tenantId },
  });
  if (configuredCount === 0) {
    return;
  }

  const category = input.category.trim();
  const categoryRow = await prisma.tenantGrievanceCategory.findFirst({
    where: { tenantId, code: category, isActive: true },
    include: {
      subtypes: { where: { isActive: true }, select: { code: true } },
    },
  });

  if (!categoryRow) {
    throw new BadRequestException(`Unknown or inactive grievance category: ${category}`);
  }

  const activeSubtypes = categoryRow.subtypes;
  if (activeSubtypes.length === 0) {
    if (input.subtype_code?.trim()) {
      throw new BadRequestException(`subtype_code is not used for category ${category}`);
    }
    return;
  }

  const subtype = input.subtype_code?.trim();
  if (!subtype) {
    throw new BadRequestException(`subtype_code is required for category ${category}`);
  }

  const allowed = activeSubtypes.some((s) => s.code === subtype);
  if (!allowed) {
    throw new BadRequestException(
      `Unknown or inactive subtype ${subtype} for category ${category}`,
    );
  }
}
