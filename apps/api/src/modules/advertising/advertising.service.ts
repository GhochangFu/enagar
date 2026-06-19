import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  isCitizenSelfServicePrincipal,
  resolveCitizenMunicipalityForWrite,
} from '../../common/auth/citizen-scope';
import { PrismaService } from '../../common/database/prisma.service';
import { assertTenantPortalStaff } from '../admin-tenant/tenant-admin-portal-roles';
import { tenantSeeds } from '../tenants/tenant.seed';

import {
  computeHoardingTaxPaise,
  DEFAULT_FLAT_RATE_PAISE_PER_SQFT_PER_MONTH,
  AD_HOARDING_SERVICE_CODE,
  parseHoardingRateMatrix,
  validateHoardingRateMatrix,
} from './hoarding-rate.util';
import { buildHoardingCalculatorSnapshot } from './hoarding-quote.util';
import { assertHoardingQuoteRateLimit } from './hoarding-quote-rate-limit';

import type { PreviewHoardingQuoteDto, ReplaceHoardingRateMatrixDto, CitizenHoardingQuoteDto } from './dto/advertising.dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { Prisma } from '../../generated/prisma';

export type HoardingRateMatrixResponse = {
  flat_rate_paise_per_sqft_per_month: number;
  ward_rates: Array<{ ward_code: string; rate_paise_per_sqft_per_month: number }>;
  wards: Array<{ number: string; name: string | null }>;
};

@Injectable()
export class AdvertisingService {
  constructor(private readonly prisma: PrismaService) {}

  async getHoardingRateMatrix(principal: AuthenticatedPrincipal): Promise<HoardingRateMatrixResponse> {
    assertTenantPortalStaff(principal);
    const service = await this.getAdHoardingService(principal.tenantId);
    const matrix = this.readMatrixFromOverride(service.overrideConfig);
    const wards = await this.prisma.ward.findMany({
      where: { tenantId: principal.tenantId },
      select: { number: true, name: true },
      orderBy: { number: 'asc' },
    });

    return {
      flat_rate_paise_per_sqft_per_month:
        matrix.flat_rate_paise_per_sqft_per_month ?? DEFAULT_FLAT_RATE_PAISE_PER_SQFT_PER_MONTH,
      ward_rates: matrix.ward_rates ?? [],
      wards: wards.map((ward) => ({ number: ward.number, name: ward.name })),
    };
  }

  async replaceHoardingRateMatrix(
    principal: AuthenticatedPrincipal,
    dto: ReplaceHoardingRateMatrixDto,
  ): Promise<HoardingRateMatrixResponse> {
    assertTenantPortalStaff(principal);
    const service = await this.getAdHoardingService(principal.tenantId);

    const nextMatrix = parseHoardingRateMatrix({
      ...(dto.flat_rate_paise_per_sqft_per_month !== undefined
        ? { flat_rate_paise_per_sqft_per_month: dto.flat_rate_paise_per_sqft_per_month }
        : {}),
      ...(dto.ward_rates !== undefined ? { ward_rates: dto.ward_rates } : {}),
    });
    validateHoardingRateMatrix(nextMatrix);

    const override =
      service.overrideConfig && typeof service.overrideConfig === 'object' && !Array.isArray(service.overrideConfig)
        ? { ...(service.overrideConfig as Record<string, unknown>) }
        : {};

    await this.prisma.tenantService.update({
      where: { id: service.id },
      data: {
        overrideConfig: {
          ...override,
          hoarding_rate_matrix: nextMatrix,
        } as Prisma.InputJsonValue,
      },
    });

    return this.getHoardingRateMatrix(principal);
  }

  async previewHoardingQuote(principal: AuthenticatedPrincipal, dto: PreviewHoardingQuoteDto) {
    assertTenantPortalStaff(principal);
    const service = await this.getAdHoardingService(principal.tenantId);
    const matrix = this.readMatrixFromOverride(service.overrideConfig);
    return computeHoardingTaxPaise({
      matrix,
      wardCode: dto.ward_code,
      widthFt: dto.width_ft,
      heightFt: dto.height_ft,
      durationMonths: dto.duration_months,
    });
  }

  async getHoardingContextForCitizen(principal: AuthenticatedPrincipal, tenantCodeRaw: string) {
    const { tenantId } = this.resolveCitizenTenant(principal, tenantCodeRaw);
    await this.getAdHoardingService(tenantId);
    const wards = await this.prisma.ward.findMany({
      where: { tenantId },
      select: { number: true, name: true },
      orderBy: { number: 'asc' },
    });
    return {
      wards: wards.map((ward) => ({ number: ward.number, name: ward.name })),
    };
  }

  async quoteHoardingForCitizen(principal: AuthenticatedPrincipal, dto: CitizenHoardingQuoteDto) {
    assertHoardingQuoteRateLimit(principal.subject);
    const { tenantId } = this.resolveCitizenTenant(principal, dto.tenant_code);
    const matrix = await this.getHoardingRateMatrixForTenant(tenantId);
    const quote = computeHoardingTaxPaise({
      matrix,
      wardCode: dto.ward_code,
      widthFt: dto.width_ft,
      heightFt: dto.height_ft,
      durationMonths: dto.duration_months,
    });
    return buildHoardingCalculatorSnapshot(quote);
  }

  /** Used by 8.5B citizen quote — loads matrix for tenant. */
  async getHoardingRateMatrixForTenant(tenantId: string) {
    const service = await this.prisma.tenantService.findFirst({
      where: { tenantId, code: AD_HOARDING_SERVICE_CODE, isActive: true },
      select: { overrideConfig: true },
    });
    if (!service) {
      throw new NotFoundException('Hoarding service is not configured for this municipality');
    }
    return this.readMatrixFromOverride(service.overrideConfig);
  }

  private readMatrixFromOverride(overrideConfig: Prisma.JsonValue) {
    if (!overrideConfig || typeof overrideConfig !== 'object' || Array.isArray(overrideConfig)) {
      return parseHoardingRateMatrix({});
    }
    const record = overrideConfig as Record<string, unknown>;
    return parseHoardingRateMatrix(record.hoarding_rate_matrix);
  }

  private async getAdHoardingService(tenantId: string) {
    const service = await this.prisma.tenantService.findFirst({
      where: { tenantId, code: AD_HOARDING_SERVICE_CODE, isActive: true },
      select: { id: true, overrideConfig: true },
    });
    if (!service) {
      throw new NotFoundException('Hoarding service is not configured for this municipality');
    }
    return service;
  }

  private resolveCitizenTenant(principal: AuthenticatedPrincipal, tenantCodeRaw: string) {
    if (!isCitizenSelfServicePrincipal(principal)) {
      throw new ForbiddenException('Citizen access required');
    }
    const { tenantId, tenantCode } = resolveCitizenMunicipalityForWrite(
      principal,
      tenantSeeds,
      tenantCodeRaw,
    );
    if (tenantCode.toUpperCase() !== tenantCodeRaw.trim().toUpperCase()) {
      throw new BadRequestException('tenant_code must match active municipality scope');
    }
    return { tenantId, tenantCode };
  }
}
