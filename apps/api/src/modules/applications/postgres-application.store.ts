import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { ensureMunicipalCitizenRow } from '../citizen/ensure-municipal-citizen-row';

import type { ApplicationStore } from './application-store';
import type { ApplicationResponse } from './dto';
import type { Prisma } from '../../generated/prisma';

interface ApplicationRow {
  runtimeSnapshot: unknown;
}

interface PersistenceRefs {
  citizenId: string;
  serviceId: string;
}

/**
 * Postgres persistence adapter for applications.
 *
 * The normalized FK columns keep payments, citizens, and services relational.
 * `runtime_snapshot` preserves the API-facing application shape while workflow
 * and document persistence are still being hardened across Phase 3.
 */
@Injectable()
export class PostgresApplicationStore implements ApplicationStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async nextDocketNo(tenantCode: string, serviceCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `WBM/${tenantCode}/${serviceCode}/${year}/`;
    const existingCount = await this.db.application.count({
      where: {
        docketNo: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}${String(existingCount + 1).padStart(5, '0')}`;
  }

  async save(application: ApplicationResponse): Promise<void> {
    const refs = await this.resolvePersistenceRefs(application);
    await this.db.application.upsert({
      where: {
        id: application.id,
      },
      create: {
        id: application.id,
        tenantId: application.tenant_id,
        citizenId: refs.citizenId,
        serviceId: refs.serviceId,
        docketNo: application.docket_no,
        serviceCode: application.service_code,
        formVersion: application.form_version,
        workflowVersion: application.workflow_version,
        status: application.status,
        statusLabel: { en: application.status_label },
        pendingRole: application.pending_role,
        formData: toJsonInput(application.form_data),
        runtimeSnapshot: toJsonInput(application),
        paymentStatus: application.payment_status,
        submittedAt: new Date(application.submitted_at),
      },
      update: {
        status: application.status,
        statusLabel: { en: application.status_label },
        pendingRole: application.pending_role,
        formData: toJsonInput(application.form_data),
        runtimeSnapshot: toJsonInput(application),
        paymentStatus: application.payment_status,
        submittedAt: new Date(application.submitted_at),
      },
    });
  }

  async findById(applicationId: string): Promise<ApplicationResponse | null> {
    const row = await this.db.application.findUnique({
      where: {
        id: applicationId,
      },
      select: {
        runtimeSnapshot: true,
      },
    });

    return row ? toApplicationResponse(row) : null;
  }

  async findByDocketNo(docketNo: string): Promise<ApplicationResponse | null> {
    const row = await this.db.application.findUnique({
      where: {
        docketNo,
      },
      select: {
        runtimeSnapshot: true,
      },
    });

    return row ? toApplicationResponse(row) : null;
  }

  async list(): Promise<ApplicationResponse[]> {
    const rows = await this.db.application.findMany({
      select: {
        runtimeSnapshot: true,
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    return rows.map(toApplicationResponse);
  }

  private async resolvePersistenceRefs(application: ApplicationResponse): Promise<PersistenceRefs> {
    const [citizenId, service] = await Promise.all([
      ensureMunicipalCitizenRow(this.db, application.citizen_subject, application.tenant_id),
      this.db.tenantService.findFirst({
        where: {
          tenantId: application.tenant_id,
          code: application.service_code,
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (!service) {
      throw new NotFoundException('Service not found for application persistence');
    }

    return {
      citizenId,
      serviceId: service.id,
    };
  }
}

function toApplicationResponse(row: ApplicationRow): ApplicationResponse {
  return row.runtimeSnapshot as ApplicationResponse;
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
