import { BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';

import { AdvertisingService } from './advertising.service';
import { MAX_HOARDING_MATRIX_ROWS } from './hoarding-rate.util';
import { resetHoardingQuoteRateLimitForTests } from './hoarding-quote-rate-limit';

describe('AdvertisingService', () => {
  const prismaMock = {
    tenantService: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    ward: {
      findMany: jest.fn(),
    },
  };

  const service = new AdvertisingService(prismaMock as never);

  const adminPrincipal = {
    tenantId: 'tenant-1',
    subject: 'admin-subject',
    roles: ['tenant_admin'],
  } as never;

  const citizenPrincipal = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    tenantCode: 'KMC',
    subject: 'citizen-subject',
    roles: ['citizen'],
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    resetHoardingQuoteRateLimitForTests();
    prismaMock.tenantService.findFirst.mockResolvedValue({
      id: 'svc-1',
      overrideConfig: {
        hoarding_rate_matrix: {
          flat_rate_paise_per_sqft_per_month: 5000,
          ward_rates: [{ ward_code: '12', rate_paise_per_sqft_per_month: 7500 }],
        },
      },
    });
    prismaMock.ward.findMany.mockResolvedValue([{ number: '12', name: 'Ward 12' }]);
    prismaMock.tenantService.update.mockResolvedValue({});
  });

  it('returns hoarding rate matrix for admin', async () => {
    const result = await service.getHoardingRateMatrix(adminPrincipal);
    expect(result.flat_rate_paise_per_sqft_per_month).toBe(5000);
    expect(result.wards).toEqual([{ number: '12', name: 'Ward 12' }]);
  });

  it('rejects matrix with too many ward rows', async () => {
    const ward_rates = Array.from({ length: MAX_HOARDING_MATRIX_ROWS + 1 }, (_, index) => ({
      ward_code: String(index + 1),
      rate_paise_per_sqft_per_month: 1000,
    }));

    await expect(service.replaceHoardingRateMatrix(adminPrincipal, { ward_rates })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('preview uses stored matrix', async () => {
    prismaMock.tenantService.findFirst.mockResolvedValue({
      id: 'svc-1',
      overrideConfig: {
        hoarding_rate_matrix: {
          ward_rates: [{ ward_code: '12', rate_paise_per_sqft_per_month: 7000 }],
        },
      },
    });

    const quote = await service.previewHoardingQuote(adminPrincipal, {
      ward_code: '12',
      width_ft: 10,
      height_ft: 10,
      duration_months: 1,
    });

    expect(quote.tax_paise).toBe(100 * 7000);
    expect(quote.ward_matched).toBe(true);
  });

  it('quotes hoarding tax for citizen with ward rate', async () => {
    const quote = await service.quoteHoardingForCitizen(citizenPrincipal, {
      tenant_code: 'KMC',
      ward_code: '12',
      width_ft: 10,
      height_ft: 8,
      duration_months: 3,
    });

    expect(quote.tax_paise).toBe(80 * 3 * 7500);
    expect(quote.ward_matched).toBe(true);
    expect(quote.quoted_at).toEqual(expect.any(String));
  });

  it('rejects citizen quote for non-citizen principal', async () => {
    await expect(
      service.quoteHoardingForCitizen(adminPrincipal, {
        tenant_code: 'KMC',
        ward_code: '12',
        width_ft: 10,
        height_ft: 8,
        duration_months: 1,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns ward context for citizen', async () => {
    const context = await service.getHoardingContextForCitizen(citizenPrincipal, 'KMC');
    expect(context.wards).toEqual([{ number: '12', name: 'Ward 12' }]);
  });

  it('enforces hoarding quote rate limit per citizen subject', async () => {
    process.env.HOARDING_QUOTE_LIMIT_PER_HOUR = '2';
    const dto = {
      tenant_code: 'KMC',
      ward_code: '12',
      width_ft: 10,
      height_ft: 8,
      duration_months: 1,
    };
    await service.quoteHoardingForCitizen(citizenPrincipal, dto);
    await service.quoteHoardingForCitizen(citizenPrincipal, dto);
    await expect(service.quoteHoardingForCitizen(citizenPrincipal, dto)).rejects.toThrow(
      HttpException,
    );
  });
});
