import { validateFormSchema } from '@enagar/forms';
import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { CITIZEN_PORTAL_TENANT_CODE, tenantSeeds } from '../tenants/tenant.seed';

import {
  getEffectiveService,
  globalServices,
  resolveEffectiveServices,
  revenueHeads,
  serviceCategories,
} from './service-catalogue.seed';

import type {
  EffectiveServiceSummary,
  FeeType,
  GlobalServiceSeed,
  LocaleMap,
  RevenueHeadSeed,
  ServiceCategorySeed,
} from './service-catalogue.seed';
import type { Prisma } from '../../generated/prisma';
import type { EnagarFormSchema } from '@enagar/forms';

type DbTenantServiceRow = {
  id: string;
  code: string;
  name: Prisma.JsonValue;
  description: Prisma.JsonValue;
  isActive: boolean;
  overrideConfig: Prisma.JsonValue;
  effectiveFeeConfig: Prisma.JsonValue;
  effectiveSlaDays: number | null;
  requiredDocuments: Prisma.JsonValue;
  category: { code: string; isActive: boolean };
  revenueHead: { code: string; accountingCode: string; isActive: boolean } | null;
  globalService: {
    workflowPattern: string;
    feeType: string;
    pushesToDigilocker: boolean;
  } | null;
  formVersions: Array<{
    id: string;
    version: number;
    formSchema: Prisma.JsonValue;
    uiSchema: Prisma.JsonValue;
    publishedAt: Date | null;
  }>;
};

