import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import {
  formatApplicationAccountSummary,
  formatGrievanceAccountSummary,
  formatPaymentAccountSummary,
  OPEN_GRIEVANCE_STATUSES,
  type CitizenAccountSummaries,
} from './citizen-account-context';

@Injectable()
export class ChatbotContextService {
  constructor(private readonly prisma: PrismaService) {}

  async buildCitizenSummary(params: {
    tenantId: string;
    citizenSubject: string;
  }): Promise<CitizenAccountSummaries> {
    const citizen = await this.prisma.citizen.findFirst({
      where: {
        tenantId: params.tenantId,
        keycloakSubject: params.citizenSubject,
      },
      select: {
        id: true,
        name: true,
        wardId: true,
        holdingNumber: true,
        languagePref: true,
      },
    });

    if (!citizen) {
      return {
        citizenId: null,
        summary: 'Citizen profile not linked for this municipality.',
        applications: formatApplicationAccountSummary({ linked: false, total: 0, recentLines: [] }),
        grievances: formatGrievanceAccountSummary({
          linked: false,
          total: 0,
          open: 0,
          recent: [],
        }),
        payments: await this.buildPaymentSummary(params.tenantId, params.citizenSubject),
      };
    }

    const [applications, grievances, payments] = await Promise.all([
      this.buildApplicationSummary(params.tenantId, citizen.id),
      this.buildGrievanceSummary(params.tenantId, citizen.id),
      this.buildPaymentSummary(params.tenantId, params.citizenSubject),
    ]);

    const summary = [
      citizen.name ? `Name on file (redacted in LLM prompt).` : 'Name not on file.',
      citizen.wardId ? `Ward linked.` : 'Ward not linked.',
      citizen.holdingNumber ? `Holding on file.` : 'No holding on file.',
      `Language preference: ${citizen.languagePref}.`,
    ].join(' ');

    return {
      citizenId: citizen.id,
      summary,
      applications,
      grievances,
      payments,
    };
  }

  private async buildApplicationSummary(tenantId: string, citizenId: string): Promise<string> {
    const where = {
      tenantId,
      citizenId,
      status: { notIn: ['cancelled', 'rejected'] as string[] },
    };

    const [total, recent] = await Promise.all([
      this.prisma.application.count({ where }),
      this.prisma.application.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          docketNo: true,
          status: true,
          serviceCode: true,
        },
      }),
    ]);

    const recentLines = recent.map(
      (row) => `- ${row.serviceCode}: docket ${row.docketNo}, status ${row.status}`,
    );

    return formatApplicationAccountSummary({ linked: true, total, recentLines });
  }

  private async buildGrievanceSummary(tenantId: string, citizenId: string): Promise<string> {
    const where = { tenantId, citizenId };

    const [total, open, recent] = await Promise.all([
      this.prisma.grievance.count({ where }),
      this.prisma.grievance.count({
        where: { ...where, status: { in: [...OPEN_GRIEVANCE_STATUSES] } },
      }),
      this.prisma.grievance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          grievanceNo: true,
          status: true,
          category: true,
          createdAt: true,
        },
      }),
    ]);

    return formatGrievanceAccountSummary({
      linked: true,
      total,
      open,
      recent,
    });
  }

  private async buildPaymentSummary(tenantId: string, citizenSubject: string): Promise<string> {
    const where = { tenantId, citizenSubject };

    const [total, settled, recent] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.count({ where: { ...where, status: 'settled' } }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          status: true,
          amountPaise: true,
          createdAt: true,
          application: {
            select: { docketNo: true, serviceCode: true },
          },
        },
      }),
    ]);

    return formatPaymentAccountSummary({
      total,
      settled,
      recent: recent.map((row) => ({
        status: row.status,
        amountPaise: row.amountPaise,
        createdAt: row.createdAt,
        docketNo: row.application?.docketNo ?? '',
        serviceCode: row.application?.serviceCode ?? '',
      })),
    });
  }

  async resolveTenantHelpline(tenantId: string): Promise<{ name: string; phone: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, tenantConfig: { select: { contactPhone: true } } },
    });
    return {
      name: tenant?.name ?? 'Municipality',
      phone: tenant?.tenantConfig?.contactPhone ?? 'municipal helpline',
    };
  }
}
