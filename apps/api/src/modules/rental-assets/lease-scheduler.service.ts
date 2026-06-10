import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line import/no-unresolved
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class LeaseSchedulerService {
  private readonly logger = new Logger(LeaseSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleLeaseScheduler() {
    this.logger.log('Running daily lease scheduler (cron)…');
    await this.runOnce('cron');
  }

  /**
   * One-shot run of the lease scheduler pipeline. Exposed both for the cron
   * trigger and for the manual "Run lease scheduler now" button in the
   * tenant admin portal. Returns a summary so the UI can show the operator
   * what changed.
   */
  async runOnce(trigger: 'cron' | 'manual' = 'manual'): Promise<{
    trigger: 'cron' | 'manual';
    invoicesCreated: number;
    flippedToOverdue: number;
    expiringAgreements: number;
  }> {
    const now = new Date();

    // 1. Expiry Alerts (Agreements expiring within the next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const expiringAgreements = await this.prisma.leaseAgreement.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        asset: true,
      },
    });

    if (expiringAgreements.length > 0) {
      this.logger.warn(
        `[LEASE ALERT] ${expiringAgreements.length} agreements are expiring within 30 days.`,
      );
      // TODO: Integrate with actual notification service (e.g., email, in-app)
    }

    // 2. Invoice Generation
    // Fetch active agreements and their most recent invoice to determine the next billing period
    const activeAgreements = await this.prisma.leaseAgreement.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        // Rate (`baseLeaseRatePaise`, `ratePeriod`) lives on the asset, not on
        // the agreement, so the invoice generator needs it joined here.
        asset: true,
        invoices: {
          orderBy: { periodStart: 'desc' },
          take: 1,
        },
      },
    });

    let invoicesCreated = 0;
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    for (const agreement of activeAgreements) {
      const lastInvoice = agreement.invoices[0];
      let nextPeriodStart: Date;

      if (!lastInvoice) {
        nextPeriodStart = new Date(agreement.startDate);
      } else {
        nextPeriodStart = new Date(lastInvoice.periodEnd);
        nextPeriodStart.setDate(nextPeriodStart.getDate() + 1); // Next day
      }

      // Calculate next period end based on the linked asset's ratePeriod.
      // The agreement itself does not carry the rate — it lives on the asset.
      const nextPeriodEnd = new Date(nextPeriodStart);
      const ratePeriod = agreement.asset.ratePeriod;
      if (ratePeriod === 'MONTHLY') {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
      } else if (ratePeriod === 'QUARTERLY') {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 3);
      } else if (ratePeriod === 'YEARLY') {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
      }

      // Only generate if the next period is starting soon (within 7 days)
      if (nextPeriodStart <= sevenDaysFromNow) {
        // Check if an invoice already exists for this exact period to prevent duplicates
        const existingInvoice = await this.prisma.leaseInvoice.findFirst({
          where: {
            agreementId: agreement.id,
            periodStart: {
              equals: nextPeriodStart,
            },
          },
        });

        if (!existingInvoice) {
          const baseLeaseRatePaise = agreement.asset.baseLeaseRatePaise;
          await this.prisma.leaseInvoice.create({
            data: {
              tenantId: agreement.tenantId,
              agreementId: agreement.id,
              invoiceNo: `INV-${agreement.id.slice(0, 8)}-${Date.now()}`,
              periodStart: nextPeriodStart,
              periodEnd: nextPeriodEnd,
              dueDate: nextPeriodStart,
              amountPaise: baseLeaseRatePaise,
              status: 'PENDING',
            },
          });
          this.logger.log(
            `[LEASE INVOICE] Generated invoice for agreement ${agreement.id} for period ${nextPeriodStart.toISOString()}`,
          );
          invoicesCreated++;
        }
      }
    }

    // 3. Auto-flip PENDING → OVERDUE
    const overdueCandidates = await this.prisma.leaseInvoice.findMany({
      where: { status: 'PENDING', dueDate: { lt: now } },
    });
    for (const inv of overdueCandidates) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: inv.tenantId } });
      // Prefer the new dedicated column; fall back to the legacy JSON config
      // for tenants that have not been backfilled yet.
      let lateFeePaise = tenant?.lateFeePaise ?? 0;
      if (lateFeePaise === 0) {
        const legacy = (tenant?.config ?? {}) as {
          rentalLateFee?: { enabled?: boolean; flatAmountPaise?: number };
        };
        if (legacy.rentalLateFee?.enabled && legacy.rentalLateFee.flatAmountPaise) {
          lateFeePaise = legacy.rentalLateFee.flatAmountPaise;
        }
      }
      await this.prisma.leaseInvoice.update({
        where: { id: inv.id },
        data: { status: 'OVERDUE', lateFeePaise },
      });
      this.logger.warn(
        `[LEASE INVOICE] ${inv.invoiceNo} is now OVERDUE (lateFeePaise=${lateFeePaise})`,
      );
    }

    this.logger.log(
      `Lease scheduler (${trigger}) completed. Created ${invoicesCreated} new invoice(s); flipped ${overdueCandidates.length} to OVERDUE.`,
    );
    return {
      trigger,
      invoicesCreated,
      flippedToOverdue: overdueCandidates.length,
      expiringAgreements: expiringAgreements.length,
    };
  }
}