@Injectable()
export class ServicesService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  listCategories(): ServiceCategorySeed[] {
    return [...serviceCategories].sort((left, right) => left.sort_order - right.sort_order);
  }

  listRevenueHeads(): RevenueHeadSeed[] {
    return [...revenueHeads].sort((left, right) => left.code.localeCompare(right.code));
  }

  /** Resolves canonical revenue + accounting codes for Sprint 3.2 ledger posting. */
  resolveLedgerCodesForService(service: EffectiveServiceSummary): {
    revenue_head_code: string;
    accounting_code: string;
  } {
    const code = service.revenue_head_code;
    if (!code) {
      throw new BadRequestException('Service has no revenue head; cannot post payment to GL');
    }

    if (service.accounting_code) {
      return { revenue_head_code: code, accounting_code: service.accounting_code };
    }

    const revenue = revenueHeads.find((head) => head.code === code);
    if (!revenue) {
      throw new NotFoundException(`Revenue head '${code}' missing from catalogue`);
    }

    return { revenue_head_code: code, accounting_code: revenue.accounting_code };
  }

  listGlobalServices(): GlobalServiceSeed[] {
    return [...globalServices].sort((left, right) => left.code.localeCompare(right.code));
  }

  async listTenantServices(tenantCode: string): Promise<EffectiveServiceSummary[]> {
    if (this.prisma) {
      return this.listTenantServicesFromDb(tenantCode);
    }

    this.assertTenantExists(tenantCode);

    return resolveEffectiveServices(tenantCode)
      .filter((service) => service.active)
      .map((service) => ({ ...service }));
  }

  async getTenantService(
    tenantCode: string,
    serviceCode: string,
  ): Promise<EffectiveServiceSummary> {
    if (this.prisma) {
      return this.getTenantServiceFromDb(tenantCode, serviceCode);
    }

    this.assertTenantExists(tenantCode);

    const service = getEffectiveService(tenantCode, serviceCode);
    if (!service?.active) {
      throw new NotFoundException('Service not found');
    }

    return { ...service };
  }

  /**
   * Union of distinct active catalogue service codes across every operational municipality
   * (`GET /tenants` omitting portal). Used so the hub KPI stays whole-portfolio without N PWA calls.
   */
  async distinctActiveServiceCodesAcrossMunicipalities(): Promise<number> {
    if (this.prisma) {
      const rows = await this.prisma.tenantService.findMany({
        where: {
          isActive: true,
          tenant: {
            is: {
              isActive: true,
              code: { not: CITIZEN_PORTAL_TENANT_CODE },
            },
          },
          category: { is: { isActive: true } },
          formVersions: { some: { status: 'published' } },
        },
        distinct: ['code'],
        select: { code: true },
      });
      return rows.length;
    }

    const codes = new Set<string>();

    for (const tenant of tenantSeeds) {
      if (!tenant.is_active || tenant.code === CITIZEN_PORTAL_TENANT_CODE) {
        continue;
      }

      for (const service of resolveEffectiveServices(tenant.code)) {
        if (service.active) {
          codes.add(service.code);
        }
      }
    }

    return codes.size;
  }

  private async listTenantServicesFromDb(tenantCode: string): Promise<EffectiveServiceSummary[]> {
    const tenant = await this.findActiveTenant(tenantCode);
    const rows = await this.prisma!.tenantService.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        category: { is: { isActive: true } },
        formVersions: { some: { status: 'published' } },
      },
      include: {
        category: { select: { code: true, isActive: true } },
        revenueHead: { select: { code: true, accountingCode: true, isActive: true } },
        globalService: {
          select: {
            workflowPattern: true,
            feeType: true,
            pushesToDigilocker: true,
          },
        },
        formVersions: {
          where: { status: 'published' },
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            version: true,
            formSchema: true,
            uiSchema: true,
            publishedAt: true,
          },
        },
      },
      orderBy: [{ code: 'asc' }],
    });

    return rows
      .filter((row) => row.category.isActive && (!row.revenueHead || row.revenueHead.isActive))
      .map((row) => toEffectiveServiceSummary(tenant.code, row));
  }

  private async getTenantServiceFromDb(
    tenantCode: string,
    serviceCode: string,
  ): Promise<EffectiveServiceSummary> {
    const tenant = await this.findActiveTenant(tenantCode);
    const row = await this.prisma!.tenantService.findFirst({
      where: {
        tenantId: tenant.id,
        code: serviceCode.trim().toLowerCase(),
        isActive: true,
        category: { is: { isActive: true } },
        formVersions: { some: { status: 'published' } },
      },
      include: {
        category: { select: { code: true, isActive: true } },
        revenueHead: { select: { code: true, accountingCode: true, isActive: true } },
        globalService: {
          select: {
            workflowPattern: true,
            feeType: true,
            pushesToDigilocker: true,
          },
        },
        formVersions: {
          where: { status: 'published' },
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            version: true,
            formSchema: true,
            uiSchema: true,
            publishedAt: true,
          },
        },
      },
    });

    if (!row || (row.revenueHead && !row.revenueHead.isActive)) {
      throw new NotFoundException('Service not found');
    }

    return toEffectiveServiceSummary(tenant.code, row);
  }

  private async findActiveTenant(tenantCode: string): Promise<{ id: string; code: string }> {
    const tenant = await this.prisma!.tenant.findFirst({
      where: { code: tenantCode.trim().toUpperCase(), isActive: true },
      select: { id: true, code: true },
    });
    if (!tenant || tenant.code === CITIZEN_PORTAL_TENANT_CODE) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  private assertTenantExists(tenantCode: string): void {
    const tenant = tenantSeeds.find(
      (candidate) => candidate.code.toLowerCase() === tenantCode.toLowerCase(),
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
  }
}

function toEffectiveServiceSummary(
  tenantCode: string,
  row: DbTenantServiceRow,
): EffectiveServiceSummary {
  const form = row.formVersions[0];
  if (!form) {
    throw new NotFoundException('Published service form not found');
  }

  const formSchema = coercePublishedFormSchema(form.formSchema);
  const feeType = resolveFeeType(row.effectiveFeeConfig, row.globalService?.feeType);

  return {
    service_id: row.id,
    form_version_id: form.id,
    tenant_code: tenantCode,
    code: row.code,
    category_code: row.category.code,
    revenue_head_code: row.revenueHead?.code ?? null,
    accounting_code: row.revenueHead?.accountingCode ?? null,
    name: coerceLocaleMap(row.name, row.code),
    description: coerceLocaleMap(row.description, ''),
    workflow_pattern: coerceWorkflowPattern(row.globalService?.workflowPattern),
    active: row.isActive,
    fee_type: feeType,
    fee_config: coerceRecord(row.effectiveFeeConfig, feeType),
    sla_days: row.effectiveSlaDays,
    required_documents: coerceDocumentCodes(row.requiredDocuments),
    pushes_to_digilocker: row.globalService?.pushesToDigilocker ?? false,
    source: coerceSource(row.overrideConfig),
    popular: false,
    form_version: form.version,
    form_schema: formSchema,
    ui_schema: coerceRecord(form.uiSchema),
    form_published_at: form.publishedAt?.toISOString() ?? null,
  };
}

function coercePublishedFormSchema(value: Prisma.JsonValue): EnagarFormSchema {
  const schema = value as unknown as EnagarFormSchema;
  const validation = validateFormSchema(schema);
  if (!validation.ok) {
    throw new BadRequestException({
      message: 'Published form schema is invalid',
      issues: validation.issues,
    });
  }
  return schema;
}

function coerceLocaleMap(value: Prisma.JsonValue, fallback: string): LocaleMap {
  const record = isRecord(value) ? value : {};
  return {
    en: typeof record.en === 'string' && record.en ? record.en : fallback,
    bn: typeof record.bn === 'string' && record.bn ? record.bn : fallback,
    hi: typeof record.hi === 'string' && record.hi ? record.hi : fallback,
  };
}

function coerceRecord(value: Prisma.JsonValue, feeType?: FeeType): Record<string, unknown> {
  const record = isRecord(value) ? { ...value } : {};
  if (feeType && typeof record.type !== 'string') {
    record.type = feeType;
  }
  return record;
}

function coerceDocumentCodes(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (isRecord(item) && typeof item.code === 'string') return item.code;
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function coerceSource(value: Prisma.JsonValue): EffectiveServiceSummary['source'] {
  const source = isRecord(value) ? value.source : undefined;
  return source === 'tenant_override' || source === 'tenant_only' ? source : 'global';
}

function resolveFeeType(value: Prisma.JsonValue, fallback?: string): FeeType {
  const configType = isRecord(value) ? value.type : undefined;
  if (isFeeType(configType)) return configType;
  if (isFeeType(fallback)) return fallback;
  if (isRecord(value) && typeof value.amount_paise === 'number') return 'fixed';
  return 'free';
}

function coerceWorkflowPattern(value?: string): EffectiveServiceSummary['workflow_pattern'] {
  if (
    value === 'cert-issuance' ||
    value === 'tax-payment' ||
    value === 'booking' ||
    value === 'noc' ||
    value === 'pension' ||
    value === 'fine' ||
    value === 'instant'
  ) {
    return value;
  }
  return 'instant';
}

function isFeeType(value: unknown): value is FeeType {
  return (
    value === 'free' ||
    value === 'fixed' ||
    value === 'slab' ||
    value === 'computed' ||
    value === 'external'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
