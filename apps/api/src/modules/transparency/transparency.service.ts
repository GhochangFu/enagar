import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class TransparencyService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [tenants, services, applications, grievances, settledPayments] = await Promise.all([
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.tenantService.count({ where: { isActive: true } }),
      this.prisma.application.count(),
      this.prisma.grievance.count(),
      this.prisma.payment.count({ where: { status: 'settled' } }),
    ]);
    return {
      generated_at: new Date().toISOString(),
      tenants_active: tenants,
      services_active: services,
      applications_total: applications,
      grievances_total: grievances,
      payments_settled_total: settledPayments,
      pii_policy:
        'Aggregate only. No citizen, operator, payment reference, or audit metadata fields.',
    };
  }

  async tenantsCsv(): Promise<string> {
    const rows = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: {
        code: true,
        name: true,
        district: true,
        wardCount: true,
        _count: { select: { services: true } },
      },
      orderBy: { code: 'asc' },
    });
    return toCsv(
      ['tenant_code', 'tenant_name', 'district', 'ward_count', 'services_total'],
      rows.map((row) => [
        row.code,
        row.name,
        row.district ?? '',
        row.wardCount ?? '',
        row._count.services,
      ]),
    );
  }

  async servicesCsv(): Promise<string> {
    const rows = await this.prisma.tenantService.findMany({
      where: { isActive: true },
      select: {
        code: true,
        effectiveSlaDays: true,
        tenant: { select: { code: true } },
        category: { select: { code: true } },
      },
      orderBy: [{ tenant: { code: 'asc' } }, { code: 'asc' }],
      take: 10000,
    });
    return toCsv(
      ['tenant_code', 'service_code', 'category_code', 'effective_sla_days'],
      rows.map((row) => [row.tenant.code, row.code, row.category.code, row.effectiveSlaDays ?? '']),
    );
  }

  async slaCsv(): Promise<string> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    const rows = await Promise.all(
      tenants.map(async (tenant) => {
        const [openApplications, openGrievances, breachedGrievances] = await Promise.all([
          this.prisma.application.count({
            where: { tenantId: tenant.id, NOT: { status: 'closed' } },
          }),
          this.prisma.grievance.count({
            where: { tenantId: tenant.id, NOT: { status: { in: ['resolved', 'closed'] } } },
          }),
          this.prisma.grievance.count({
            where: { tenantId: tenant.id, slaBreachedAt: { not: null } },
          }),
        ]);
        return [tenant.code, tenant.name, openApplications, openGrievances, breachedGrievances];
      }),
    );
    return toCsv(
      [
        'tenant_code',
        'tenant_name',
        'open_applications',
        'open_grievances',
        'sla_breached_grievances',
      ],
      rows,
    );
  }
}

function csvSafe(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const escapedFormula = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${escapedFormula.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvSafe).join(','), ...rows.map((row) => row.map(csvSafe).join(','))].join(
    '\r\n',
  );
}
