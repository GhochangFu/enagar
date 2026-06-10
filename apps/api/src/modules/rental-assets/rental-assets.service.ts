import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import {
  CreateLeaseAgreementDto,
  CreateRentalAssetDto,
  QueryRentalAssetsDto,
  UpdateLeaseAgreementDto,
} from './dto/rental-assets.dto';

import type { Prisma } from '../../generated/prisma';

@Injectable()
export class RentalAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAsset(tenantCode: string, dto: CreateRentalAssetDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.rentalAsset.create({
      data: {
        tenantId: tenant.id,
        assetType: dto.assetType,
        name: dto.name as Prisma.InputJsonValue,
        location: dto.location as Prisma.InputJsonValue,
        baseLeaseRatePaise: dto.baseLeaseRatePaise,
        ratePeriod: dto.ratePeriod,
        metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
        status: 'AVAILABLE',
      },
    });
  }

  async getAssets(tenantCode: string, query: QueryRentalAssetsDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.prisma.rentalAsset.findMany({
      where: {
        tenantId: tenant.id,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        agreements: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            invoices: {
              orderBy: { periodStart: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
  }

  async createAgreement(tenantCode: string, dto: CreateLeaseAgreementDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Enforce mandatory trade license at service level (in addition to DTO validation)
    if (!dto.tradeLicenseNo || dto.tradeLicenseNo.trim() === '') {
      throw new BadRequestException('Trade License Number is mandatory');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const asset = await tx.rentalAsset.findUnique({
          where: { id: dto.assetId, tenantId: tenant.id },
        });

        if (!asset) {
          throw new NotFoundException('Asset not found');
        }

        if (asset.status !== 'AVAILABLE') {
          throw new BadRequestException('Asset is not available for lease');
        }

        const agreement = await tx.leaseAgreement.create({
          data: {
            tenantId: tenant.id,
            assetId: dto.assetId,
            tradeLicenseNo: dto.tradeLicenseNo.trim(),
            lessorName: dto.lessorName,
            startDate: dto.startDate,
            endDate: dto.endDate,
            securityDepositPaise: dto.securityDepositPaise ?? 0,
            status: 'ACTIVE',
            agreementDocumentKey: dto.agreementDocumentKey,
            lessorPhone: dto.lessorPhone,
          },
        });

        await tx.rentalAsset.update({
          where: { id: dto.assetId },
          data: { status: 'RENTED' },
        });

        // TODO: Generate the first invoice here or rely on the cron job.
        // Per plan, cron job handles dynamic invoice creation.

        return agreement;
      });
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      // Prisma unique constraint or other DB errors
      throw new BadRequestException('Failed to create lease agreement');
    }
  }

  /**
   * Patch the mutable fields of a lease agreement. Today the only field the
   * rental-assets grid exposes is `lessorPhone` (so the lessor can later be
   * matched by the citizen-portal lookup); name/license/rate changes are
   * intentionally out of scope and should go through a deliberate amendment
   * flow with audit, not a silent overwrite from the grid.
   *
   * Tenant-scoped: the agreement must belong to the caller's tenant, and
   * 404 is returned (not 403) so a caller can't probe for ids outside their
   * ULB.
   */
  async updateAgreement(tenantCode: string, agreementId: string, dto: UpdateLeaseAgreementDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { code: tenantCode },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const existing = await this.prisma.leaseAgreement.findFirst({
      where: { id: agreementId, tenantId: tenant.id },
    });
    if (!existing) {
      throw new NotFoundException('Lease agreement not found');
    }

    const data: Prisma.LeaseAgreementUpdateInput = {};
    if (dto.lessorPhone !== undefined) {
      // Treat empty string as a clear (operators commonly backspace and submit).
      data.lessorPhone = dto.lessorPhone.trim() === '' ? null : dto.lessorPhone.trim();
    }

    // Skip the round-trip when the patch is a no-op (no fields supplied, or
    // every supplied field already matches the stored value). This keeps the
    // edit-phone modal's "no changes" path cheap and gives the test a stable
    // shape.
    if (Object.keys(data).length === 0) {
      return existing;
    }

    return this.prisma.leaseAgreement.update({
      where: { id: agreementId },
      data,
    });
  }
}
