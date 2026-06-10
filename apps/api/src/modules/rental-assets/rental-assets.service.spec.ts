import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../common/database/prisma.service';

import {
  CreateLeaseAgreementDto,
  CreateRentalAssetDto,
  RatePeriod,
  RentalAssetType,
} from './dto/rental-assets.dto';
import { RentalAssetsService } from './rental-assets.service';

describe('RentalAssetsService', () => {
  let service: RentalAssetsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RentalAssetsService,
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              findUnique: jest.fn(),
            },
            rentalAsset: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            leaseAgreement: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<RentalAssetsService>(RentalAssetsService);
    prisma = moduleRef.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  describe('createAsset', () => {
    it('should create a new rental asset with status AVAILABLE', async () => {
      const dto: CreateRentalAssetDto = {
        assetType: RentalAssetType.HOARDING,
        name: { en: 'Test Hoarding' },
        location: { address: '123 Main St' },
        baseLeaseRatePaise: 500000,
        ratePeriod: RatePeriod.MONTHLY,
      };

      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 'tenant-1', code: 'KMC' });
      (prisma.rentalAsset.create as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        status: 'AVAILABLE',
        ...dto,
      });

      const result = await service.createAsset('KMC', dto);
      expect(result.status).toBe('AVAILABLE');
      expect(prisma.rentalAsset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            status: 'AVAILABLE',
          }),
        }),
      );
    });
  });

  describe('updateAgreement', () => {
    it('should throw NotFoundException when tenant does not exist', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateAgreement('KMC', 'agreement-1', { lessorPhone: '9876543210' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when agreement is not in this tenant', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 'tenant-1', code: 'KMC' });
      (prisma.leaseAgreement.findFirst as jest.Mock) = jest.fn().mockResolvedValue(null);

      await expect(
        service.updateAgreement('KMC', 'agreement-1', { lessorPhone: '9876543210' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should trim and store lessorPhone when provided', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 'tenant-1', code: 'KMC' });
      (prisma.leaseAgreement.findFirst as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'agreement-1',
        tenantId: 'tenant-1',
      });
      (prisma.leaseAgreement.update as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ id: 'agreement-1', lessorPhone: '9876543210' });

      await service.updateAgreement('KMC', 'agreement-1', { lessorPhone: '  9876543210  ' });

      expect(prisma.leaseAgreement.update).toHaveBeenCalledWith({
        where: { id: 'agreement-1' },
        data: { lessorPhone: '9876543210' },
      });
    });

    it('should treat empty string as a clear (set to null)', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 'tenant-1', code: 'KMC' });
      (prisma.leaseAgreement.findFirst as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'agreement-1',
        tenantId: 'tenant-1',
      });
      (prisma.leaseAgreement.update as jest.Mock) = jest
        .fn()
        .mockResolvedValue({ id: 'agreement-1', lessorPhone: null });

      await service.updateAgreement('KMC', 'agreement-1', { lessorPhone: '   ' });

      expect(prisma.leaseAgreement.update).toHaveBeenCalledWith({
        where: { id: 'agreement-1' },
        data: { lessorPhone: null },
      });
    });

    it('should not call update when dto is empty (no-op)', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 'tenant-1', code: 'KMC' });
      (prisma.leaseAgreement.findFirst as jest.Mock) = jest.fn().mockResolvedValue({
        id: 'agreement-1',
        tenantId: 'tenant-1',
      });
      (prisma.leaseAgreement.update as jest.Mock) = jest.fn();

      await service.updateAgreement('KMC', 'agreement-1', {});

      expect(prisma.leaseAgreement.update).not.toHaveBeenCalled();
    });
  });

  describe('createAgreement', () => {
    it('should throw BadRequestException if tradeLicenseNo is empty or missing', async () => {
      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 'tenant-1', code: 'KMC' });
      const dto = {
        assetId: 'asset-1',
        tradeLicenseNo: '', // Simulating missing/empty validation failure catch
        lessorName: 'Test Corp',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      } as CreateLeaseAgreementDto;

      await expect(service.createAgreement('KMC', dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if asset is not AVAILABLE', async () => {
      const dto: CreateLeaseAgreementDto = {
        assetId: 'asset-1',
        tradeLicenseNo: 'TL-123',
        lessorName: 'Test Corp',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      };

      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 'tenant-1', code: 'KMC' });

      // Mock transaction
      prisma.$transaction.mockImplementation(async (fn) => {
        const mockTx = {
          rentalAsset: {
            findUnique: jest.fn().mockResolvedValue({ id: 'asset-1', status: 'RENTED' }), // Already rented!
          },
        };
        return fn(mockTx as unknown as typeof prisma);
      });

      await expect(service.createAgreement('KMC', dto)).rejects.toThrow(BadRequestException);
    });

    it('should successfully create agreement and update asset status to RENTED', async () => {
      const dto: CreateLeaseAgreementDto = {
        assetId: 'asset-1',
        tradeLicenseNo: 'TL-123',
        lessorName: 'Test Corp',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      };

      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({ id: 'tenant-1', code: 'KMC' });

      const mockCreatedAgreement = { id: 'agreement-1', status: 'ACTIVE' };
      const mockTx = {
        rentalAsset: {
          findUnique: jest.fn().mockResolvedValue({ id: 'asset-1', status: 'AVAILABLE' }),
          update: jest.fn().mockResolvedValue({ id: 'asset-1', status: 'RENTED' }),
        },
        leaseAgreement: {
          create: jest.fn().mockResolvedValue(mockCreatedAgreement),
        },
      } as unknown as typeof prisma;

      prisma.$transaction.mockImplementation(async (fn) => fn(mockTx));

      const result = await service.createAgreement('KMC', dto);

      expect(result).toEqual(mockCreatedAgreement);
      expect(mockTx.rentalAsset.findUnique).toHaveBeenCalledWith({
        where: { id: 'asset-1', tenantId: 'tenant-1' },
      });
      expect(mockTx.leaseAgreement.create).toHaveBeenCalled();
      expect(mockTx.rentalAsset.update).toHaveBeenCalledWith({
        where: { id: 'asset-1' },
        data: { status: 'RENTED' },
      });
    });
  });
});
