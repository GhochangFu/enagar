import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import type { Prisma } from '../../generated/prisma';

export type WorkOrderResponse = {
  id: string;
  tenant_id: string;
  application_id: string;
  work_order_no: string;
  status: string;
  assigned_user_id: string | null;
  vendor_id: string | null;
  assigned_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TenantVendorResponse = {
  id: string;
  code: string;
  name: { en: string; bn?: string; hi?: string };
  is_active: boolean;
};

@Injectable()
export class WorkOrdersService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async nextWorkOrderNo(tenantCode: string): Promise<string> {
    if (!this.prisma) {
      throw new BadRequestException('Work orders require Postgres');
    }
    const year = new Date().getFullYear();
    const prefix = `WO/${tenantCode}/${year}/`;
    const count = await this.prisma.workOrder.count({
      where: { workOrderNo: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }

  async createForApplication(
    tenantId: string,
    tenantCode: string,
    applicationId: string,
  ): Promise<WorkOrderResponse> {
    if (!this.prisma) {
      throw new BadRequestException('Work orders require Postgres');
    }

    const existing = await this.prisma.workOrder.findFirst({
      where: { tenantId, applicationId },
    });
    if (existing) {
      return this.toResponse(existing);
    }

    const workOrderNo = await this.nextWorkOrderNo(tenantCode);
    const row = await this.prisma.workOrder.create({
      data: {
        tenantId,
        applicationId,
        workOrderNo,
        status: 'issued',
      },
    });
    return this.toResponse(row);
  }

  async getByApplicationId(
    tenantId: string,
    applicationId: string,
  ): Promise<WorkOrderResponse | null> {
    if (!this.prisma) {
      return null;
    }
    const row = await this.prisma.workOrder.findFirst({
      where: { tenantId, applicationId },
    });
    return row ? this.toResponse(row) : null;
  }

  async assign(
    tenantId: string,
    workOrderId: string,
    input: { assigned_user_id?: string | null; vendor_id?: string | null },
  ): Promise<WorkOrderResponse> {
    if (!this.prisma) {
      throw new BadRequestException('Work orders require Postgres');
    }
    const row = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
    });
    if (!row) {
      throw new NotFoundException('Work order not found');
    }

    const now = new Date();
    const nextStatus =
      input.assigned_user_id || input.vendor_id
        ? row.status === 'issued' || row.status === 'assigned'
          ? 'assigned'
          : row.status
        : row.status;

    const updated = await this.prisma.workOrder.update({
      where: { id: row.id },
      data: {
        assignedUserId: input.assigned_user_id ?? row.assignedUserId,
        vendorId: input.vendor_id ?? row.vendorId,
        status: nextStatus,
        assignedAt: input.assigned_user_id || input.vendor_id ? now : row.assignedAt,
      },
    });
    return this.toResponse(updated);
  }

  async markInProgress(tenantId: string, applicationId: string): Promise<WorkOrderResponse | null> {
    if (!this.prisma) {
      return null;
    }
    const row = await this.prisma.workOrder.findFirst({
      where: { tenantId, applicationId },
    });
    if (!row) {
      return null;
    }
    const updated = await this.prisma.workOrder.update({
      where: { id: row.id },
      data: { status: 'in_progress' },
    });
    return this.toResponse(updated);
  }

  async markCompleted(tenantId: string, applicationId: string): Promise<WorkOrderResponse | null> {
    if (!this.prisma) {
      return null;
    }
    const row = await this.prisma.workOrder.findFirst({
      where: { tenantId, applicationId },
    });
    if (!row) {
      return null;
    }
    const updated = await this.prisma.workOrder.update({
      where: { id: row.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    return this.toResponse(updated);
  }

  async listVendors(tenantId: string): Promise<TenantVendorResponse[]> {
    if (!this.prisma) {
      return [];
    }
    const rows = await this.prisma.tenantVendor.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name as TenantVendorResponse['name'],
      is_active: row.isActive,
    }));
  }

  private toResponse(row: {
    id: string;
    tenantId: string;
    applicationId: string;
    workOrderNo: string;
    status: string;
    assignedUserId: string | null;
    vendorId: string | null;
    assignedAt: Date | null;
    completedAt: Date | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }): WorkOrderResponse {
    return {
      id: row.id,
      tenant_id: row.tenantId,
      application_id: row.applicationId,
      work_order_no: row.workOrderNo,
      status: row.status,
      assigned_user_id: row.assignedUserId,
      vendor_id: row.vendorId,
      assigned_at: row.assignedAt?.toISOString() ?? null,
      completed_at: row.completedAt?.toISOString() ?? null,
      metadata:
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {},
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
